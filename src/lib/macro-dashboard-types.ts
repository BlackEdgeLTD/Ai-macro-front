import type { BoiDashboardSummary } from "@/lib/boi-types";
import type { DashboardSummary } from "@/lib/cbs-types";

export type MacroDashboardMetric = {
  key: string;
  label: string;
  source: "boi" | "cbs";
  date: string | null;
  value: number | null;
  unit: string | null;
};

export type MacroDashboardSection = {
  title: string;
  metrics: MacroDashboardMetric[];
};

export type MacroDashboardSummary = {
  title: string;
  generatedAt: string;
  sources: {
    boiGeneratedAt: string | null;
    cbsGeneratedAt: string | null;
  };
  sections: MacroDashboardSection[];
  boi: BoiDashboardSummary;
  cbs: DashboardSummary;
};
