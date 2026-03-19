import { readFile } from "node:fs/promises";
import path from "node:path";

import { GoogleGenAI } from "@google/genai";

import type { BoiDashboardSummary, BoiPoint, BoiSeries } from "@/lib/boi-types";
import type { NumericPoint, PricePoint } from "@/lib/cbs-types";

const GEMINI_MODEL = "gemini-2.5-flash";
const CACHE_DIR = path.join(process.cwd(), ".blob-cache");
const compactFormatter = new Intl.NumberFormat("he-IL", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const preciseFormatter = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 2,
});

const SYSTEM_PROMPT = `You are a macro-economic analyst specializing in the Israeli economy.
You have access to current Bank of Israel and CBS macro data from the application cache.
Rules:
- Answer in the same language as the user query.
- Be concise, analytical, and data-driven.
- Reference specific values and dates when relevant.
- If the question cannot be answered from the provided context, say so directly.
- Do not invent data, calculations, or sources outside the provided context.
- Use markdown when it helps readability.`;

type CacheEntry<T> = {
  updatedAt: string;
  value: T;
};

type CbsSnapshot = {
  generatedAt: string;
  cpi: PricePoint[];
  housing: PricePoint[];
  newDwelling: PricePoint[];
  stock: NumericPoint[];
  regionalPrices: Record<string, PricePoint[]>;
};

type ScalarPoint = {
  date: string;
  value: number;
};

type ContextSeries = {
  key: string;
  label: string;
  unit: string | null;
  section: string;
  points: ScalarPoint[];
};

async function readCache<T>(cacheKeys: string[]): Promise<T> {
  for (const key of cacheKeys) {
    try {
      const raw = await readFile(path.join(CACHE_DIR, `${key}.json`), "utf8");
      const parsed = JSON.parse(raw) as CacheEntry<T>;

      if (parsed?.value != null) {
        return parsed.value;
      }
    } catch {
      continue;
    }
  }

  throw new Error(`Could not load cache for keys: ${cacheKeys.join(", ")}`);
}

function monthIndex(rawDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const year = Number(rawDate.slice(0, 4));
    const month = Number(rawDate.slice(5, 7));
    return year * 12 + month;
  }

  if (/^\d{4}-\d{2}$/.test(rawDate)) {
    const year = Number(rawDate.slice(0, 4));
    const month = Number(rawDate.slice(5, 7));
    return year * 12 + month;
  }

  const quarterMatch = rawDate.match(/^(\d{4})-Q([1-4])$/);
  if (quarterMatch) {
    const [, year, quarter] = quarterMatch;
    return Number(year) * 12 + Number(quarter) * 3;
  }

  if (/^\d{4}$/.test(rawDate)) {
    return Number(rawDate) * 12 + 12;
  }

  return null;
}

function previousPoint(points: ScalarPoint[], monthsBack: number) {
  const latest = points.at(-1);
  const latestMonth = latest ? monthIndex(latest.date) : null;

  if (!latest || latestMonth == null) {
    return null;
  }

  const target = latestMonth - monthsBack;

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const candidate = points[index];
    const candidateMonth = monthIndex(candidate.date);

    if (candidateMonth != null && candidateMonth <= target) {
      return candidate;
    }
  }

  return null;
}

function formatNumber(value: number) {
  return Math.abs(value) >= 1_000 ? compactFormatter.format(value) : preciseFormatter.format(value);
}

function formatValue(value: number | null, unit: string | null) {
  if (value == null) {
    return "אין נתון";
  }

  const formatted = formatNumber(value);
  return unit === "%" ? `${formatted}%` : unit ? `${formatted} ${unit}` : formatted;
}

function formatDelta(value: number | null, unit: string | null) {
  if (value == null) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  const formatted = `${sign}${formatNumber(value)}`;
  return unit === "%" ? `${formatted}%` : unit ? `${formatted} ${unit}` : formatted;
}

function latestRow(series: ContextSeries) {
  const latest = series.points.at(-1);
  const threeMonth = previousPoint(series.points, 3);
  const twelveMonth = previousPoint(series.points, 12);
  const change3m = latest && threeMonth ? latest.value - threeMonth.value : null;
  const change12m = latest && twelveMonth ? latest.value - twelveMonth.value : null;

  return `| ${series.label} | ${formatValue(latest?.value ?? null, series.unit)} | ${latest?.date ?? "—"} | ${formatDelta(change3m, series.unit)} | ${formatDelta(change12m, series.unit)} |`;
}

function historyCsv(seriesList: ContextSeries[]) {
  const rows = ["section,series_key,series_label,date,value"];

  for (const series of seriesList) {
    for (const point of series.points.slice(-12)) {
      rows.push(
        [
          series.section,
          series.key,
          series.label.replaceAll(",", " "),
          point.date,
          String(point.value),
        ].join(","),
      );
    }
  }

  return rows.join("\n");
}

function cbsPriceSeries(
  key: string,
  label: string,
  section: string,
  points: PricePoint[],
): ContextSeries {
  return {
    key,
    label,
    section,
    unit: "%",
    points: points.map((point) => ({
      date: point.date,
      value: point.percent,
    })),
  };
}

function cbsNumericSeries(
  key: string,
  label: string,
  section: string,
  unit: string | null,
  points: NumericPoint[],
): ContextSeries {
  return {
    key,
    label,
    section,
    unit,
    points: points.map((point) => ({
      date: point.rawDate,
      value: point.value,
    })),
  };
}

function boiContextSeries(summary: BoiDashboardSummary): ContextSeries[] {
  return summary.series.map((series: BoiSeries) => ({
    key: series.key,
    label: series.label,
    unit: series.unit,
    section: series.category ?? "בנק ישראל",
    points: series.points.map((point: BoiPoint) => ({
      date: point.date,
      value: point.value,
    })),
  }));
}

function cbsContextSeries(snapshot: CbsSnapshot): ContextSeries[] {
  const regions = ["ירושלים", "תל אביב", "המרכז", "הדרום"];

  return [
    cbsPriceSeries("cpi", "מדד המחירים לצרכן", "CBS headline", snapshot.cpi),
    cbsPriceSeries("housing", "מדד מחירי הדירות", "CBS headline", snapshot.housing),
    cbsPriceSeries("new_dwelling", "מדד מחירי דירות חדשות", "CBS headline", snapshot.newDwelling),
    cbsNumericSeries("stock", "יתרת מלאי דירות", "CBS headline", null, snapshot.stock),
    ...regions
      .map((region) => {
        const points = snapshot.regionalPrices[region];
        return points
          ? cbsPriceSeries(
              `regional_price_${region}`,
              `מחירי דירות - ${region}`,
              "CBS regional prices",
              points,
            )
          : null;
      })
      .filter((series): series is ContextSeries => series != null),
  ];
}

function sectionBlock(title: string, series: ContextSeries[]) {
  if (series.length === 0) {
    return "";
  }

  return [
    `### ${title}`,
    "",
    "| סדרה | ערך אחרון | תאריך | שינוי 3 חודשים | שינוי 12 חודשים |",
    "|------|-----------|-------|-----------------|------------------|",
    ...series.map(latestRow),
  ].join("\n");
}

export async function buildMacroContext() {
  const boi = await readCache<BoiDashboardSummary>(["boi-source-v3", "boi-source-v2", "boi-source"]);
  const cbs = await readCache<CbsSnapshot>(["cbs-source-v3", "cbs-source-v2", "cbs-source"]);
  const boiSeries = boiContextSeries(boi);
  const cbsSeries = cbsContextSeries(cbs);
  const allSeries = [...boiSeries, ...cbsSeries];
  const generatedAt = new Date(Math.max(Date.parse(boi.generatedAt), Date.parse(cbs.generatedAt))).toISOString();

  const sections = [
    sectionBlock("בנק ישראל", boiSeries),
    sectionBlock("למ״ס", cbsSeries),
  ].filter(Boolean);

  return [
    `## מצב מאקרו נוכחי`,
    `נכון ל-${generatedAt}`,
    "",
    ...sections,
    "",
    "## היסטוריה מקוצרת",
    "```csv",
    historyCsv(allSeries),
    "```",
  ].join("\n");
}

export async function streamSearch(query: string, context: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });

  return ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: `${context}\n\n---\nUser question: ${query}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
    },
  });
}
