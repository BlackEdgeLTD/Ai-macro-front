"use client";

import { useMemo } from "react";

import type { NadlanData } from "@/types/nadlan";

import { fmtCurrency, fmtNum } from "../shared/formatters";

type AlertKind = "bad" | "warn" | "info";
type Alert = { kind: AlertKind; emoji: string; title: string; body: string };

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
    <>
      <section className="dense-section">
        <h2>🚨 איכות נתונים — בעיות שזוהו</h2>
        <div>
          {alerts.map((a, i) => (
            <div key={i} className={`dense-alert ${a.kind}`}>
              <strong>
                <span aria-hidden style={{ marginInlineEnd: 6 }}>
                  {a.emoji}
                </span>
                {a.title}
              </strong>
              {a.body}
            </div>
          ))}
        </div>
        <div className="dense-grid g-4" style={{ marginTop: 12 }}>
          <div className="dense-kpi">
            <div className="label">סה"כ עסקאות</div>
            <div className="value">{fmtNum(q.total)}</div>
          </div>
          <div className="dense-kpi good">
            <div className="label">נקיות (אחרי סינון)</div>
            <div className="value">{fmtNum(q.clean)}</div>
            <div className="delta">{cleanPct.toFixed(1)}%</div>
          </div>
          <div className="dense-kpi bad">
            <div className="label">חריגים מסוננים</div>
            <div className="value">{fmtNum(q.future + q.high_pps + q.low_price)}</div>
            <div className="delta">עתידי + ₪/מ״ר גבוה + מחיר נמוך</div>
          </div>
          <div className="dense-kpi warn">
            <div className="label">שטח &gt; 1,000 מ"ר</div>
            <div className="value">{fmtNum(q.huge_area)}</div>
            <div className="delta">חריגי שטח שהושארו</div>
          </div>
        </div>
      </section>

      <section className="dense-section">
        <h2>🔍 חריגים מובילים (₪/מ"ר &gt; 200K)</h2>
        <div className="sub">לרוב קרקעות שדווחו כ-"1 מ"ר" - יוצרים מחירים אבסורדיים</div>
        <div style={{ maxHeight: 480, overflow: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <table className="dense-section-table">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>יישוב</th>
                <th>כתובת</th>
                <th>סוג</th>
                <th>שטח</th>
                <th>מחיר</th>
                <th>₪/מ"ר</th>
              </tr>
            </thead>
            <tbody>
              {data.outliers.slice(0, 200).map((o, i) => (
                <tr key={i}>
                  <td>{o.d ?? "-"}</td>
                  <td>{o.c ?? "-"}</td>
                  <td>{[o.nbh, o.addr].filter(Boolean).join(" · ") || "-"}</td>
                  <td>{o.pt ?? "-"}</td>
                  <td className="num">{o.sqm ?? "-"}</td>
                  <td className="num">{fmtCurrency(o.p)}</td>
                  <td className="num">
                    <span className="dense-pill bad">{fmtCurrency(o.pps)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
