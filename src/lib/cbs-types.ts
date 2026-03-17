export type PricePoint = {
  date: string;
  value: number;
  percent: number;
  base?: string | null;
};

export type NumericPoint = {
  rawDate: string;
  label: string;
  value: number;
  isPartial?: boolean;
};

export type DashboardSummary = {
  title: string;
  generatedAt: string;
  availableRegions: string[];
  compareRegions: string[];
  topSeries: {
    cpi: PricePoint[];
    housing: PricePoint[];
    newDwelling: PricePoint[];
    stock: NumericPoint[];
  };
  regionalPrices: Record<string, PricePoint[]>;
};

export type RegionDashboard = {
  region: string;
  generatedAt: string;
  series: Record<string, NumericPoint[]>;
};
