"use client";

import { useMemo } from "react";
import type { ChartData } from "chart.js";

import type { NadlanData } from "@/types/nadlan";

import { ChartSurface, defaultChartOptions } from "../shared/chart-surface";
import {
  fmtCurrency,
  fmtNum,
  fmtSignedPct,
  preciseFormatter,
} from "../shared/formatters";

const REGION_COLORS: Record<string, string> = {
  "מרכז": "#dc2626",
  "ירושלים": "#7c3aed",
  "חיפה והצפון": "#0891b2",
  "שפלה ויהודה": "#ea580c",
  "פריפריה": "#047857",
};

type KpiVariant = "" | "good" | "warn" | "bad";

function Kpi({
  label,
  value,
  detail,
  yoy,
  variant = "",
}: {
  label: string;
  value: string;
  detail?: string;
  yoy?: number | null;
  variant?: KpiVariant;
}) {
  return (
    <div className={`dense-kpi${variant ? ` ${variant}` : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {(detail || yoy != null) && (
        <div className="delta">
          {yoy != null && (
            <span className={yoy >= 0 ? "dense-yoy-pos" : "dense-yoy-neg"}>
              {fmtSignedPct(yoy)}
            </span>
          )}
          {yoy != null && detail ? " · " : null}
          {detail}
        </div>
      )}
    </div>
  );
}

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

  const priceOptions = useMemo(() => {
    const base = defaultChartOptions("line", true);
    return {
      ...base,
      scales: {
        x: base.scales!.x,
        y: {
          ...base.scales!.y,
          ticks: {
            color: "#475569",
            callback: (v: number | string) => `${(Number(v) / 1_000_000).toFixed(1)}M`,
          },
        },
      },
    };
  }, []);

  const regionOptions = useMemo(() => {
    const base = defaultChartOptions("line", true);
    return {
      ...base,
      scales: {
        x: base.scales!.x,
        y: {
          ...base.scales!.y,
          ticks: {
            color: "#475569",
            callback: (v: number | string) => `${(Number(v) / 1000).toFixed(0)}K`,
          },
        },
      },
    };
  }, []);

  return (
    <>
      <section className="dense-section">
        <h2>📌 סטטיסטיקות מפתח — 12 חודשים אחרונים</h2>
        <div className="dense-grid g-6">
          <Kpi
            label="מחיר ממוצע"
            value={fmtCurrency(k.avg12)}
            yoy={k.avgYoy}
            detail="YoY"
          />
          <Kpi
            label="מחיר חציוני"
            value={fmtCurrency(k.med12)}
            yoy={k.medYoy}
            detail="YoY"
          />
          <Kpi
            label='₪/מ״ר ארצי'
            value={fmtCurrency(k.pps12)}
            yoy={k.ppsYoy}
            detail="YoY"
          />
          <Kpi
            label="נפח עסקאות"
            value={fmtNum(k.vol12)}
            yoy={k.volYoy}
            detail="YoY"
          />
          <Kpi
            label="תשואת שכירות"
            value={avgYield != null ? `${preciseFormatter.format(avgYield)}%` : "-"}
            detail="ברוטו שנתי"
            variant="good"
          />
          <Kpi
            label="Affordability"
            value={k.yrs2buy ? `${k.yrs2buy.toFixed(1)} שנים` : "-"}
            detail="מחיר ÷ הכנסה"
            variant="warn"
          />
        </div>
      </section>

      <section className="dense-section">
        <h2>💡 תובנות מאקרו</h2>
        <div className="dense-grid g-3">
          {data.insights.map((ins, i) => (
            <div key={i} className="dense-insight">
              <div className="title">
                <span aria-hidden style={{ marginInlineEnd: 6 }}>
                  {ins.i}
                </span>
                {ins.t}
              </div>
              <div
                className="body"
                dangerouslySetInnerHTML={{ __html: ins.b }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="dense-section">
        <h2>📈 מגמת מחיר ונפח (שנתי)</h2>
        <div className="dense-grid g-2">
          <div className="dense-chart-box-md">
            <ChartSurface
              title=""
              type="line"
              data={priceChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
              options={priceOptions}
              height={270}
            />
          </div>
          <div className="dense-chart-box-md">
            <ChartSurface
              title=""
              type="bar"
              data={volumeChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
              height={270}
            />
          </div>
        </div>
      </section>

      <section className="dense-section">
        <h2>🏛️ מרכז vs פריפריה — מגמה</h2>
        <div className="dense-chart-box-lg">
          <ChartSurface
            title=""
            type="line"
            data={regionChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
            options={regionOptions}
            height={330}
          />
        </div>
      </section>
    </>
  );
}
