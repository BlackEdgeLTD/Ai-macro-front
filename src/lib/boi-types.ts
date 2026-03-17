export type BoiPoint = {
  date: string;
  label: string;
  value: number;
};

export type BoiSeries = {
  key: string;
  label: string;
  unit: string | null;
  category: string | null;
  points: BoiPoint[];
};

export type BoiDashboardSummary = {
  title: string;
  generatedAt: string;
  series: BoiSeries[];
};
