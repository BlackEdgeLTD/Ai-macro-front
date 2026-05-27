"use client";

import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useNadlanData } from "@/hooks/use-nadlan-data";

import { OverviewTab } from "./nadlan/tabs/overview-tab";
import { MacroTab } from "./nadlan/tabs/macro-tab";
import { BuyExplorerTab } from "./nadlan/tabs/buy-explorer-tab";
import { RentalsTab } from "./nadlan/tabs/rentals-tab";
import { ComparisonsTab } from "./nadlan/tabs/comparisons-tab";
import { QualityTab } from "./nadlan/tabs/quality-tab";
import { fmtNum } from "./nadlan/shared/formatters";

const TABS = [
  { value: "overview", label: "📊 סקירה" },
  { value: "national", label: "🗺️ מאקרו ארצי" },
  { value: "buy", label: "📋 עסקאות מכר" },
  { value: "rent", label: "🏠 שכירות" },
  { value: "compare", label: "⚖️ השוואות" },
  { value: "quality", label: "🚨 איכות נתונים" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export function NadlanDashboardApp() {
  const { data, error, loading } = useNadlanData();
  const [tab, setTab] = useState<TabValue>("overview");

  const subtitle = data
    ? `${fmtNum(data.kpi.total_txns)} עסקאות מכר · ${fmtNum(data.cities.length)} ערים · ${fmtNum(data.rent_neighborhoods_geo.length)} שכונות שכירות · ${fmtNum(data.nbhs.length)} שכונות מכר · מפקד 2022`
    : "פותח את הדאטה...";

  return (
    <div className="dense-shell" style={{ padding: 12 }}>
      <header className="dense-header">
        <div>
          <h1>🏠 נדל&quot;ן ישראל — דשבורד מקיף</h1>
          <div className="dense-subtitle">{subtitle}</div>
        </div>
        <nav className="dense-tabnav">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={t.value === tab ? "active" : ""}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {error ? (
          <div className="dense-section" style={{ color: "#b91c1c" }}>
            שגיאה בטעינת הנתונים: {error.message}
          </div>
        ) : loading || !data ? (
          <div className="dense-section">
            <div className="dense-grid g-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
            <Skeleton className="mt-4 h-72 w-full rounded-lg" />
          </div>
        ) : (
          <>
            {tab === "overview" && <OverviewTab data={data} />}
            {tab === "national" && <MacroTab data={data} />}
            {tab === "buy" && <BuyExplorerTab data={data} />}
            {tab === "rent" && <RentalsTab data={data} />}
            {tab === "compare" && <ComparisonsTab data={data} />}
            {tab === "quality" && <QualityTab data={data} />}
          </>
        )}
      </main>
    </div>
  );
}
