import type { DashboardSummary, NumericPoint, PricePoint, RegionDashboard } from "@/lib/cbs-types";
import { withWeeklyBlobArtifacts } from "@/lib/blob-cache";
import { toCsv, type SourceTableRow } from "@/lib/source-table";

const CPI_CODE = 120010;
const HOUSING_INDEX_CODE = 40010;
const LAST_MONTHS = 120;
const STOCK_SERIES_ID = 574362;

const PRICE_API =
  "https://api.cbs.gov.il/index/data/price?id={code}&format=json&download=false&lastMonths={months}";
const SERIES_API = "https://apis.cbs.gov.il/series/data/list?id={id}&format=json&download=false";
const NEW_DWELLING_API =
  "https://boardsgenerator.cbs.gov.il/Handlers/Prices/GridHandler.ashx?mode=Init";

type RawSeriesPoint = {
  rawDate: string;
  value: number;
  label?: string;
  isPartial?: boolean;
};

type RegionCodes = Record<string, Record<string, number>>;

export const PRICE_REGION_CODES: Record<string, number> = {
  "סך הכל": 40010,
  "ירושלים": 60000,
  "הצפון": 60100,
  "חיפה": 60200,
  "המרכז": 60300,
  "תל אביב": 60400,
  "הדרום": 60500,
};

export const REGION_CODES: RegionCodes = {
  "סך הכל": {
    build_monthly: 574325,
    build_annual: 674325,
    new_monthly: 574361,
    new_annual: 674361,
    secondhand_monthly: 574064,
    secondhand_annual: 574069,
    total_monthly: 574061,
    total_annual: 574067,
    active_quarterly: 574320,
    active_annual: 674320,
    starts_monthly: 974272,
    starts_annual: 674272,
    finish_monthly: 974280,
    finish_annual: 674280,
    start_total_q: 573113,
    start_total_a: 573081,
    start_reconstruction_q: 573114,
    start_reconstruction_a: 573089,
    start_additions_q: 573115,
    start_additions_a: 573097,
    start_TAMA38q: 573116,
    start_TAMA38a: 573105,
    destroyed_apartments_q: 573160,
    destroyed_apartments_a: 573168,
  },
  "ירושלים": {
    build_monthly: 553820,
    build_annual: 653820,
    new_monthly: 574367,
    new_annual: 674367,
    secondhand_monthly: 574070,
    secondhand_annual: 574078,
    total_monthly: 574570,
    total_annual: 574591,
    active_quarterly: 574090,
    active_annual: 674090,
    starts_monthly: 974273,
    starts_annual: 674273,
    finish_monthly: 974281,
    finish_annual: 674281,
    start_total_q: 573129,
    start_total_a: 573082,
    start_reconstruction_q: 573136,
    start_reconstruction_a: 573090,
    start_additions_q: 573143,
    start_additions_a: 573098,
    start_TAMA38q: 573150,
    start_TAMA38a: 573106,
    destroyed_apartments_q: 573161,
    destroyed_apartments_a: 573169,
  },
  "הצפון": {
    build_monthly: 553821,
    build_annual: 653821,
    new_monthly: 574368,
    new_annual: 674368,
    secondhand_monthly: 574071,
    secondhand_annual: 574401,
    total_monthly: 574571,
    total_annual: 574592,
    active_quarterly: 574091,
    active_annual: 674091,
    starts_monthly: 974274,
    starts_annual: 674274,
    finish_monthly: 974282,
    finish_annual: 674282,
    start_total_q: 573130,
    start_total_a: 573083,
    start_reconstruction_q: 573137,
    start_reconstruction_a: 573091,
    start_additions_q: 573144,
    start_additions_a: 573099,
    start_TAMA38q: 573151,
    start_TAMA38a: 573107,
    destroyed_apartments_q: 573162,
    destroyed_apartments_a: 573170,
  },
  "חיפה": {
    build_monthly: 553822,
    build_annual: 653822,
    new_monthly: 574369,
    new_annual: 674369,
    secondhand_monthly: 574072,
    secondhand_annual: 574402,
    total_monthly: 574572,
    total_annual: 574593,
    active_quarterly: 574092,
    active_annual: 674092,
    starts_monthly: 974275,
    starts_annual: 674275,
    finish_monthly: 974283,
    finish_annual: 674283,
    start_total_q: 573131,
    start_total_a: 573084,
    start_reconstruction_q: 573138,
    start_reconstruction_a: 573092,
    start_additions_q: 573145,
    start_additions_a: 573100,
    start_TAMA38q: 573152,
    start_TAMA38a: 573108,
    destroyed_apartments_q: 573163,
    destroyed_apartments_a: 573171,
  },
  "המרכז": {
    build_monthly: 553823,
    build_annual: 653823,
    new_monthly: 574370,
    new_annual: 674370,
    secondhand_monthly: 574073,
    secondhand_annual: 574403,
    total_monthly: 574573,
    total_annual: 574594,
    active_quarterly: 574093,
    active_annual: 674093,
    starts_monthly: 974276,
    starts_annual: 674276,
    finish_monthly: 974284,
    finish_annual: 674284,
    start_total_q: 573132,
    start_total_a: 573085,
    start_reconstruction_q: 573139,
    start_reconstruction_a: 573093,
    start_additions_q: 573146,
    start_additions_a: 573101,
    start_TAMA38q: 573153,
    start_TAMA38a: 573109,
    destroyed_apartments_q: 573164,
    destroyed_apartments_a: 573172,
  },
  "תל אביב": {
    build_monthly: 553824,
    build_annual: 653824,
    new_monthly: 574371,
    new_annual: 674371,
    secondhand_monthly: 574074,
    secondhand_annual: 574404,
    total_monthly: 574574,
    total_annual: 574595,
    active_quarterly: 574094,
    active_annual: 674094,
    starts_monthly: 974277,
    starts_annual: 674277,
    finish_monthly: 974285,
    finish_annual: 674285,
    start_total_q: 573133,
    start_total_a: 573086,
    start_reconstruction_q: 573140,
    start_reconstruction_a: 573094,
    start_additions_q: 573147,
    start_additions_a: 573102,
    start_TAMA38q: 573154,
    start_TAMA38a: 573110,
    destroyed_apartments_q: 573165,
    destroyed_apartments_a: 573173,
  },
  "הדרום": {
    build_monthly: 553825,
    build_annual: 653825,
    new_monthly: 574372,
    new_annual: 674372,
    secondhand_monthly: 574075,
    secondhand_annual: 574405,
    total_monthly: 574575,
    total_annual: 574596,
    active_quarterly: 574095,
    active_annual: 674095,
    starts_monthly: 974278,
    starts_annual: 674278,
    finish_monthly: 974286,
    finish_annual: 674286,
    start_total_q: 573134,
    start_total_a: 573087,
    start_reconstruction_q: 573141,
    start_reconstruction_a: 573095,
    start_additions_q: 573148,
    start_additions_a: 573103,
    start_TAMA38q: 573155,
    start_TAMA38a: 573111,
    destroyed_apartments_q: 573166,
    destroyed_apartments_a: 573174,
  },
  "אזור יהודה והשומרון": {
    build_monthly: 553826,
    build_annual: 653826,
    new_monthly: 574373,
    new_annual: 674373,
    secondhand_monthly: 574076,
    secondhand_annual: 574406,
    total_monthly: 574576,
    total_annual: 574597,
    active_quarterly: 574096,
    active_annual: 674096,
    starts_monthly: 974279,
    starts_annual: 674279,
    finish_monthly: 974287,
    finish_annual: 674287,
    start_total_q: 573135,
    start_total_a: 573088,
    start_reconstruction_q: 573142,
    start_reconstruction_a: 573096,
    start_additions_q: 573149,
    start_additions_a: 573104,
    start_TAMA38q: 573156,
    start_TAMA38a: 573112,
    destroyed_apartments_q: 573167,
    destroyed_apartments_a: 573175,
  },
};

const REGION_SERIES_PAIRS = [
  ["build_monthly", "build_annual", false],
  ["active_quarterly", "active_annual", true],
  ["new_monthly", "new_annual", false],
  ["secondhand_monthly", "secondhand_annual", false],
  ["total_monthly", "total_annual", false],
  ["starts_monthly", "starts_annual", false],
  ["finish_monthly", "finish_annual", false],
  ["start_total_q", "start_total_a", false],
  ["start_reconstruction_q", "start_reconstruction_a", false],
  ["start_additions_q", "start_additions_a", false],
  ["start_TAMA38q", "start_TAMA38a", false],
  ["destroyed_apartments_q", "destroyed_apartments_a", false],
] as const;

const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_YEAR = new Date().getUTCFullYear() - 10;
const CBS_CACHE_KEY = "cbs-source-v3";

type CbsSnapshot = {
  generatedAt: string;
  cpi: PricePoint[];
  housing: PricePoint[];
  newDwelling: PricePoint[];
  stock: NumericPoint[];
  regionalPrices: Record<string, PricePoint[]>;
  regionSeries: Record<string, Record<string, NumericPoint[]>>;
};

const SERIES_LABELS: Record<string, string> = {
  cpi: "מדד המחירים לצרכן",
  housing: "מדד מחירי הדירות",
  newDwelling: "מדד מחירי דירות חדשות",
  stock: "יתרת מלאי דירות",
  build_monthly: "היתרי בנייה",
  build_annual: "היתרי בנייה שנתי",
  active_quarterly: "בבנייה פעילה",
  active_annual: "בבנייה פעילה שנתי",
  new_monthly: "דירות חדשות שנמכרו",
  new_annual: "דירות חדשות שנמכרו שנתי",
  secondhand_monthly: "דירות יד שנייה שנמכרו",
  secondhand_annual: "דירות יד שנייה שנמכרו שנתי",
  total_monthly: "סך הדירות שנמכרו",
  total_annual: "סך הדירות שנמכרו שנתי",
  starts_monthly: "התחלות בנייה",
  starts_annual: "התחלות בנייה שנתי",
  finish_monthly: "גמר בנייה",
  finish_annual: "גמר בנייה שנתי",
  start_total_q: "דירות בבניינים שנבנו מחדש",
  start_total_a: "דירות בבניינים שנבנו מחדש שנתי",
  start_reconstruction_q: 'תמ"א 38/2 ופינוי בינוי',
  start_reconstruction_a: 'תמ"א 38/2 ופינוי בינוי שנתי',
  start_additions_q: "תוספות לבניינים קיימים",
  start_additions_a: "תוספות לבניינים קיימים שנתי",
  start_TAMA38q: 'תוספות לפי תמ"א 38',
  start_TAMA38a: 'תוספות לפי תמ"א 38 שנתי',
  destroyed_apartments_q: "דירות שנהרסו",
  destroyed_apartments_a: "דירות שנהרסו שנתי",
};

function safeNumber(value: unknown): number {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthLabel(rawDate: string) {
  const parts = rawDate.split("-");
  if (parts.length === 2) {
    return `${parts[1]}-${parts[0]}`;
  }

  return rawDate;
}

function filterRawPointsToLastYears<T extends { rawDate: string }>(points: T[]) {
  const minPrefix = String(MIN_YEAR);
  return points.filter((point) => point.rawDate.slice(0, 4) >= minPrefix);
}

function filterPricePointsToLastYears(points: PricePoint[]) {
  const minPrefix = String(MIN_YEAR);
  return points.filter((point) => point.date.slice(0, 4) >= minPrefix);
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<U>,
) {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );

  return results;
}

async function fetchJson(input: string, init?: RequestInit) {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, {
        cache: "no-store",
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        ...init,
      });

      if (!response.ok) {
        throw new Error(`CBS request failed: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("CBS request failed");

      if (attempt < maxAttempts) {
        await wait(attempt * 400);
      }
    }
  }

  throw lastError ?? new Error("CBS request failed");
}

type CbsSeriesResponse = {
  DataSet?: {
    Series?: Array<{
      obs?: Array<{
        TimePeriod?: string;
        Value?: unknown;
      }>;
    }> | {
      obs?: Array<{
        TimePeriod?: string;
        Value?: unknown;
      }>;
    };
    paging?: {
      current_page?: number;
      last_page?: number;
      next_url?: string | null;
    };
  };
};

export async function fetchPriceSeries(code: number): Promise<PricePoint[]> {
  const url = PRICE_API.replace("{code}", String(code)).replace("{months}", String(LAST_MONTHS));

  try {
    const data = await fetchJson(url);
    const entries = data?.month?.[0]?.date;

    if (!Array.isArray(entries)) {
      return [];
    }

    return filterPricePointsToLastYears(
      entries
      .slice()
      .sort((left, right) => {
        const leftValue = `${left?.year ?? 0}-${String(left?.month ?? 0).padStart(2, "0")}`;
        const rightValue = `${right?.year ?? 0}-${String(right?.month ?? 0).padStart(2, "0")}`;
        return leftValue.localeCompare(rightValue);
      })
      .map((entry) => ({
        date: `${entry?.year}-${String(entry?.month ?? 1).padStart(2, "0")}`,
        percent: safeNumber(entry?.percent),
        value: safeNumber(entry?.currBasevalue),
        base: entry?.currBasebaseDesc ?? null,
      })),
    );
  } catch {
    return [];
  }
}

export async function fetchStockSeries(seriesId: number): Promise<RawSeriesPoint[]> {
  if (!seriesId) {
    return [];
  }

  const baseUrl = SERIES_API.replace("{id}", String(seriesId));

  try {
    const allObservations: Array<{ rawDate: string; value: number }> = [];
    let nextUrl: string | null = `${baseUrl}&Page=1&PageSize=1000`;
    let pageGuard = 0;

    while (nextUrl && pageGuard < 20) {
      const data = (await fetchJson(nextUrl)) as CbsSeriesResponse;
      const rawSeries = data?.DataSet?.Series;
      const seriesList = Array.isArray(rawSeries) ? rawSeries : rawSeries ? [rawSeries] : [];
      const observations = seriesList[0]?.obs;

      if (Array.isArray(observations)) {
        allObservations.push(
          ...observations.map((item) => ({
            rawDate: String(item?.TimePeriod ?? ""),
            value: safeNumber(item?.Value),
          })),
        );
      }

      const paging = data?.DataSet?.paging;
      const nextPageUrl = paging?.next_url?.replace("//series", "/series") ?? null;
      nextUrl = paging?.current_page === paging?.last_page ? null : nextPageUrl;
      pageGuard += 1;
    }

    return filterRawPointsToLastYears(
      allObservations
      .filter((item) => item.rawDate)
      .sort((left, right) => left.rawDate.localeCompare(right.rawDate)),
    );
  } catch {
    return [];
  }
}

export async function fetchNewDwellingSeries(): Promise<PricePoint[]> {
  const now = new Date();
  const payload = {
    model: null,
    dataTypeId: "1",
    subjectId: "167",
    SeriesCodes: [70000],
    Fyear: MIN_YEAR,
    Tyear: now.getUTCFullYear(),
    IndicesTypeOption: "Prices",
    BasePeriodOption: "Selected",
    BasePeriodId: "2018-11-28",
    Language: "Hebrew",
    Fmonth: 1,
    Tmonth: now.getUTCMonth() + 1,
  };

  const formData = new URLSearchParams({
    query: JSON.stringify(payload),
    mode: "Init",
  });

  try {
    const data = await fetchJson(NEW_DWELLING_API, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": "https://boardsgenerator.cbs.gov.il",
        "Referer": "https://boardsgenerator.cbs.gov.il/pages/Prices/WizardPage.aspx?r=",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "X-TS-AJAX-Request": "true",
      },
      body: formData.toString(),
    });

    const rows = Array.isArray(data?.data)
      ? data.data.filter((row: { Item?: string }) => String(row?.Item ?? "").includes("70000"))
      : [];

    const flatData: Array<{ date: string; value: number }> = [];

    for (const row of rows) {
      const year = row?.Year;
      if (!year) {
        continue;
      }

      for (let month = 1; month <= 12; month += 1) {
        const value = row?.[`M${month}`];

        if (value == null) {
          continue;
        }

        flatData.push({
          date: `${year}-${String(month).padStart(2, "0")}`,
          value: safeNumber(value),
        });
      }
    }

    flatData.sort((left, right) => left.date.localeCompare(right.date));

    return filterPricePointsToLastYears(flatData.map((point, index) => {
      const previous = flatData[index - 1];
      const percent =
        previous && previous.value !== 0 ? ((point.value - previous.value) / previous.value) * 100 : 0;

      return {
        date: point.date,
        value: point.value,
        percent,
        base: "מדד 2018",
      };
    }));
  } catch {
    return [];
  }
}

function calculatePartialYear(annualData: RawSeriesPoint[], monthlyData: RawSeriesPoint[]) {
  if (!monthlyData.length) {
    return annualData;
  }

  const sortedMonthly = monthlyData.slice().sort((left, right) => left.rawDate.localeCompare(right.rawDate));
  const lastMonthly = sortedMonthly.at(-1);

  if (!lastMonthly) {
    return annualData;
  }

  const lastYear = lastMonthly.rawDate.slice(0, 4);
  const currentYearSum = sortedMonthly.reduce((sum, item) => {
    return item.rawDate.startsWith(lastYear) ? sum + item.value : sum;
  }, 0);

  const nextAnnual = annualData.slice();
  const existingIndex = nextAnnual.findIndex((item) => item.rawDate.startsWith(lastYear));
  const nextPoint: RawSeriesPoint = {
    rawDate: lastMonthly.rawDate,
    label: monthLabel(lastMonthly.rawDate),
    value: currentYearSum,
    isPartial: true,
  };

  if (existingIndex === -1) {
    nextAnnual.push(nextPoint);
  } else {
    nextAnnual[existingIndex] = nextPoint;
  }

  return nextAnnual.sort((left, right) => left.rawDate.localeCompare(right.rawDate));
}

function calculateActiveAnnualLabel(annualData: RawSeriesPoint[], quarterlyData: RawSeriesPoint[]) {
  if (!quarterlyData.length) {
    return annualData;
  }

  const sortedQuarterly = quarterlyData.slice().sort((left, right) => left.rawDate.localeCompare(right.rawDate));
  const lastQuarter = sortedQuarterly.at(-1);

  if (!lastQuarter) {
    return annualData;
  }

  const year = lastQuarter.rawDate.slice(0, 4);
  const nextAnnual = annualData.slice();
  const existingIndex = nextAnnual.findIndex((item) => item.rawDate.startsWith(year));
  const nextPoint: RawSeriesPoint = {
    rawDate: year,
    label: monthLabel(lastQuarter.rawDate),
    value: lastQuarter.value,
    isPartial: true,
  };

  if (existingIndex === -1) {
    nextAnnual.push(nextPoint);
  } else {
    nextAnnual[existingIndex] = nextPoint;
  }

  return nextAnnual.sort((left, right) => left.rawDate.localeCompare(right.rawDate));
}

function aggregateFlowToQuarterly(data: RawSeriesPoint[]) {
  if (!data.length) {
    return data;
  }

  const quarters = new Map<string, { sum: number; lastDate: string }>();

  for (const item of data) {
    if (item.rawDate.length < 7) {
      continue;
    }

    const year = item.rawDate.slice(0, 4);
    const month = Number(item.rawDate.slice(5, 7));

    if (!Number.isFinite(month) || month < 1) {
      continue;
    }

    const quarter = Math.floor((month - 1) / 3) + 1;
    const key = `${year}-Q${quarter}`;
    const existing = quarters.get(key);

    if (!existing) {
      quarters.set(key, {
        sum: item.value,
        lastDate: item.rawDate,
      });
      continue;
    }

    existing.sum += item.value;
    if (item.rawDate > existing.lastDate) {
      existing.lastDate = item.rawDate;
    }
  }

  return Array.from(quarters.entries())
    .map(([key, value]) => {
      const [year, quarter] = key.split("-Q");
      return {
        rawDate: value.lastDate,
        label: `Q${quarter}-${year}`,
        value: value.sum,
      };
    })
    .sort((left, right) => left.rawDate.localeCompare(right.rawDate));
}

function serializeNumericSeries(codeType: string, data: RawSeriesPoint[]): NumericPoint[] {
  return data.map((point) => ({
    rawDate: point.rawDate,
    label: point.label ?? (/annual|_a/.test(codeType) ? point.rawDate.slice(0, 4) : point.rawDate),
    value: point.value,
    isPartial: point.isPartial,
  }));
}

async function fetchDashboardSummaryFresh(): Promise<DashboardSummary> {
  const snapshot = await fetchCbsSnapshot();

  return {
    title: "דשבורד מדדי דיור ומחירים - למ״ס",
    generatedAt: snapshot.generatedAt,
    availableRegions: Object.keys(REGION_CODES),
    compareRegions: Object.keys(PRICE_REGION_CODES),
    topSeries: {
      cpi: snapshot.cpi,
      housing: snapshot.housing,
      newDwelling: snapshot.newDwelling,
      stock: snapshot.stock,
    },
    regionalPrices: snapshot.regionalPrices,
  };
}

async function fetchRegionDashboardFresh(region: string): Promise<RegionDashboard> {
  if (!REGION_CODES[region]) {
    throw new Error(`Unknown region: ${region}`);
  }
  const snapshot = await fetchCbsSnapshot();

  return {
    region,
    generatedAt: snapshot.generatedAt,
    series: snapshot.regionSeries[region] ?? {},
  };
}

function priceRows(sourceKey: string, label: string, points: PricePoint[], region: string | null): SourceTableRow[] {
  return points.map((point) => ({
    source: "cbs",
    series_key: sourceKey,
    series_label: label,
    observation_date: point.date,
    value: point.value,
    change: point.percent,
    unit: "index",
    category: region ? "regional-prices" : "top-series",
    region,
    base: point.base ?? null,
    is_partial: false,
  }));
}

function numericRows(
  sourceKey: string,
  label: string,
  points: NumericPoint[],
  region: string | null,
  category: string,
): SourceTableRow[] {
  return points.map((point) => ({
    source: "cbs",
    series_key: sourceKey,
    series_label: label,
    observation_date: point.rawDate,
    value: point.value,
    change: null,
    unit: null,
    category,
    region,
    base: null,
    is_partial: Boolean(point.isPartial),
  }));
}

async function fetchCbsSnapshotFresh(): Promise<{ snapshot: CbsSnapshot; rows: SourceTableRow[] }> {
  const compareRegions = Object.keys(PRICE_REGION_CODES);
  const [cpi, housing, newDwelling, stock, regionalPriceEntries] = await Promise.all([
    fetchPriceSeries(CPI_CODE),
    fetchPriceSeries(HOUSING_INDEX_CODE),
    fetchNewDwellingSeries(),
    fetchStockSeries(STOCK_SERIES_ID),
    Promise.all(
      compareRegions.map(async (region) => {
        const code = PRICE_REGION_CODES[region];
        const data = await fetchPriceSeries(code);
        return [region, data] as const;
      }),
    ),
  ]);
  const regionEntries = await mapWithConcurrency(
    Object.entries(REGION_CODES),
    2,
    async ([region, regionCodes]) => {
      // CBS starts/finals series drop data when hit with a wide request burst; keep this bounded.
      const entries = await mapWithConcurrency(
        REGION_SERIES_PAIRS,
        3,
        async ([monthlyKey, annualKey, isActive]) => {
          const [monthlyRaw, annualRaw] = await Promise.all([
            fetchStockSeries(regionCodes[monthlyKey]),
            fetchStockSeries(regionCodes[annualKey]),
          ]);

          const monthlySeries =
            monthlyKey.endsWith("_q") && !isActive ? aggregateFlowToQuarterly(monthlyRaw) : monthlyRaw;
          const annualSeries = isActive
            ? calculateActiveAnnualLabel(annualRaw, monthlySeries)
            : calculatePartialYear(annualRaw, monthlySeries);

          return [
            [monthlyKey, serializeNumericSeries(monthlyKey, monthlySeries)],
            [annualKey, serializeNumericSeries(annualKey, annualSeries)],
          ] as const;
        },
      );

      return [region, Object.fromEntries(entries.flat())] as const;
    },
  );

  const generatedAt = new Date().toISOString();
  const regionalPrices = Object.fromEntries(regionalPriceEntries);
  const regionSeries = Object.fromEntries(regionEntries);
  const stockSeries = serializeNumericSeries("stock", stock);
  const rows: SourceTableRow[] = [
    ...priceRows("cpi", SERIES_LABELS.cpi, cpi, null),
    ...priceRows("housing", SERIES_LABELS.housing, housing, null),
    ...priceRows("newDwelling", SERIES_LABELS.newDwelling, newDwelling, null),
    ...numericRows("stock", SERIES_LABELS.stock, stockSeries, null, "top-series"),
    ...Object.entries(regionalPrices).flatMap(([region, points]) =>
      priceRows(`regional_price_${region}`, `מחירי דירות - ${region}`, points, region),
    ),
    ...Object.entries(regionSeries).flatMap(([region, seriesMap]) =>
      Object.entries(seriesMap).flatMap(([seriesKey, points]) =>
        numericRows(
          seriesKey,
          SERIES_LABELS[seriesKey] ?? seriesKey,
          points,
          region,
          "region-series",
        ),
      ),
    ),
  ];

  return {
    snapshot: {
      generatedAt,
      cpi,
      housing,
      newDwelling,
      stock: stockSeries,
      regionalPrices,
      regionSeries,
    },
    rows,
  };
}

async function fetchCbsSnapshot() {
  return withWeeklyBlobArtifacts(CBS_CACHE_KEY, async () => {
    const { snapshot, rows } = await fetchCbsSnapshotFresh();
    return {
      value: snapshot,
      csv: toCsv(rows),
    };
  });
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return fetchDashboardSummaryFresh();
}

export async function fetchRegionDashboard(region: string): Promise<RegionDashboard> {
  return fetchRegionDashboardFresh(region);
}
