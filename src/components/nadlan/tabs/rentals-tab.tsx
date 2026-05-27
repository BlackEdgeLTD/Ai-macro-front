"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ChartData, ChartOptions } from "chart.js";

import type {
  NadlanData,
  RentNeighborhoodGeo,
  RoomTypeKey,
} from "@/types/nadlan";
import { Skeleton } from "@/components/ui/skeleton";

import { ChartSurface, defaultChartOptions } from "../shared/chart-surface";
import { fmtCurrency, fmtNum, numberFormatter } from "../shared/formatters";

const ROOM_LABELS: Record<RoomTypeKey, string> = {
  "0": "3 חדרים",
  "1": "4 חדרים",
  "2": "5+ חדרים",
  "3": "ממוצע כללי",
};

const ROOM_TABS: { key: RoomTypeKey; label: string }[] = [
  { key: "0", label: "3" },
  { key: "1", label: "4" },
  { key: "2", label: "5+" },
  { key: "3", label: "כללי" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

type SortKey = "n" | "c" | "price";

const RentalsMap = dynamic(() => import("../map/rentals-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full rounded" />,
});

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function ymToLabel(ym: number): string {
  const y = Math.floor(ym / 12);
  const m = (ym % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

type Props = { data: NadlanData };

export function RentalsTab({ data }: Props) {
  const [activeRoom, setActiveRoom] = useState<RoomTypeKey>("1");
  const [settlement, setSettlement] = useState("");
  const [search, setSearch] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const settlements = useMemo(() => {
    return [...new Set(data.rent_neighborhoods_geo.map((n) => n.c).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "he"),
    );
  }, [data.rent_neighborhoods_geo]);

  const filtered = useMemo<RentNeighborhoodGeo[]>(() => {
    const s = settlement;
    const term = search.trim().toLowerCase();
    const pMin = parseFloat(priceMin);
    const pMax = parseFloat(priceMax);
    return data.rent_neighborhoods_geo.filter((n) => {
      if (s && n.c !== s) return false;
      if (term) {
        const blob = `${n.n} ${n.c}`.toLowerCase();
        if (!blob.includes(term)) return false;
      }
      if (!Number.isNaN(pMin) && (n.price == null || n.price < pMin)) return false;
      if (!Number.isNaN(pMax) && (n.price == null || n.price > pMax)) return false;
      return true;
    });
  }, [data.rent_neighborhoods_geo, settlement, search, priceMin, priceMax]);

  useEffect(() => setPage(1), [settlement, search, priceMin, priceMax]);

  const stats = useMemo(() => {
    const prices = filtered.map((n) => n.price).filter((p): p is number => p != null);
    const settlementsSet = new Set(filtered.map((n) => n.c).filter(Boolean));
    if (!prices.length) {
      return {
        count: filtered.length,
        settlements: settlementsSet.size,
        median: null,
        max: null,
        min: null,
        maxRec: null as RentNeighborhoodGeo | null,
        minRec: null as RentNeighborhoodGeo | null,
      };
    }
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    return {
      count: filtered.length,
      settlements: settlementsSet.size,
      median: median(prices),
      max,
      min,
      maxRec: filtered.find((n) => n.price === max) ?? null,
      minRec: filtered.find((n) => n.price === min) ?? null,
    };
  }, [filtered]);

  const settlementTrendIdx = useMemo(() => {
    if (!settlement) {
      const counts: Record<string, number> = {};
      filtered.forEach((n) => {
        if (n.c) counts[n.c] = (counts[n.c] ?? 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (!top) return null;
      const idx = data.rent_settlements_geo.findIndex((s) => s.n === top[0]);
      return idx >= 0 ? idx : null;
    }
    const idx = data.rent_settlements_geo.findIndex((s) => s.n === settlement);
    return idx >= 0 ? idx : null;
  }, [settlement, filtered, data.rent_settlements_geo]);

  const trendChart = useMemo<{
    chart: ChartData<"line"> | null;
    info: string;
  }>(() => {
    if (settlementTrendIdx == null)
      return { chart: null, info: "אין נתוני מגמה" };
    const sname = data.rent_settlements_geo[settlementTrendIdx]?.n ?? "?";
    const sttData =
      data.settlement_trends[String(settlementTrendIdx)]?.[activeRoom] ?? [];
    const cntData = data.rent_trend[activeRoom] ?? [];
    if (!sttData.length && !cntData.length)
      return {
        chart: null,
        info: `${sname} | ${ROOM_LABELS[activeRoom]} — אין נתוני מגמה`,
      };

    const all = new Set<number>();
    sttData.forEach(([ym]) => all.add(ym));
    cntData.forEach(([ym]) => all.add(ym));
    const dates = [...all].sort((a, b) => a - b);
    const stMap = Object.fromEntries(sttData.map(([ym, p]) => [ym, p]));
    const cnMap = Object.fromEntries(cntData.map(([ym, p]) => [ym, p]));

    return {
      chart: {
        labels: dates.map(ymToLabel),
        datasets: [
          {
            label: sname,
            data: dates.map((d) => (stMap[d] != null ? (stMap[d] as number) : null)),
            borderColor: "#047857",
            backgroundColor: "rgba(4,120,87,0.15)",
            tension: 0.2,
            pointRadius: 3,
            fill: true,
          },
          {
            label: "ממוצע ארצי",
            data: dates.map((d) => (cnMap[d] != null ? (cnMap[d] as number) : null)),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245,158,11,0.1)",
            tension: 0.2,
            pointRadius: 2,
            borderDash: [4, 4],
          },
        ],
      },
      info: `${sname} | ${ROOM_LABELS[activeRoom]}`,
    };
  }, [
    settlementTrendIdx,
    activeRoom,
    data.rent_settlements_geo,
    data.settlement_trends,
    data.rent_trend,
  ]);

  const trendOptions = useMemo<ChartOptions<"line">>(() => {
    const base = defaultChartOptions("line", true);
    return {
      ...base,
      interaction: { mode: "index", intersect: false },
      plugins: {
        ...base.plugins,
        legend: { position: "top", labels: { boxWidth: 14, font: { size: 11 } } },
        tooltip: {
          ...base.plugins!.tooltip,
          callbacks: {
            label: (ctx) =>
              ctx.dataset.label + ": " + fmtCurrency(Number(ctx.parsed.y)),
          },
        },
      },
      scales: {
        x: { ...base.scales!.x, ticks: { maxRotation: 45, font: { size: 10 } } },
        y: {
          ...base.scales!.y,
          ticks: { callback: (v) => fmtCurrency(Number(v)), font: { size: 10 } },
        },
      },
    };
  }, []);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sortKey === "n") {
        return sortDir === "asc"
          ? a.n.localeCompare(b.n, "he")
          : b.n.localeCompare(a.n, "he");
      }
      if (sortKey === "c") {
        return sortDir === "asc"
          ? (a.c || "").localeCompare(b.c || "", "he")
          : (b.c || "").localeCompare(a.c || "", "he");
      }
      const av = a.price ?? (sortDir === "asc" ? Infinity : -Infinity);
      const bv = b.price ?? (sortDir === "asc" ? Infinity : -Infinity);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function reset() {
    setSettlement("");
    setSearch("");
    setPriceMin("");
    setPriceMax("");
  }

  function onSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    if (!filtered.length) {
      window.alert("אין נתונים");
      return;
    }
    const headers = ["שכונה", "יישוב", "מחיר חודשי"];
    const rows = filtered.map((n) => {
      const fields = [n.n, n.c, n.price ?? ""];
      return fields
        .map((v) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",");
    });
    const csv = ["﻿" + headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `שכירות_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <>
      <section className="dense-section">
        <h2>🏠 שכירות בישראל — {numberFormatter.format(filtered.length)} שכונות</h2>
        <div className="sub">22 חודשים אחרונים · מקור: nadlan.gov.il</div>

      <div className="dense-filters">
        <div className="filter-group">
          <label>חדרים</label>
          <div style={{ display: "flex", gap: 3 }}>
            {ROOM_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`dense-tab-btn ${t.key === activeRoom ? "active" : ""}`}
                onClick={() => setActiveRoom(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <label>יישוב</label>
          <select
            value={settlement}
            onChange={(e) => setSettlement(e.target.value)}
          >
            <option value="">הכל</option>
            {settlements.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>חיפוש שכונה</label>
          <input
            type="text"
            placeholder="שם שכונה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 180 }}
          />
        </div>
        <div className="filter-group">
          <label>מינ׳ (₪/חודש)</label>
          <input
            type="number"
            step={500}
            placeholder="0"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>מקס׳ (₪/חודש)</label>
          <input
            type="number"
            step={500}
            placeholder="∞"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>&nbsp;</label>
          <button type="button" className="dense-btn secondary" onClick={reset}>
            איפוס
          </button>
        </div>
        <div className="filter-group" style={{ marginInlineStart: "auto" }}>
          <label>&nbsp;</label>
          <button type="button" className="dense-btn" onClick={exportCsv}>
            ⬇ ייצוא CSV
          </button>
        </div>
      </div>

      <div className="dense-main">
        <div className="dense-panel">
          <div className="dense-panel-header">
            מפת שכירות לפי שכונה
            <small>נקודה לכל שכונה, צבועה לפי מחיר חודשי</small>
          </div>
          <div className="dense-map-wrapper">
            <RentalsMap
              neighborhoods={filtered}
              roomLabel={ROOM_LABELS[activeRoom]}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 min-h-0">
          <div className="dense-panel">
            <div className="dense-panel-header">סטטיסטיקות</div>
            <div className="dense-stats-grid">
              <div className="dense-stat-card">
                <div className="label">שכונות</div>
                <div className="value">{fmtNum(stats.count)}</div>
                <div className="secondary-value">
                  {stats.settlements} ערים
                </div>
              </div>
              <div className="dense-stat-card">
                <div className="label">חציון ₪/חודש</div>
                <div className="value">
                  {stats.median != null ? fmtCurrency(stats.median) : "-"}
                </div>
                <div className="secondary-value">
                  כל השכונות במסנן
                </div>
              </div>
              <div className="dense-stat-card">
                <div className="label">מקסימום</div>
                <div className="value">
                  {stats.max != null ? fmtCurrency(stats.max) : "-"}
                </div>
                <div className="secondary-value">
                  {stats.maxRec
                    ? `${stats.maxRec.n} (${stats.maxRec.c || "-"})`
                    : "-"}
                </div>
              </div>
              <div className="dense-stat-card">
                <div className="label">מינימום</div>
                <div className="value">
                  {stats.min != null ? fmtCurrency(stats.min) : "-"}
                </div>
                <div className="secondary-value">
                  {stats.minRec
                    ? `${stats.minRec.n} (${stats.minRec.c || "-"})`
                    : "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="dense-panel" style={{ flex: 1 }}>
            <div className="dense-panel-header">
              מגמת מחירי שכירות
              <small>{trendChart.info}</small>
            </div>
            <div className="dense-chart-container">
              {trendChart.chart ? (
                <ChartSurface
                  title=""
                  type="line"
                  data={
                    trendChart.chart as ChartData<
                      "line" | "bar" | "scatter" | "doughnut"
                    >
                  }
                  options={
                    trendOptions as ChartOptions<
                      "line" | "bar" | "scatter" | "doughnut"
                    >
                  }
                  height={240}
                />
              ) : (
                <div className="flex h-[240px] items-center justify-center text-sm text-[#6b7280]">
                  אין נתוני מגמה ליישוב הנוכחי
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      </section>

      <section className="dense-section">
        <h2>טבלת שכירות לפי שכונה</h2>
        <div className="sub">לחץ על כותרת עמודה למיון</div>
        <div className="dense-table-wrapper" style={{ borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <table className="dense-table">
            <thead>
              <tr>
                <SortTh col="n" current={sortKey} dir={sortDir} onClick={onSort}>
                  שכונה
                </SortTh>
                <SortTh col="c" current={sortKey} dir={sortDir} onClick={onSort}>
                  יישוב
                </SortTh>
                <SortTh col="price" current={sortKey} dir={sortDir} onClick={onSort}>
                  מחיר חודשי
                </SortTh>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    style={{ textAlign: "center", color: "#6b7280", padding: 20 }}
                  >
                    אין שכונות תואמות
                  </td>
                </tr>
              ) : (
                pageRows.map((n) => (
                  <tr key={n.id}>
                    <td>{n.n}</td>
                    <td>{n.c || "-"}</td>
                    <td className="num">{fmtCurrency(n.price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="dense-table-footer">
          <div className="dense-pagination">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ הקודם
            </button>
            <span style={{ margin: "0 8px" }}>
              דף {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              הבא ›
            </button>
          </div>
          <div>
            הצג:{" "}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: "3px 8px",
                fontSize: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 4,
              }}
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span style={{ marginInlineStart: 12, color: "#6b7280" }}>
              {fmtNum(sorted.length)} שכונות
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

type SortThProps = {
  col: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onClick: (col: SortKey) => void;
  children: React.ReactNode;
};

function SortTh({ col, current, dir, onClick, children }: SortThProps) {
  const active = col === current;
  const cls = active ? (dir === "asc" ? "sorted-asc" : "sorted-desc") : "";
  return (
    <th data-sort={col} className={cls} onClick={() => onClick(col)}>
      {children}
    </th>
  );
}
