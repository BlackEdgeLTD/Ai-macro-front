"use client";

import { useMemo } from "react";
import type { ChartData } from "chart.js";

import type { NadlanData } from "@/types/nadlan";
import { Card, CardContent } from "@/components/ui/card";

import { ChartSurface, defaultChartOptions } from "../shared/chart-surface";
import { KpiCard } from "../shared/kpi-card";
import { fmtCurrency, fmtNum, preciseFormatter } from "../shared/formatters";

const REGION_COLORS: Record<string, string> = {
  "מרכז": "#dc2626",
  "ירושלים": "#7c3aed",
  "חיפה והצפון": "#0891b2",
  "שפלה ויהודה": "#ea580c",
  "פריפריה": "#047857",
};

type Props = { data: NadlanData };

export function OverviewTab({ data }: Props) {
  const k = data.kpi;

  const avgYield = useMemo(() => {
    if (!data.yields.length) return null;
    const sum = data.yields.reduce((s, y) => s + y.y, 0);
    return sum / data.yields.length;
  }, [data.yields]);

  const priceChart = useMemo<ChartData<"line">>(
    () => ({
      labels: data.annual.map((a) => a.y),
      datasets: [
        {
          label: "ממוצע",
          data: data.annual.map((a) => a.avg),
          borderColor: "#dc2626",
          backgroundColor: "rgba(220,38,38,0.08)",
          borderWidth: 2.5,
          tension: 0.3,
        },
        {
          label: "חציוני",
          data: data.annual.map((a) => a.med),
          borderColor: "#1e40af",
          backgroundColor: "rgba(30,64,175,0.08)",
          borderWidth: 2.5,
          tension: 0.3,
        },
      ],
    }),
    [data.annual],
  );

  const volumeChart = useMemo<ChartData<"bar">>(
    () => ({
      labels: data.annual.map((a) => a.y),
      datasets: [
        {
          label: "עסקאות",
          data: data.annual.map((a) => a.cnt),
          backgroundColor: "#3b82f6",
        },
      ],
    }),
    [data.annual],
  );

  const regionChart = useMemo<ChartData<"line">>(() => {
    const allYears = new Set<number>();
    Object.values(data.region).forEach((arr) =>
      arr.forEach((p) => allYears.add(p[0])),
    );
    const yrs = [...allYears].sort((a, b) => a - b);
    const datasets = Object.entries(data.region).map(([name, pts]) => {
      const map = Object.fromEntries(pts.map((p) => [p[0], p[1]]));
      return {
        label: name,
        data: yrs.map((y) => (map[y] != null ? (map[y] as number) : null)),
        borderColor: REGION_COLORS[name] ?? "#888",
        backgroundColor: "transparent",
        borderWidth: 2.5,
        tension: 0.25,
        spanGaps: true,
      };
    });
    return { labels: yrs, datasets };
  }, [data.region]);

  const priceOptions = useMemo(
    () => ({
      ...defaultChartOptions("line", true),
      scales: {
        x: defaultChartOptions("line").scales!.x,
        y: {
          ...defaultChartOptions("line").scales!.y,
          ticks: {
            color: "#475569",
            callback: (v: number | string) => `${(Number(v) / 1_000_000).toFixed(1)}M`,
          },
        },
      },
    }),
    [],
  );

  const volumeOptions = useMemo(() => defaultChartOptions("bar", false), []);

  const regionOptions = useMemo(
    () => ({
      ...defaultChartOptions("line", true),
      scales: {
        x: defaultChartOptions("line").scales!.x,
        y: {
          ...defaultChartOptions("line").scales!.y,
          ticks: {
            color: "#475569",
            callback: (v: number | string) => `${(Number(v) / 1000).toFixed(0)}K`,
          },
        },
      },
    }),
    [],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="מחיר ממוצע"
          value={fmtCurrency(k.avg12)}
          detail="ב-12 חודשים"
          yoy={k.avgYoy}
          accent="linear-gradient(135deg, #dc2626 0%, #f97316 100%)"
        />
        <KpiCard
          label="מחיר חציוני"
          value={fmtCurrency(k.med12)}
          detail="ב-12 חודשים"
          yoy={k.medYoy}
          accent="linear-gradient(135deg, #1e40af 0%, #2563eb 100%)"
        />
        <KpiCard
          label='₪/מ"ר ארצי'
          value={fmtCurrency(k.pps12)}
          detail="ממוצע משוקלל"
          yoy={k.ppsYoy}
          accent="linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)"
        />
        <KpiCard
          label="נפח עסקאות"
          value={fmtNum(k.vol12)}
          detail="ב-12 חודשים"
          yoy={k.volYoy}
          accent="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
        />
        <KpiCard
          label="תשואת שכירות"
          value={avgYield != null ? `${preciseFormatter.format(avgYield)}%` : "-"}
          detail="ברוטו שנתי, ממוצע ערים"
          accent="linear-gradient(135deg, #047857 0%, #10b981 100%)"
        />
        <KpiCard
          label="Affordability"
          value={k.yrs2buy ? `${k.yrs2buy.toFixed(1)} שנים` : "-"}
          detail="מחיר ÷ הכנסה ארצית"
          accent="linear-gradient(135deg, #b45309 0%, #f59e0b 100%)"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.insights.map((ins, i) => (
          <Card key={i} className="surface-panel border-0 shadow-none">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#13202b]">
                <span aria-hidden className="text-xl">
                  {ins.i}
                </span>
                {ins.t}
              </p>
              <p
                className="mt-2 text-sm text-[#5d6b7c]"
                dangerouslySetInnerHTML={{ __html: ins.b }}
              />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartSurface
          title="מחיר ממוצע vs חציוני (₪)"
          subtitle="מגמה שנתית"
          type="line"
          data={priceChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
          options={priceOptions}
        />
        <ChartSurface
          title="נפח עסקאות שנתי"
          subtitle="כל הערים בכיסוי"
          type="bar"
          data={volumeChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
          options={volumeOptions}
        />
      </section>

      <ChartSurface
        title="מגמת אזורים ארציים"
        subtitle='₪/מ"ר לפי קבוצת אזור, שנתי'
        type="line"
        data={regionChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
        options={regionOptions}
        height={360}
      />
    </div>
  );
}
