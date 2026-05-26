"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { ChartData, ChartOptions } from "chart.js";

import type { NadlanData, TxnRow } from "@/types/nadlan";
import { Skeleton } from "@/components/ui/skeleton";

import { ChartSurface, defaultChartOptions } from "../shared/chart-surface";
import {
  fmtCurrency,
  fmtNum,
  numberFormatter,
  ymToMonthYear,
} from "../shared/formatters";

const NeighborhoodsMap = dynamic(() => import("../map/neighborhoods-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[540px] w-full rounded" />,
});

type SortCol = "date" | "city" | "ptype" | "sqm" | "rooms" | "price" | "pps";
const SORT_INDEX: Record<SortCol, number> = {
  date: 0,
  city: 1,
  ptype: 2,
  sqm: 3,
  rooms: 4,
  price: 5,
  pps: 6,
};

type NbhSortCol = "n" | "city" | "cnt" | "avg" | "pps" | "sqm" | "r";

const PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

type Filters = {
  cityIdx: string;
  ptypeIdx: string;
  nbhName: string;
  yFrom: string;
  yTo: string;
  pFrom: string;
  pTo: string;
  rooms: string;
};

const EMPTY: Filters = {
  cityIdx: "",
  ptypeIdx: "",
  nbhName: "",
  yFrom: "",
  yTo: "",
  pFrom: "",
  pTo: "",
  rooms: "",
};

type Props = { data: NadlanData };

export function BuyExplorerTab({ data }: Props) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [nbhSearch, setNbhSearch] = useState("");
  const [nbhSortCol, setNbhSortCol] = useState<NbhSortCol>("cnt");
  const [nbhSortDir, setNbhSortDir] = useState<-1 | 1>(-1);

  const filtered = useMemo<TxnRow[]>(() => {
    const cityIdx = filters.cityIdx === "" ? null : Number(filters.cityIdx);
    const ptypeIdx = filters.ptypeIdx === "" ? null : Number(filters.ptypeIdx);
    const yFrom = parseInt(filters.yFrom) || 1998;
    const yTo = parseInt(filters.yTo) || 2026;
    const pFrom = parseInt(filters.pFrom) || 0;
    const pTo = parseInt(filters.pTo) || 999_999;
    const rooms = parseFloat(filters.rooms) || null;
    const ymFrom = yFrom * 12;
    const ymTo = (yTo + 1) * 12;
    return data.txns.filter((t) => {
      if (cityIdx !== null && t[1] !== cityIdx) return false;
      if (ptypeIdx !== null && t[2] !== ptypeIdx) return false;
      if (t[0] < ymFrom || t[0] > ymTo) return false;
      if (t[5] < pFrom || t[5] > pTo) return false;
      if (rooms !== null && t[4] !== rooms) return false;
      return true;
    });
  }, [data.txns, filters]);

  const sorted = useMemo<TxnRow[]>(() => {
    const i = SORT_INDEX[sortCol];
    return [...filtered].sort((a, b) => (a[i] - b[i]) * sortDir);
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => setPage(1), [filters, pageSize]);

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const sumP = filtered.reduce((s, t) => s + t[5], 0);
    const sumPps = filtered.reduce((s, t) => s + t[6], 0);
    return {
      count: filtered.length,
      avgPriceK: Math.round(sumP / filtered.length),
      avgPps: Math.round(sumPps / filtered.length),
    };
  }, [filtered]);

  const yearlyChart = useMemo<ChartData<"bar">>(() => {
    const by: Record<number, number> = {};
    filtered.forEach((t) => {
      const y = Math.floor(t[0] / 12);
      by[y] = (by[y] ?? 0) + 1;
    });
    const years = Object.keys(by)
      .map(Number)
      .sort((a, b) => a - b);
    return {
      labels: years,
      datasets: [
        {
          label: "עסקאות",
          data: years.map((y) => by[y]),
          backgroundColor: "#3b82f6",
        },
      ],
    };
  }, [filtered]);

  const cityChart = useMemo<ChartData<"bar">>(() => {
    const by: Record<number, number> = {};
    filtered.forEach((t) => {
      by[t[1]] = (by[t[1]] ?? 0) + 1;
    });
    const arr = Object.entries(by)
      .map(([i, c]) => ({
        name: data.cities[Number(i)]?.n ?? "?",
        count: c,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return {
      labels: arr.map((x) => x.name),
      datasets: [
        {
          label: "עסקאות",
          data: arr.map((x) => x.count),
          backgroundColor: "#10b981",
        },
      ],
    };
  }, [filtered, data.cities]);

  const cityChartOptions = useMemo<ChartOptions<"bar">>(() => {
    const base = defaultChartOptions("bar", false);
    return { ...base, indexAxis: "y" };
  }, []);

  const cityNbhs = useMemo(() => {
    if (filters.cityIdx === "") return [];
    const cIdx = Number(filters.cityIdx);
    return data.nbhs
      .filter((n) => n.c === cIdx)
      .slice()
      .sort((a, b) => b.cnt - a.cnt);
  }, [data.nbhs, filters.cityIdx]);

  function update<K extends keyof Filters>(key: K, value: string) {
    setFilters((f) => {
      const next = { ...f, [key]: value };
      if (key === "cityIdx") next.nbhName = "";
      return next;
    });
  }

  function reset() {
    setFilters(EMPTY);
  }

  function onSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === -1 ? 1 : -1));
    else {
      setSortCol(col);
      setSortDir(-1);
    }
  }

  function onNbhSort(col: NbhSortCol) {
    if (nbhSortCol === col) setNbhSortDir((d) => (d === -1 ? 1 : -1));
    else {
      setNbhSortCol(col);
      setNbhSortDir(col === "n" || col === "city" ? 1 : -1);
    }
  }

  const nbhRows = useMemo(() => {
    const cityIdx = filters.cityIdx === "" ? null : Number(filters.cityIdx);
    const term = nbhSearch.trim();
    const pinnedName = filters.nbhName;
    const rows = data.nbhs.filter((n) => {
      if (cityIdx !== null && n.c !== cityIdx) return false;
      if (pinnedName && n.n !== pinnedName) return false;
      if (term && !n.n.includes(term)) return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (nbhSortCol === "n") return a.n.localeCompare(b.n, "he") * nbhSortDir;
      if (nbhSortCol === "city") {
        const an = data.cities[a.c]?.n ?? "";
        const bn = data.cities[b.c]?.n ?? "";
        return an.localeCompare(bn, "he") * nbhSortDir;
      }
      return (a[nbhSortCol] - b[nbhSortCol]) * nbhSortDir;
    });
  }, [
    data.nbhs,
    data.cities,
    filters.cityIdx,
    filters.nbhName,
    nbhSearch,
    nbhSortCol,
    nbhSortDir,
  ]);

  return (
    <div className="dense-shell">
      <header className="dense-header">
        <div>
          <h1>📋 סייר עסקאות מכר</h1>
          <div className="dense-subtitle">
            סנן לפי עיר, שכונה, סוג נכס, שנה, מחיר, חדרים. הטבלה והמפה מתעדכנות
            יחד.
          </div>
        </div>
        <div className="dense-count">
          סה״כ: <strong>{fmtNum(data.txns.length)}</strong> עסקאות
        </div>
      </header>

      <div className="dense-filters">
        <div className="filter-group">
          <label>עיר</label>
          <select
            value={filters.cityIdx}
            onChange={(e) => update("cityIdx", e.target.value)}
          >
            <option value="">הכל</option>
            {data.cities.map((c, i) => (
              <option key={i} value={String(i)}>
                {c.n} ({fmtNum(c.cnt)})
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>שכונה</label>
          <select
            value={filters.nbhName}
            disabled={filters.cityIdx === "" || cityNbhs.length === 0}
            onChange={(e) => update("nbhName", e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">
              {filters.cityIdx === "" ? "בחר/י עיר תחילה" : "כל השכונות"}
            </option>
            {cityNbhs.map((n, i) => (
              <option key={`${n.n}-${i}`} value={n.n}>
                {n.n} ({fmtNum(n.cnt)})
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>סוג נכס</label>
          <select
            value={filters.ptypeIdx}
            onChange={(e) => update("ptypeIdx", e.target.value)}
          >
            <option value="">הכל</option>
            {data.ptypes.map((p, i) => (
              <option key={i} value={String(i)}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>שנה מ-</label>
          <input
            type="number"
            placeholder="1998"
            min={1998}
            max={2026}
            value={filters.yFrom}
            onChange={(e) => update("yFrom", e.target.value)}
            style={{ minWidth: 90 }}
          />
        </div>
        <div className="filter-group">
          <label>שנה עד-</label>
          <input
            type="number"
            placeholder="2026"
            min={1998}
            max={2026}
            value={filters.yTo}
            onChange={(e) => update("yTo", e.target.value)}
            style={{ minWidth: 90 }}
          />
        </div>
        <div className="filter-group">
          <label>מחיר מ- (אלפי ₪)</label>
          <input
            type="number"
            placeholder="0"
            value={filters.pFrom}
            onChange={(e) => update("pFrom", e.target.value)}
            style={{ minWidth: 110 }}
          />
        </div>
        <div className="filter-group">
          <label>מחיר עד-</label>
          <input
            type="number"
            placeholder="∞"
            value={filters.pTo}
            onChange={(e) => update("pTo", e.target.value)}
            style={{ minWidth: 110 }}
          />
        </div>
        <div className="filter-group">
          <label>חדרים</label>
          <input
            type="number"
            step={0.5}
            placeholder="כל"
            value={filters.rooms}
            onChange={(e) => update("rooms", e.target.value)}
            style={{ minWidth: 80 }}
          />
        </div>
        <div className="filter-group">
          <label>&nbsp;</label>
          <button type="button" className="dense-btn secondary" onClick={reset}>
            איפוס
          </button>
        </div>
        {stats && (
          <div className="dense-filter-stats" style={{ marginInlineStart: "auto" }}>
            {fmtNum(stats.count)} תוצאות · ממוצע ₪
            {numberFormatter.format(stats.avgPriceK)}K · ₪
            {numberFormatter.format(stats.avgPps)}/מ"ר
          </div>
        )}
      </div>

      <div className="dense-grid-2">
        <div className="dense-panel">
          <div className="dense-panel-header">
            נפח עסקאות לפי שנה
            <small>מסונן</small>
          </div>
          <div className="dense-chart-box">
            <ChartSurface
              title=""
              type="bar"
              data={
                yearlyChart as ChartData<
                  "line" | "bar" | "scatter" | "doughnut"
                >
              }
              height={210}
            />
          </div>
        </div>
        <div className="dense-panel">
          <div className="dense-panel-header">
            פיזור לפי עיר (Top 10)
            <small>מסונן</small>
          </div>
          <div className="dense-chart-box">
            <ChartSurface
              title=""
              type="bar"
              data={cityChart as ChartData<"line" | "bar" | "scatter" | "doughnut">}
              options={
                cityChartOptions as ChartOptions<
                  "line" | "bar" | "scatter" | "doughnut"
                >
              }
              height={210}
            />
          </div>
        </div>
      </div>

      <div className="dense-panel">
        <div className="dense-panel-header">
          טבלת עסקאות
          <small>לחץ על כותרת עמודה למיון</small>
        </div>
        <div
          className="dense-table-wrapper"
          style={{ maxHeight: 520 }}
        >
          <table className="dense-table dense-txn-table">
            <thead>
              <tr>
                <TxnTh col="date" current={sortCol} dir={sortDir} onClick={onSort}>
                  תאריך
                </TxnTh>
                <TxnTh col="city" current={sortCol} dir={sortDir} onClick={onSort}>
                  עיר
                </TxnTh>
                <TxnTh col="ptype" current={sortCol} dir={sortDir} onClick={onSort}>
                  סוג
                </TxnTh>
                <TxnTh col="sqm" current={sortCol} dir={sortDir} onClick={onSort}>
                  מ"ר
                </TxnTh>
                <TxnTh col="rooms" current={sortCol} dir={sortDir} onClick={onSort}>
                  חד׳
                </TxnTh>
                <TxnTh col="price" current={sortCol} dir={sortDir} onClick={onSort}>
                  מחיר
                </TxnTh>
                <TxnTh col="pps" current={sortCol} dir={sortDir} onClick={onSort}>
                  ₪/מ"ר
                </TxnTh>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", color: "#6b7280", padding: 20 }}
                  >
                    אין עסקאות תואמות
                  </td>
                </tr>
              ) : (
                pageRows.map((t, i) => (
                  <tr key={i}>
                    <td>{ymToMonthYear(t[0])}</td>
                    <td>{data.cities[t[1]]?.n ?? "?"}</td>
                    <td>{data.ptypes[t[2]] ?? "-"}</td>
                    <td className="num">{t[3]}</td>
                    <td className="num">{t[4] || "-"}</td>
                    <td className="num">
                      ₪{numberFormatter.format(t[5])}K
                    </td>
                    <td className="num">{fmtCurrency(t[6])}</td>
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
              disabled={safePage === 1}
              onClick={() => setPage(1)}
            >
              ‹‹
            </button>
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ הקודם
            </button>
            <span style={{ margin: "0 8px" }}>
              דף {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              הבא ›
            </button>
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setPage(totalPages)}
            >
              ››
            </button>
          </div>
          <div>
            הצג:{" "}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
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
              {fmtNum(filtered.length)} עסקאות
            </span>
          </div>
        </div>
      </div>

      <div className="dense-panel">
        <div className="dense-panel-header">
          מפת שכונות (אגרגציה לפי שכונה)
          <small>
            מבוסס על {data.nbhs.length} שכונות עם 15+ עסקאות. גודל = √עסקאות,
            צבע = ₪/מ"ר
          </small>
        </div>
        <NeighborhoodsMap nbhs={data.nbhs} cities={data.cities} />
      </div>

      <div className="dense-panel">
        <div className="dense-panel-header">
          <div>
            שכונות
            <small style={{ marginInlineStart: 8 }}>
              {filters.nbhName
                ? `שכונה: ${filters.nbhName}`
                : filters.cityIdx
                  ? `שכונות ב-${data.cities[Number(filters.cityIdx)]?.n}`
                  : "כל השכונות בכיסוי"}
              {" · "}
              {fmtNum(nbhRows.length)} תוצאות
            </small>
          </div>
          <input
            type="text"
            placeholder="חיפוש שכונה..."
            value={nbhSearch}
            onChange={(e) => setNbhSearch(e.target.value)}
            style={{
              padding: "5px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 5,
              fontSize: 12,
              minWidth: 200,
            }}
          />
        </div>
        <div className="dense-table-wrapper" style={{ maxHeight: 420 }}>
          <table className="dense-table">
            <thead>
              <tr>
                <NbhTh col="n" current={nbhSortCol} dir={nbhSortDir} onClick={onNbhSort}>
                  שכונה
                </NbhTh>
                <NbhTh col="city" current={nbhSortCol} dir={nbhSortDir} onClick={onNbhSort}>
                  עיר
                </NbhTh>
                <NbhTh col="cnt" current={nbhSortCol} dir={nbhSortDir} onClick={onNbhSort}>
                  עסקאות
                </NbhTh>
                <NbhTh col="avg" current={nbhSortCol} dir={nbhSortDir} onClick={onNbhSort}>
                  מחיר ממוצע
                </NbhTh>
                <NbhTh col="pps" current={nbhSortCol} dir={nbhSortDir} onClick={onNbhSort}>
                  ₪/מ"ר
                </NbhTh>
                <NbhTh col="sqm" current={nbhSortCol} dir={nbhSortDir} onClick={onNbhSort}>
                  מ"ר ממוצע
                </NbhTh>
                <NbhTh col="r" current={nbhSortCol} dir={nbhSortDir} onClick={onNbhSort}>
                  חדרים
                </NbhTh>
              </tr>
            </thead>
            <tbody>
              {nbhRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", color: "#6b7280", padding: 20 }}
                  >
                    אין שכונות תואמות
                  </td>
                </tr>
              ) : (
                nbhRows.map((n, i) => (
                  <tr key={`${n.c}-${n.n}-${i}`}>
                    <td>{n.n}</td>
                    <td>{data.cities[n.c]?.n ?? "?"}</td>
                    <td className="num">{fmtNum(n.cnt)}</td>
                    <td className="num">{fmtCurrency(n.avg)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {fmtCurrency(n.pps)}
                    </td>
                    <td className="num">{n.sqm}</td>
                    <td className="num">{n.r}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type TxnThProps<TCol extends string> = {
  col: TCol;
  current: TCol;
  dir: -1 | 1;
  onClick: (col: TCol) => void;
  children: React.ReactNode;
};

function TxnTh({ col, current, dir, onClick, children }: TxnThProps<SortCol>) {
  const active = col === current;
  return (
    <th
      onClick={() => onClick(col)}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {children}
      {active ? <span aria-hidden> {dir === -1 ? "▾" : "▴"}</span> : null}
    </th>
  );
}

function NbhTh({ col, current, dir, onClick, children }: TxnThProps<NbhSortCol>) {
  const active = col === current;
  return (
    <th
      onClick={() => onClick(col)}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {children}
      {active ? <span aria-hidden> {dir === -1 ? "▾" : "▴"}</span> : null}
    </th>
  );
}
