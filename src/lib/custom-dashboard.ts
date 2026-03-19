import { GoogleGenAI } from "@google/genai";

import type { BoiSeries } from "@/lib/boi-types";
import type { NumericPoint, PricePoint } from "@/lib/cbs-types";
import { fetchMacroDashboardSummary } from "@/lib/macro-dashboard";
import type { MacroDashboardSummary } from "@/lib/macro-dashboard-types";
import type {
  CustomDashboardChartType,
  CustomDashboardDataset,
  CustomDashboardResponse,
} from "@/lib/custom-dashboard-types";

const DASHBOARD_MODEL = "gemini-2.5-flash";

type ScalarPoint = {
  date: string;
  label: string;
  value: number;
};

type SeriesCatalogItem = {
  key: string;
  label: string;
  source: "boi" | "cbs";
  category: string;
  unit: string | null;
  points: ScalarPoint[];
};

type DashboardSpec = {
  title: string;
  description: string;
  chartType: CustomDashboardChartType;
  seriesKeys: string[];
  months: number;
};

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  return new GoogleGenAI({ apiKey });
}

function monthIndex(rawDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return Number(rawDate.slice(0, 4)) * 12 + Number(rawDate.slice(5, 7));
  }

  if (/^\d{4}-\d{2}$/.test(rawDate)) {
    return Number(rawDate.slice(0, 4)) * 12 + Number(rawDate.slice(5, 7));
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

function monthKey(rawDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return rawDate.slice(0, 7);
  }

  if (/^\d{4}-\d{2}$/.test(rawDate)) {
    return rawDate;
  }

  const quarterMatch = rawDate.match(/^(\d{4})-Q([1-4])$/);
  if (quarterMatch) {
    const [, year, quarter] = quarterMatch;
    return `${year}-Q${quarter}`;
  }

  if (/^\d{4}$/.test(rawDate)) {
    return rawDate;
  }

  return rawDate;
}

function priceSeries(
  key: string,
  label: string,
  category: string,
  source: "boi" | "cbs",
  unit: string | null,
  points: PricePoint[],
): SeriesCatalogItem {
  return {
    key,
    label,
    source,
    category,
    unit,
    points: points.map((point) => ({
      date: point.date,
      label: monthKey(point.date),
      value: point.percent,
    })),
  };
}

function numericSeries(
  key: string,
  label: string,
  category: string,
  source: "boi" | "cbs",
  unit: string | null,
  points: NumericPoint[],
): SeriesCatalogItem {
  return {
    key,
    label,
    source,
    category,
    unit,
    points: points.map((point) => ({
      date: point.rawDate,
      label: point.label,
      value: point.value,
    })),
  };
}

function boiSeries(series: BoiSeries): SeriesCatalogItem {
  return {
    key: series.key,
    label: series.label,
    source: "boi",
    category: series.category ?? "בנק ישראל",
    unit: series.unit,
    points: series.points.map((point) => ({
      date: point.date,
      label: point.label,
      value: point.value,
    })),
  };
}

function seriesCatalog(summary: MacroDashboardSummary): SeriesCatalogItem[] {
  return [
    ...summary.boi.series.map(boiSeries),
    priceSeries("cpi", "מדד המחירים לצרכן", 'למ"ס headline', "cbs", "%", summary.cbs.topSeries.cpi),
    priceSeries("housing", "מדד מחירי הדירות", 'למ"ס headline', "cbs", "%", summary.cbs.topSeries.housing),
    priceSeries(
      "new_dwelling",
      "מדד מחירי דירות חדשות",
      'למ"ס headline',
      "cbs",
      "%",
      summary.cbs.topSeries.newDwelling,
    ),
    numericSeries("stock", "יתרת מלאי דירות", 'למ"ס headline', "cbs", null, summary.cbs.topSeries.stock),
    ...Object.entries(summary.cbs.regionalPrices).map(([region, points]) =>
      priceSeries(`regional_price_${region}`, `מחירי דירות - ${region}`, 'למ"ס אזורי', "cbs", "%", points),
    ),
  ];
}

function fallbackSeriesKeys(prompt: string, catalog: SeriesCatalogItem[]) {
  const normalized = prompt.toLowerCase();
  const matches = new Set<string>();

  const addIfExists = (key: string) => {
    if (catalog.some((item) => item.key === key)) {
      matches.add(key);
    }
  };

  if (
    normalized.includes("interest") ||
    normalized.includes("intrest") ||
    normalized.includes("ריבית")
  ) {
    addIfExists("policy_rate");
  }

  if (
    normalized.includes("unsold") ||
    normalized.includes("un sold") ||
    normalized.includes("מלאי") ||
    normalized.includes("דירות לא מכורות") ||
    normalized.includes("unsold apartments")
  ) {
    addIfExists("stock");
  }

  if (normalized.includes("housing") || normalized.includes("מחירי הדירות")) {
    addIfExists("housing");
  }

  if (normalized.includes("inflation") || normalized.includes("אינפלציה")) {
    addIfExists("cpi");
  }

  return Array.from(matches).slice(0, 3);
}

function normalizeSeriesSelection(prompt: string, keys: string[], catalog: SeriesCatalogItem[]) {
  const normalized = prompt.toLowerCase();
  const hasMortgageLanguage =
    normalized.includes("mortgage") || normalized.includes("משכנת") || normalized.includes("housing credit");
  const hasGenericInterestLanguage =
    normalized.includes("interest") || normalized.includes("intrest") || normalized.includes("ריבית");

  const nextKeys = [...keys];

  if (hasGenericInterestLanguage && !hasMortgageLanguage) {
    const policyRateExists = catalog.some((item) => item.key === "policy_rate");
    const mortgageRateIndex = nextKeys.indexOf("new_mortgage_rate");

    if (policyRateExists && mortgageRateIndex !== -1) {
      nextKeys[mortgageRateIndex] = "policy_rate";
    } else if (policyRateExists && !nextKeys.includes("policy_rate")) {
      nextKeys.push("policy_rate");
    }
  }

  return Array.from(new Set(nextKeys)).slice(0, 3);
}

async function generateSpec(prompt: string, catalog: SeriesCatalogItem[]): Promise<DashboardSpec> {
  const ai = getGeminiClient();
  const catalogText = catalog
    .map((item) => `${item.key} | ${item.label} | ${item.source} | ${item.category} | ${item.unit ?? "unitless"}`)
    .join("\n");

  const response = await ai.models.generateContent({
    model: DASHBOARD_MODEL,
    contents: `You are selecting existing macro series for a chart builder.
Pick only series keys from the provided catalog.
Return JSON only with this shape:
{
  "title": string,
  "description": string,
  "chartType": "line" | "bar",
  "seriesKeys": string[],
  "months": number
}

Rules:
- Prefer 1-3 series.
- For prompts about correlation or comparison, prefer 2 series.
- Use "line" unless a bar chart is clearly better.
- months must be between 12 and 120.
- Never invent series keys.

Catalog:
${catalogText}

User prompt:
${prompt}`,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const rawText = response.text?.trim();

  if (!rawText) {
    throw new Error("Gemini returned an empty dashboard specification");
  }

  const parsed = JSON.parse(rawText) as Partial<DashboardSpec>;
  const validKeys = new Set(catalog.map((item) => item.key));
  const fallbackKeys = fallbackSeriesKeys(prompt, catalog);
  const seriesKeys = (parsed.seriesKeys ?? []).filter((key): key is string => typeof key === "string" && validKeys.has(key));
  const selectedKeys = normalizeSeriesSelection(prompt, seriesKeys.length > 0 ? seriesKeys : fallbackKeys, catalog);

  if (selectedKeys.length === 0) {
    throw new Error("Could not map the prompt to available BOI/CBS series");
  }

  return {
    title: parsed.title?.trim() || "Custom macro chart",
    description: parsed.description?.trim() || "Generated from text prompt over cached BOI/CBS data.",
    chartType: parsed.chartType === "bar" ? "bar" : "line",
    seriesKeys: selectedKeys,
    months: Math.max(12, Math.min(120, Number(parsed.months) || 60)),
  };
}

function filterLastMonths(points: ScalarPoint[], months: number) {
  const latest = points.at(-1);
  const latestMonth = latest ? monthIndex(latest.date) : null;

  if (latestMonth == null) {
    return points;
  }

  const minMonth = latestMonth - months + 1;

  return points.filter((point) => {
    const value = monthIndex(point.date);
    return value != null && value >= minMonth;
  });
}

function alignSeries(seriesList: SeriesCatalogItem[], months: number) {
  const filtered = seriesList.map((series) => ({
    ...series,
    points: filterLastMonths(series.points, months),
  }));

  const labels = Array.from(
    new Set(
      filtered.flatMap((series) =>
        series.points
          .map((point) => point.date)
          .filter((date): date is string => monthIndex(date) != null),
      ),
    ),
  ).sort((left, right) => (monthIndex(left) ?? 0) - (monthIndex(right) ?? 0));

  const datasets: CustomDashboardDataset[] = filtered.map((series) => {
    const pointMap = new Map(series.points.map((point) => [point.date, point.value]));

    return {
      key: series.key,
      label: series.label,
      unit: series.unit,
      data: labels.map((label) => pointMap.get(label) ?? null),
    };
  });

  return {
    labels: labels.map(monthKey),
    datasets,
  };
}

function pearsonCorrelation(left: Array<number | null>, right: Array<number | null>) {
  const pairs = left.flatMap((value, index) => {
    const other = right[index];

    return value != null && other != null ? [[value, other] as const] : [];
  });

  if (pairs.length < 3) {
    return null;
  }

  const leftMean = pairs.reduce((sum, [value]) => sum + value, 0) / pairs.length;
  const rightMean = pairs.reduce((sum, [, value]) => sum + value, 0) / pairs.length;
  const numerator = pairs.reduce((sum, [leftValue, rightValue]) => sum + (leftValue - leftMean) * (rightValue - rightMean), 0);
  const leftVariance = pairs.reduce((sum, [value]) => sum + (value - leftMean) ** 2, 0);
  const rightVariance = pairs.reduce((sum, [, value]) => sum + (value - rightMean) ** 2, 0);
  const denominator = Math.sqrt(leftVariance * rightVariance);

  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

export async function buildCustomDashboard(prompt: string): Promise<CustomDashboardResponse> {
  const summary = await fetchMacroDashboardSummary();
  const catalog = seriesCatalog(summary);
  const spec = await generateSpec(prompt, catalog);
  const selectedSeries = spec.seriesKeys
    .map((key) => catalog.find((item) => item.key === key))
    .filter((item): item is SeriesCatalogItem => item != null);

  if (selectedSeries.length === 0) {
    throw new Error("No matching series were available for the requested dashboard");
  }

  const { labels, datasets } = alignSeries(selectedSeries, spec.months);
  const correlation =
    datasets.length >= 2 ? pearsonCorrelation(datasets[0].data, datasets[1].data) : null;

  return {
    prompt,
    title: spec.title,
    description: spec.description,
    chartType: spec.chartType,
    labels,
    datasets,
    matchedSeries: selectedSeries.map((series) => series.label),
    correlation,
  };
}
