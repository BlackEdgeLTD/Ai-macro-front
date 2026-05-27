import { BOI_SERIES_DEFINITIONS, type BoiSeriesDefinition } from "@/lib/boi-catalog";
import { withWeeklyBlobArtifacts } from "@/lib/blob-cache";
import { toCsv, type SourceTableRow } from "@/lib/source-table";
import type { BoiDashboardSummary, BoiPoint, BoiSeries } from "@/lib/boi-types";

const DEFAULT_TIMEOUT_MS = 30_000;
const BOI_SDMX_API = "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2";

function labelFromDate(date: string) {
  if (/^\d{4}-\d{2}$/.test(date)) {
    return `${date.slice(5, 7)}-${date.slice(0, 4)}`;
  }

  if (/^\d{4}-Q[1-4]$/.test(date)) {
    return `${date.slice(5)}-${date.slice(0, 4)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Intl.DateTimeFormat("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(`${date}T00:00:00Z`));
  }

  return date;
}

function parseCsvRow(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cols.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cols.push(current);
  return cols;
}

function parseCsvSeries(csv: string): BoiPoint[] | null {
  const lines = csv.trim().split("\n");

  if (lines.length < 2) {
    return null;
  }

  const headers = parseCsvRow(lines[0]);
  const timePeriodIdx = headers.indexOf("TIME_PERIOD");
  const obsValueIdx = headers.indexOf("OBS_VALUE");

  if (timePeriodIdx === -1 || obsValueIdx === -1) {
    return null;
  }

  const points: BoiPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      continue;
    }

    const cols = parseCsvRow(line);
    const date = cols[timePeriodIdx];
    const rawValue = cols[obsValueIdx];

    if (!date || !rawValue) {
      continue;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      continue;
    }

    points.push({ date, label: labelFromDate(date), value });
  }

  return points.length > 0 ? points : null;
}

function aggregateMonthEnd(points: BoiPoint[]) {
  const byMonth = new Map<string, BoiPoint>();

  for (const point of points) {
    const monthKey = point.date.slice(0, 7);
    const existing = byMonth.get(monthKey);

    if (!existing || point.date > existing.date) {
      byMonth.set(monthKey, {
        ...point,
        date: monthKey,
        label: labelFromDate(monthKey),
      });
    }
  }

  return Array.from(byMonth.values()).sort((left, right) => left.date.localeCompare(right.date));
}

async function fetchPublicInterestRate(): Promise<number | null> {
  try {
    const response = await fetch("https://www.boi.org.il/PublicApi/GetInterest", {
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { currentInterest: number };
    return typeof data.currentInterest === "number" ? data.currentInterest : null;
  } catch {
    return null;
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`BOI request failed: ${response.status} for ${url}`);
  }

  return response.text();
}

async function fetchSdmxSeries(definition: Extract<BoiSeriesDefinition, { kind: "sdmx" }>): Promise<BoiSeries> {
  const url = `${BOI_SDMX_API}/data/dataflow/${definition.agencyId}/${definition.dataflowId}/${definition.version}/?c%5BSERIES_CODE%5D=${definition.seriesCode}&startperiod=${definition.startPeriod}&format=csv`;
  const csv = await fetchText(url);
  const rawPoints = parseCsvSeries(csv);

  if (!rawPoints) {
    throw new Error(`BOI series returned no data: ${definition.seriesCode}`);
  }

  let points = rawPoints.map((point) => ({
    ...point,
    value: definition.transform ? definition.transform(point.value) : point.value,
  }));

  if (definition.aggregate === "month-end") {
    points = aggregateMonthEnd(points);
  }

  return {
    key: definition.key,
    label: definition.label,
    unit: definition.unit,
    category: definition.category,
    points,
  };
}

async function fetchBoiDashboardSummaryFresh(): Promise<BoiDashboardSummary> {
  const [results, publicRate] = await Promise.all([
    Promise.allSettled(BOI_SERIES_DEFINITIONS.map((definition) => fetchSdmxSeries(definition))),
    fetchPublicInterestRate(),
  ]);

  const series = results
    .filter((r): r is PromiseFulfilledResult<BoiSeries> => r.status === "fulfilled")
    .map((r) => r.value);

  const rejected = results.filter((r) => r.status === "rejected");

  if (rejected.length > 0) {
    console.warn(`[boi] ${rejected.length} series failed to fetch:`, rejected.map((r) => (r as PromiseRejectedResult).reason));
  }

  // Override today's policy rate with the public API value, which is always up-to-date
  if (publicRate !== null) {
    const policyRateSeries = series.find((s) => s.key === "policy_rate");

    if (policyRateSeries) {
      const today = new Date().toISOString().slice(0, 10);
      const todayIdx = policyRateSeries.points.findIndex((p) => p.date === today);
      const todayPoint: BoiPoint = { date: today, label: labelFromDate(today), value: publicRate };

      if (todayIdx >= 0) {
        policyRateSeries.points[todayIdx] = todayPoint;
      } else {
        policyRateSeries.points.push(todayPoint);
      }
    }
  }

  return {
    title: "BOI Macro Watchlist",
    generatedAt: new Date().toISOString(),
    series: series.filter((item) => item.points.length > 0),
  };
}

export async function fetchBoiDashboardSummary(): Promise<BoiDashboardSummary> {
  return withWeeklyBlobArtifacts("boi-source-v5", async () => {
    const value = await fetchBoiDashboardSummaryFresh();
    const rows: SourceTableRow[] = value.series.flatMap((series) =>
      series.points.map((point) => ({
        source: "boi",
        series_key: series.key,
        series_label: series.label,
        observation_date: point.date,
        value: point.value,
        change: null,
        unit: series.unit,
        category: series.category,
        region: null,
        base: null,
        is_partial: false,
      })),
    );

    return {
      value,
      csv: toCsv(rows),
    };
  });
}
