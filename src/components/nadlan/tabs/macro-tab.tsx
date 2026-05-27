"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartOptions } from "chart.js";

import type { NadlanData } from "@/types/nadlan";

import { ChartSurface, defaultChartOptions } from "../shared/chart-surface";
import { fmtCurrency, preciseFormatter } from "../shared/formatters";

type MetricKey = "pps" | "avg" | "growth5y" | "yield" | "yrs2buy" | "cnt";

const METRICS: Record<
  MetricKey,
  { label: string; fmt: (v: number) => string; rev: boolean }
> = {
  pps: {
    label: '₪/מ״ר',
    fmt: (v) => "₪" + Math.round(v).toLocaleString("he-IL"),
    rev: false,
  },
  avg: {
    label: "מחיר ממוצע",
    fmt: (v) => "₪" + (v / 1000).toFixed(0) + "K",
    rev: false,
  },
  growth5y: {
    label: "צמיחה 5 שנים",
    fmt: (v) => v.toFixed(1) + "%",
    rev: false,
  },
  yield: {
    label: "תשואת שכירות",
    fmt: (v) => v.toFixed(2) + "%",
    rev: false,
  },
  yrs2buy: {
    label: "שנים לרכישה",
    fmt: (v) => v.toFixed(1) + " שנים",
    rev: true,
  },
  cnt: {
    label: "נפח עסקאות",
    fmt: (v) => Math.round(v).toLocaleString("he-IL"),
    rev: false,
  },
};

function metricValue(
  metric: MetricKey,
  c: { n: string; pps: number; avg: number; cnt: number },
  maps: {
    yields: Record<string, number>;
    afford: Record<string, number>;
    growth: Record<string, number>;
  },
): number | undefined {
  switch (metric) {
    case "yield":
      return maps.yields[c.n];
    case "yrs2buy":
      return maps.afford[c.n];
    case "growth5y":
      return maps.growth[c.n];
    case "pps":
      return c.pps;
    case "avg":
      return c.avg;
    case "cnt":
      return c.cnt;
  }
}

type Props = { data: NadlanData };

export function MacroTab({ data }: Props) {
  const [metric, setMetric] = useState<MetricKey>("pps");

  const maps = useMemo(
    () => ({
      yields: Object.fromEntries(data.yields.map((y) => [y.n, y.y])),
      afford: Object.fromEntries(data.afford.map((a) => [a.n, a.yr])),
      growth: data.growth5y,
    }),
    [data],
  );

  const cityRank = useMemo(() => {
    const spec = METRICS[metric];
    const rows = data.cities
      .map((c) => ({ name: c.n, value: metricValue(metric, c, maps) }))
      .filter((r): r is { name: string; value: number } => r.value != null)
      .sort((a, b) => (spec.rev ? a.value - b.value : b.value - a.value));
    return rows;
  }, [data.cities, metric, maps]);

  const cityChart = useMemo<ChartData<"bar">>(() => {
    const top = cityRank.slice(0, 16);
    const spec = METRICS[metric];
    const values = top.map((r) => r.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const color = (v: number) => {
      const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
      const tt = spec.rev ? 1 - t : t;
      const r = Math.round(40 + tt * 215);
      const g = Math.round(180 - tt * 130);
      const b = Math.round(80 - tt * 40);
      return `rgb(${r},${g},${b})`;
    };
    return {
      labels: top.map((r) => r.name),
      datasets: [
        {
          label: spec.label,
          data: values,
          backgroundColor: values.map(color),
        },
      ],
    };
  }, [cityRank, metric]);

  const cityChartOptions = useMemo<ChartOptions<"bar">>(() => {
    const spec = METRICS[metric];
    const base = defaultChartOptions("bar", false);
    return {
      ...base,
      indexAxis: "y",
      scales: {
        x: {
          ...base.scales!.x,
          ticks: {
            ...(base.scales!.x as { ticks?: object }).ticks,
            callback: (v) => spec.fmt(Number(v)),
          },
        },
        y: base.scales!.y,
      },
    };
  }, [metric]);

  const yieldsChart = useMemo<ChartData<"bar">>(() => {
    const top = data.yields.slice(0, 15);
    return {
      labels: top.map((d) => d.n),
      datasets: [
        {
          label: "תשואה %",
          data: top.map((d) => d.y),
          backgroundColor: top.map((d) =>
            d.y > 3.5 ? "#047857" : d.y > 2.5 ? "#f59e0b" : "#dc2626",
          ),
        },
      ],
    };
  }, [data.yields]);

  const yieldsOptions = useMemo<ChartOptions<"bar">>(() => {
    const base = defaultChartOptions("bar", false);
    return {
      ...base,
      indexAxis: "y",
      scales: {
        x: {
          ...base.scales!.x,
          ticks: {
            ...(base.scales!.x as { ticks?: object }).ticks,
            callback: (v) => Number(v).toFixed(1) + "%",
          },
        },
        y: base.scales!.y,
      },
    };
  }, []);

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

  const priceOptions = useMemo<ChartOptions<"line">>(() => {
    const base = defaultChartOptions("line", true);
    return {
      ...base,
      scales: {
        x: base.scales!.x,
        y: {
          ...base.scales!.y,
          ticks: {
            ...(base.scales!.y as { ticks?: object }).ticks,
            callback: (v) => (Number(v) / 1_000_000).toFixed(1) + "M",
          },
        },
      },
    };
  }, []);

  const top6 = data.afford.slice(0, 6);
  const bot6 = data.afford.slice(-6).reverse();

  return (
    <>
      <section className="dense-section">
        <h2>🗺️ ערים מובילות לפי מדד</h2>
        <div className="sub" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>16 ערים בכיסוי, ממוין מהגבוה לנמוך</span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
            style={{
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 5,
              fontSize: 13,
              minWidth: 180,
            }}
          >
            {Object.entries(METRICS).map(([key, spec]) => (
              <option key={key} value={key}>
                {spec.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ height: 500, position: "relative" }}>
          <ChartSurface
            title=""
            type="bar"
            data={cityChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
            options={cityChartOptions as ChartOptions<"line" | "bar" | "scatter" | "doughnut">}
            height={490}
          />
        </div>
      </section>

      <section className="dense-section">
        <h2>📊 פילוחים והשוואות</h2>
        <div className="dense-grid g-2">
          <div>
            <div className="dense-tabhead">תשואות שכירות — Top 15</div>
            <div className="dense-chart-box-lg">
              <ChartSurface
                title=""
                type="bar"
                data={yieldsChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
                options={yieldsOptions as ChartOptions<"line" | "bar" | "scatter" | "doughnut">}
                height={330}
              />
            </div>
          </div>
          <div>
            <div className="dense-tabhead">ממוצע vs חציוני שנתי</div>
            <div className="dense-chart-box-lg">
              <ChartSurface
                title=""
                type="line"
                data={priceChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
                options={priceOptions as ChartOptions<"line" | "bar" | "scatter" | "doughnut">}
                height={330}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="dense-section">
        <h2>📐 Affordability — שנות הכנסה לרכישת דירה ממוצעת</h2>
        <div className="sub">המחיר הממוצע בעיר, חלקי הכנסה ארצית ממוצעת</div>
        <table className="dense-section-table">
          <thead>
            <tr>
              <th>עיר</th>
              <th>שנים</th>
              <th>מחיר ממוצע</th>
              <th>הכנסה ארצית</th>
            </tr>
          </thead>
          <tbody>
            <tr className="dense-section-header-row">
              <td colSpan={4}>— הכי נגישות —</td>
            </tr>
            {top6.map((a) => (
              <tr key={`t-${a.n}`}>
                <td>{a.n}</td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {preciseFormatter.format(a.yr)}
                </td>
                <td className="num">{fmtCurrency(a.avg)}</td>
                <td className="num">{fmtCurrency(a.wage)}</td>
              </tr>
            ))}
            <tr className="dense-section-header-row bad">
              <td colSpan={4}>— הכי לא נגישות —</td>
            </tr>
            {bot6.map((a) => (
              <tr key={`b-${a.n}`}>
                <td>{a.n}</td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {preciseFormatter.format(a.yr)}
                </td>
                <td className="num">{fmtCurrency(a.avg)}</td>
                <td className="num">{fmtCurrency(a.wage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
