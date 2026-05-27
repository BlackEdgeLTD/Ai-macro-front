"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";

import type { NadlanData } from "@/types/nadlan";

import { ChartSurface, defaultChartOptions } from "../shared/chart-surface";
import { fmtCurrency } from "../shared/formatters";

const PTYPE_COLORS: Record<string, string> = {
  "דירה": "#3b82f6",
  "בנין": "#10b981",
  "קרקע": "#f59e0b",
  "דירת גן": "#8b5cf6",
  "דירת גג (פנטהאוז)": "#ec4899",
  "חד משפחתי (וילה)": "#06b6d4",
  "משרד": "#6b7280",
  "עסק": "#94a3b8",
  "אחר": "#cbd5e1",
  "לא צוין": "#e2e8f0",
};

type Props = { data: NadlanData };

export function ComparisonsTab({ data }: Props) {
  const scatterChart = useMemo<ChartData<"scatter">>(
    () => ({
      datasets: [
        {
          label: "ערים",
          data: data.yields.map((y) => ({ x: y.pps, y: y.y })),
          backgroundColor: "rgba(59,130,246,0.6)",
          pointRadius: 8,
        },
      ],
    }),
    [data.yields],
  );

  const scatterOptions = useMemo<ChartOptions<"scatter">>(() => {
    const base = defaultChartOptions("scatter", false);
    const cityNames = data.yields.map((y) => y.n);
    return {
      ...base,
      scales: {
        x: {
          ...base.scales!.x,
          title: { display: true, text: 'מחיר/מ"ר (₪)' },
          ticks: {
            ...(base.scales!.x as { ticks?: object }).ticks,
            callback: (v) => (Number(v) / 1000).toFixed(0) + "K",
          },
        },
        y: {
          ...base.scales!.y,
          title: { display: true, text: "תשואה %" },
          ticks: {
            ...(base.scales!.y as { ticks?: object }).ticks,
            callback: (v) => Number(v).toFixed(1) + "%",
          },
        },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins!.tooltip,
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw as { x: number; y: number };
              return `${cityNames[ctx.dataIndex]}: ${p.y.toFixed(2)}% @ ${fmtCurrency(p.x)}/מ"ר`;
            },
          },
        },
      },
    };
  }, [data.yields]);

  const ptypeChart = useMemo<ChartData<"bar">>(() => {
    const years = Object.keys(data.ptby)
      .map(Number)
      .sort((a, b) => a - b);
    const typeSet = new Set<string>();
    years.forEach((y) => {
      Object.keys(data.ptby[String(y)]).forEach((t) => typeSet.add(t));
    });
    const types = [...typeSet];
    const datasets = types.map((t) => ({
      label: t,
      data: years.map((y) => {
        const row = data.ptby[String(y)];
        const tot = Object.values(row).reduce((a, b) => a + b, 0);
        return tot ? ((row[t] ?? 0) / tot) * 100 : 0;
      }),
      backgroundColor: PTYPE_COLORS[t] ?? "#aaa",
    }));
    return { labels: years, datasets };
  }, [data.ptby]);

  const ptypeOptions = useMemo<ChartOptions<"bar">>(() => {
    const base = defaultChartOptions("bar", true);
    return {
      ...base,
      scales: {
        x: { ...base.scales!.x, stacked: true },
        y: {
          ...base.scales!.y,
          stacked: true,
          max: 100,
          ticks: {
            ...(base.scales!.y as { ticks?: object }).ticks,
            callback: (v) => Number(v) + "%",
          },
        },
      },
      plugins: {
        ...base.plugins,
        legend: {
          ...base.plugins!.legend,
          position: "right",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
    };
  }, []);

  const gapRows = useMemo(() => {
    const center = data.region["מרכז"] ?? [];
    const peri = data.region["פריפריה"] ?? [];
    const periByY = Object.fromEntries(peri.map((p) => [p[0], p[1]]));
    return center
      .filter((c) => periByY[c[0]] != null)
      .slice(-10)
      .map((c) => {
        const periVal = periByY[c[0]] as number;
        return {
          y: c[0],
          center: c[1],
          peri: periVal,
          gap: c[1] / periVal,
        };
      });
  }, [data.region]);

  return (
    <>
      <section className="dense-section">
        <h2>📐 מחיר ↔ תשואה (Scatter)</h2>
        <div className="sub">קשר הפוך: ככל שהמחיר גבוה - תשואת השכירות נמוכה</div>
        <div className="dense-chart-box-xl">
          <ChartSurface
            title=""
            type="scatter"
            data={scatterChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
            options={scatterOptions as ChartOptions<"line" | "bar" | "scatter" | "doughnut">}
            height={370}
          />
        </div>
      </section>

      <section className="dense-section">
        <h2>🏘️ סוג נכס לפי שנה (Stacked)</h2>
        <div className="dense-chart-box-lg">
          <ChartSurface
            title=""
            type="bar"
            data={ptypeChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
            options={ptypeOptions as ChartOptions<"line" | "bar" | "scatter" | "doughnut">}
            height={330}
          />
        </div>
      </section>

      <section className="dense-section">
        <h2>🏛️ פער מרכז-פריפריה לאורך זמן</h2>
        <table className="dense-section-table">
          <thead>
            <tr>
              <th>שנה</th>
              <th>מרכז ₪/מ"ר</th>
              <th>פריפריה ₪/מ"ר</th>
              <th>פער</th>
            </tr>
          </thead>
          <tbody>
            {gapRows.map((r) => (
              <tr key={r.y}>
                <td>{r.y}</td>
                <td className="num">{fmtCurrency(r.center)}</td>
                <td className="num">{fmtCurrency(r.peri)}</td>
                <td className="num">
                  <span className="dense-pill bad">×{r.gap.toFixed(2)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
