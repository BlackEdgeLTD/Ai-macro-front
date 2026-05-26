"use client";

import { useMemo } from "react";

import type { NadlanData } from "@/types/nadlan";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { KpiCard } from "../shared/kpi-card";
import { fmtCurrency, fmtNum } from "../shared/formatters";

type AlertKind = "bad" | "warn" | "info";
type Alert = { kind: AlertKind; emoji: string; title: string; body: string };

const ALERT_STYLE: Record<AlertKind, string> = {
  bad: "border-rose-300 bg-rose-50/80 text-rose-900",
  warn: "border-amber-300 bg-amber-50/80 text-amber-900",
  info: "border-sky-300 bg-sky-50/80 text-sky-900",
};

type Props = { data: NadlanData };

export function QualityTab({ data }: Props) {
  const q = data.quality;
  const cleanPct = (q.clean / q.total) * 100;

  const alerts = useMemo<Alert[]>(() => {
    const list: Alert[] = [];
    if (q.future > 0) {
      list.push({
        kind: "bad",
        emoji: "🚨",
        title: `${q.future} עסקאות עם תאריך עתידי`,
        body: "חוזי קבלן עם תאריך מסירה עתידי. סוננו.",
      });
    }
    if (q.high_pps > 0) {
      list.push({
        kind: "warn",
        emoji: "⚠️",
        title: `${fmtNum(q.high_pps)} עסקאות עם ₪/מ"ר > 200,000`,
        body: 'לרוב קרקעות שדווחו עם "1 מ"ר". סוננו.',
      });
    }
    if (q.low_price > 0) {
      list.push({
        kind: "warn",
        emoji: "⚠️",
        title: `${fmtNum(q.low_price)} עסקאות מתחת ל-₪200K`,
        body: "כנראה תוספות בנייה / מתנות / חלקי דירה.",
      });
    }
    list.push({
      kind: "info",
      emoji: "ℹ️",
      title: `${fmtNum(q.clean)} מתוך ${fmtNum(q.total)} עסקאות נקיות (${cleanPct.toFixed(1)}%)`,
      body: "View: clean_transactions",
    });
    return list;
  }, [q.future, q.high_pps, q.low_price, q.clean, q.total, cleanPct]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label='סה"כ עסקאות'
          value={fmtNum(q.total)}
          accent="linear-gradient(135deg, #1e40af 0%, #2563eb 100%)"
        />
        <KpiCard
          label="נקיות (אחרי סינון)"
          value={fmtNum(q.clean)}
          detail={`${cleanPct.toFixed(1)}% מהסה"כ`}
          accent="linear-gradient(135deg, #047857 0%, #10b981 100%)"
        />
        <KpiCard
          label="חריגים מסוננים"
          value={fmtNum(q.future + q.high_pps + q.low_price)}
          detail="עתידי + ₪/מ״ר גבוה + מחיר נמוך"
          accent="linear-gradient(135deg, #b91c1c 0%, #f97316 100%)"
        />
        <KpiCard
          label='שטח > 1,000 מ"ר'
          value={fmtNum(q.huge_area)}
          detail="חריגי שטח שהושארו"
          accent="linear-gradient(135deg, #b45309 0%, #f59e0b 100%)"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {alerts.map((a, i) => (
          <Card
            key={i}
            className={cn("border shadow-sm", ALERT_STYLE[a.kind])}
          >
            <CardContent className="space-y-1.5 p-4">
              <p className="text-sm font-semibold">
                <span aria-hidden className="me-2">
                  {a.emoji}
                </span>
                {a.title}
              </p>
              <p className="text-xs opacity-80">{a.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="surface-panel border-0 shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[#13202b]">
              דוגמאות חריגים
            </h3>
            <Badge variant="secondary">{data.outliers.length} שורות</Badge>
          </div>
          <div className="max-h-[480px] overflow-auto rounded-2xl border border-slate-200">
            <Table>
              <TableHeader className="sticky top-0 bg-white/95 backdrop-blur">
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>עיר</TableHead>
                  <TableHead>שכונה / כתובת</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead className="text-end">מ"ר</TableHead>
                  <TableHead className="text-end">מחיר</TableHead>
                  <TableHead className="text-end">₪/מ"ר</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.outliers.slice(0, 200).map((o, i) => (
                  <TableRow key={i}>
                    <TableCell>{o.d ?? "-"}</TableCell>
                    <TableCell>{o.c ?? "-"}</TableCell>
                    <TableCell className="max-w-[260px] truncate">
                      {[o.nbh, o.addr].filter(Boolean).join(" · ") || "-"}
                    </TableCell>
                    <TableCell>{o.pt ?? "-"}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {o.sqm ?? "-"}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {fmtCurrency(o.p)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums font-semibold text-rose-600">
                      {fmtCurrency(o.pps)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
