export type CustomDashboardChartType = "line" | "bar";

export type CustomDashboardDataset = {
  key: string;
  label: string;
  unit: string | null;
  data: Array<number | null>;
};

export type CustomDashboardResponse = {
  prompt: string;
  title: string;
  description: string;
  chartType: CustomDashboardChartType;
  labels: string[];
  datasets: CustomDashboardDataset[];
  matchedSeries: string[];
  correlation: number | null;
};
