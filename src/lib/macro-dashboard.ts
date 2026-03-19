import { withDailyBlobArtifacts } from "@/lib/blob-cache";
import { fetchBoiDashboardSummary } from "@/lib/boi";
import type { BoiDashboardSummary, BoiSeries } from "@/lib/boi-types";
import { fetchDashboardSummary } from "@/lib/cbs";
import type { DashboardSummary, NumericPoint, PricePoint } from "@/lib/cbs-types";
import type { MacroDashboardMetric, MacroDashboardSection, MacroDashboardSummary } from "@/lib/macro-dashboard-types";
import { toCsv, type SourceTableRow } from "@/lib/source-table";

const MACRO_DASHBOARD_CACHE_KEY = "macro-dashboard-v2";

function latestBoiMetric(summary: BoiDashboardSummary, key: string, label: string): MacroDashboardMetric {
  const series = summary.series.find((item) => item.key === key);
  const point = series?.points.at(-1);

  return {
    key,
    label,
    source: "boi",
    date: point?.date ?? null,
    value: point?.value ?? null,
    unit: series?.unit ?? null,
  };
}

function latestCbsPriceMetric(summary: DashboardSummary, key: string, label: string, points: PricePoint[]): MacroDashboardMetric {
  const point = points.at(-1);

  return {
    key,
    label,
    source: "cbs",
    date: point?.date ?? null,
    value: point?.percent ?? null,
    unit: "%",
  };
}

function latestCbsNumericMetric(
  key: string,
  label: string,
  points: NumericPoint[],
  unit: string | null = null,
): MacroDashboardMetric {
  const point = points.at(-1);

  return {
    key,
    label,
    source: "cbs",
    date: point?.rawDate ?? null,
    value: point?.value ?? null,
    unit,
  };
}

function buildSections(boi: BoiDashboardSummary, cbs: DashboardSummary): MacroDashboardSection[] {
  return [
    {
      title: "Headline",
      metrics: [
        latestBoiMetric(boi, "policy_rate", "ריבית בנק ישראל"),
        latestCbsPriceMetric(cbs, "cpi", "שינוי חודשי במדד המחירים לצרכן", cbs.topSeries.cpi),
        latestCbsPriceMetric(cbs, "housing", "שינוי אחרון במדד מחירי הדירות", cbs.topSeries.housing),
        latestCbsNumericMetric("stock", "יתרת מלאי דירות", cbs.topSeries.stock),
      ],
    },
    {
      title: "Macro",
      metrics: [
        latestBoiMetric(boi, "inflation_expectations_1y", "ציפיות אינפלציה לשנה קדימה"),
        latestBoiMetric(boi, "monthly_activity_index", "מדד הפעילות הכלכלית"),
        latestBoiMetric(boi, "unemployment_rate", "שיעור האבטלה"),
        latestBoiMetric(boi, "real_wages", "שכר ריאלי ממוצע"),
      ],
    },
    {
      title: "Housing Finance",
      metrics: [
        latestBoiMetric(boi, "housing_credit_total", "אשראי לדיור"),
        latestBoiMetric(boi, "new_mortgage_rate", "ריבית ממוצעת על משכנתאות חדשות"),
        latestBoiMetric(boi, "new_mortgage_volume", "היקף משכנתאות חדשות"),
      ],
    },
    {
      title: "External",
      metrics: [
        latestBoiMetric(boi, "usd_ils", 'דולר / ש"ח'),
        latestBoiMetric(boi, "current_account_pct_gdp", "חשבון שוטף כאחוז מהתוצר"),
        latestBoiMetric(boi, "fx_reserves_usd", 'יתרות מט"ח'),
      ],
    },
  ];
}

function boiRows(summary: BoiDashboardSummary): SourceTableRow[] {
  return summary.series.flatMap((series: BoiSeries) =>
    series.points.map((point) => ({
      source: "boi" as const,
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
}

function cbsPriceRows(
  sourceKey: string,
  label: string,
  points: PricePoint[],
  region: string | null = null,
): SourceTableRow[] {
  return points.map((point) => ({
    source: "cbs" as const,
    series_key: sourceKey,
    series_label: label,
    observation_date: point.date,
    value: point.value,
    change: point.percent,
    unit: "%",
    category: region ? "regional-price" : "headline-price",
    region,
    base: point.base ?? null,
    is_partial: false,
  }));
}

function cbsNumericRows(
  sourceKey: string,
  label: string,
  points: NumericPoint[],
  region: string | null = null,
): SourceTableRow[] {
  return points.map((point) => ({
    source: "cbs" as const,
    series_key: sourceKey,
    series_label: label,
    observation_date: point.rawDate,
    value: point.value,
    change: null,
    unit: null,
    category: region ? "regional-numeric" : "headline-numeric",
    region,
    base: null,
    is_partial: point.isPartial ?? false,
  }));
}

function cbsRows(summary: DashboardSummary): SourceTableRow[] {
  return [
    ...cbsPriceRows("cpi", "מדד המחירים לצרכן", summary.topSeries.cpi),
    ...cbsPriceRows("housing", "מדד מחירי הדירות", summary.topSeries.housing),
    ...cbsPriceRows("new_dwelling", "מדד מחירי דירות חדשות", summary.topSeries.newDwelling),
    ...cbsNumericRows("stock", "יתרת מלאי דירות", summary.topSeries.stock),
    ...Object.entries(summary.regionalPrices).flatMap(([region, points]) =>
      cbsPriceRows(`regional_price_${region}`, `מחירי דירות - ${region}`, points, region),
    ),
  ];
}

async function buildMacroDashboardFresh(): Promise<{ value: MacroDashboardSummary; csv: string }> {
  const [boi, cbs] = await Promise.all([fetchBoiDashboardSummary(), fetchDashboardSummary()]);

  const value: MacroDashboardSummary = {
    title: "Israel Macro Dashboard",
    generatedAt: new Date().toISOString(),
    sources: {
      boiGeneratedAt: boi.generatedAt,
      cbsGeneratedAt: cbs.generatedAt,
    },
    sections: buildSections(boi, cbs),
    boi,
    cbs,
  };

  return {
    value,
    csv: toCsv([...boiRows(boi), ...cbsRows(cbs)]),
  };
}

export async function fetchMacroDashboardSummary(): Promise<MacroDashboardSummary> {
  return withDailyBlobArtifacts(MACRO_DASHBOARD_CACHE_KEY, buildMacroDashboardFresh);
}
