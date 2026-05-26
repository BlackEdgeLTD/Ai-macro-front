"use client";

import dynamic from "next/dynamic";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import type { ReactNode } from "react";

import { ChartErrorBoundary } from "./chart-error-boundary";

const ReactChart = dynamic(
  () => import("react-chartjs-2").then((m) => m.Chart),
  { ssr: false },
);

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

export type ChartKind = "line" | "bar" | "scatter" | "doughnut";

export function defaultChartOptions<T extends ChartKind>(
  kind: T,
  showLegend = false,
): ChartOptions<T> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: showLegend,
        position: "top",
        labels: { color: "#0f172a", boxWidth: 10, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleColor: "#f8fafc",
        bodyColor: "#e2e8f0",
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(148, 163, 184, 0.15)" },
        ticks: {
          color: "#475569",
          maxRotation: kind === "bar" ? 0 : 35,
          minRotation: 0,
        },
      },
      y: {
        grid: { color: "rgba(148, 163, 184, 0.15)" },
        ticks: { color: "#475569" },
      },
    },
  } as unknown as ChartOptions<T>;
}

type ChartSurfaceProps = {
  title: string;
  subtitle?: string;
  type: ChartKind;
  data: ChartData<ChartKind>;
  options?: ChartOptions<ChartKind>;
  height?: number;
  emptyMessage?: string;
  children?: ReactNode;
};

export function ChartSurface({
  title,
  subtitle,
  type,
  data,
  options,
  height = 288,
  emptyMessage = "אין נתונים להצגה",
  children,
}: ChartSurfaceProps) {
  const hasData =
    (data.labels?.length ?? 0) > 0 ||
    data.datasets.some((ds) =>
      Array.isArray(ds.data) && ds.data.length > 0
        ? ds.data.some((v) => v != null)
        : false,
    );

  const resolvedOptions = options ?? defaultChartOptions(type, data.datasets.length > 1);

  return (
    <article className="chart-panel p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#13202b]">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-[#5d6b7c]">{subtitle}</p> : null}
        </div>
        {children ? <div className="flex items-center gap-2">{children}</div> : null}
      </div>

      {hasData ? (
        <div style={{ height }}>
          <ChartErrorBoundary title={title}>
            <ReactChart type={type} data={data} options={resolvedOptions} />
          </ChartErrorBoundary>
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-3xl border border-dashed border-[rgba(15,23,42,0.12)] bg-[rgba(241,245,249,0.72)] text-sm text-[#5d6b7c]"
          style={{ height }}
        >
          {emptyMessage}
        </div>
      )}
    </article>
  );
}
