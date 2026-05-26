// Data shape for the compressed Israeli real-estate dataset shipped at
// /public/nadlan/data.v1.json.gz. Field names match what the source
// nadlan_unified.html consumes 1:1; do not rename without re-exporting the blob.

export type RoomTypeKey = "0" | "1" | "2" | "3";

export interface City {
  n: string;
  lat: number;
  lon: number;
  cnt: number;
  avg: number;
  pps: number;
  g: string;
}

export interface Neighborhood {
  c: number;
  n: string;
  cnt: number;
  avg: number;
  pps: number;
  sqm: number;
  r: number;
}

export type TxnRow = [
  ym: number,
  cityIdx: number,
  ptypeIdx: number,
  sqm: number,
  rooms: number,
  priceK: number,
  pps: number,
];

export interface Kpi {
  avg12: number;
  avgYoy: number;
  med12: number;
  medYoy: number;
  pps12: number;
  ppsYoy: number;
  vol12: number;
  volYoy: number;
  wage: number;
  yrs2buy: number;
  total_txns: number;
}

export interface AnnualRow {
  y: number;
  cnt: number;
  avg: number;
  med: number;
  pps: number;
}

export type PtypeBreakdown = Record<string, number>;

export type PtbyByYear = Record<string, PtypeBreakdown>;

export type RegionPoints = [year: number, pricePerSqm: number][];

export type RegionMap = Record<string, RegionPoints>;

export interface RentSettlementGeo {
  id: number;
  n: string;
  lat: number;
  lon: number;
  price: number;
}

export interface RentNeighborhoodGeo {
  id: number;
  n: string;
  c: string;
  lat: number;
  lon: number;
  price: number;
}

export type RentTrendPoint = [ym: number, price: number];

export type RentTrend = Record<RoomTypeKey, RentTrendPoint[]>;

export interface RentSettlement {
  n: string;
  rent: number;
  g: number | null;
}

export interface YieldRow {
  n: string;
  y: number;
  pps: number;
  avg: number;
  rent: number;
}

export interface AffordRow {
  n: string;
  yr: number;
  avg: number;
  wage: number;
}

export interface Quality {
  total: number;
  clean: number;
  future: number;
  high_pps: number;
  low_price: number;
  huge_area: number;
}

export interface OutlierRow {
  d: string | null;
  c: string | null;
  nbh: string | null;
  addr: string | null;
  pt: string | null;
  sqm: number | null;
  p: number;
  pps: number;
}

export type SettlementTrendsByIdx = Record<string, Record<RoomTypeKey, RentTrendPoint[]>>;

export type SettlementSummaryByIdx = Record<
  string,
  Record<RoomTypeKey, { p: number; g: number | null; n: number }>
>;

export type Growth5y = Record<string, number>;

export interface InsightRow {
  i: string;
  t: string;
  b: string;
}

export interface NadlanData {
  cities: City[];
  ptypes: string[];
  txns: TxnRow[];
  nbhs: Neighborhood[];
  kpi: Kpi;
  annual: AnnualRow[];
  ptby: PtbyByYear;
  region: RegionMap;
  rent_settlements_geo: RentSettlementGeo[];
  rent_neighborhoods_geo: RentNeighborhoodGeo[];
  settlement_trends: SettlementTrendsByIdx;
  settlement_summary: SettlementSummaryByIdx;
  rent_trend: RentTrend;
  rent_settlements: RentSettlement[];
  yields: YieldRow[];
  afford: AffordRow[];
  quality: Quality;
  outliers: OutlierRow[];
  growth5y: Growth5y;
  insights: InsightRow[];
}
