"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartOptions } from "chart.js";

import type { NadlanData } from "@/types/nadlan";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ChartSurface, defaultChartOptions } from "../shared/chart-surface";
import { fmtCurrency, preciseFormatter } from "../shared/formatters";

type MetricKey = "pps" | "avg" | "growth5y" | "yield" | "yrs2buy" | "cnt";

const METRICS: Record<
  MetricKey,
  { label: string; fmt: (v: number) => string; rev: boolean }
> = {
  pps: {
    label: '₪/מ"ר',
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
    <div className="space-y-6">
      <ChartSurface
        title="ערים מובילות לפי מדד"
        subtitle="16 ערים בכיסוי, ממוין מהגבוה לנמוך"
        type="bar"
        data={cityChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
        options={cityChartOptions as ChartOptions<"line" | "bar" | "scatter" | "doughnut">}
        height={500}
      >
        <Select value={metric} onValueChange={(v) => v && setMetric(v as MetricKey)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(METRICS).map(([key, spec]) => (
              <SelectItem key={key} value={key}>
                {spec.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ChartSurface>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartSurface
          title="תשואות שכירות — top 15"
          subtitle="ברוטו שנתי, סודר מהגבוה"
          type="bar"
          data={yieldsChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
          options={yieldsOptions as ChartOptions<"line" | "bar" | "scatter" | "doughnut">}
          height={420}
        />
        <ChartSurface
          title="ממוצע vs חציוני שנתי"
          subtitle="לאומי"
          type="line"
          data={priceChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
          options={priceOptions as ChartOptions<"line" | "bar" | "scatter" | "doughnut">}
          height={420}
        />
      </section>

      <Card className="surface-panel border-0 shadow-none">
        <CardContent className="p-5">
          <h3 className="mb-4 text-lg font-semibold text-[#13202b]">
            נגישות לדיור (שנות הכנסה לרכישת דירה ממוצעת)
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>עיר</TableHead>
                <TableHead className="text-end">שנים</TableHead>
                <TableHead className="text-end">מחיר ממוצע</TableHead>
                <TableHead className="text-end">הכנסה ארצית</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-emerald-50/60">
                <TableCell colSpan={4} className="text-center font-semibold text-emerald-700">
                  — הכי נגישות —
                </TableCell>
              </TableRow>
              {top6.map((a) => (
                <TableRow key={`t-${a.n}`}>
                  <TableCell>{a.n}</TableCell>
                  <TableCell className="text-end tabular-nums font-semibold">
                    {preciseFormatter.format(a.yr)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{fmtCurrency(a.avg)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmtCurrency(a.wage)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-rose-50/60">
                <TableCell colSpan={4} className="text-center font-semibold text-rose-700">
                  — הכי לא נגישות —
                </TableCell>
              </TableRow>
              {bot6.map((a) => (
                <TableRow key={`b-${a.n}`}>
                  <TableCell>{a.n}</TableCell>
                  <TableCell className="text-end tabular-nums font-semibold">
                    {preciseFormatter.format(a.yr)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{fmtCurrency(a.avg)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmtCurrency(a.wage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
