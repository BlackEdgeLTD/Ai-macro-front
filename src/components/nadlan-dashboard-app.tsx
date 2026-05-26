"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useNadlanData } from "@/hooks/use-nadlan-data";

import { OverviewTab } from "./nadlan/tabs/overview-tab";
import { MacroTab } from "./nadlan/tabs/macro-tab";
import { BuyExplorerTab } from "./nadlan/tabs/buy-explorer-tab";
import { RentalsTab } from "./nadlan/tabs/rentals-tab";
import { ComparisonsTab } from "./nadlan/tabs/comparisons-tab";
import { QualityTab } from "./nadlan/tabs/quality-tab";

const TABS = [
  { value: "overview", label: "סקירה כללית", emoji: "📊" },
  { value: "macro", label: "מאקרו לאומי", emoji: "🗺️" },
  { value: "buy", label: "מכר", emoji: "📋" },
  { value: "rent", label: "שכירות", emoji: "🏠" },
  { value: "compare", label: "השוואות", emoji: "⚖️" },
  { value: "quality", label: "איכות נתונים", emoji: "🚨" },
] as const;

export function NadlanDashboardApp() {
  const { data, error, loading } = useNadlanData();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("overview");

  return (
    <main className="page-shell mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
      <header className="hero-panel mb-8 overflow-hidden p-8 text-white">
        <p className="kicker text-white/80">נדל״ן · גרסה 2</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          חוקר נדל״ן ישראל
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/75 sm:text-base">
          {data
            ? `${data.kpi.total_txns.toLocaleString("he-IL")} עסקאות מכר נקיות · ${data.cities.length} ערים מרכזיות · נתוני שכירות חודשיים`
            : "טוען את מערך הנתונים הארצי..."}
        </p>
      </header>

      {error ? (
        <div className="surface-panel p-6 text-center text-rose-700">
          שגיאה בטעינת הנתונים: {error.message}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap gap-2 bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="surface-panel data-[state=active]:bg-[#0f766e] data-[state=active]:text-white px-4 py-2 text-sm font-medium"
            >
              <span className="me-2">{t.emoji}</span>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-3xl" />
            ))}
            <Skeleton className="col-span-full h-72 rounded-3xl" />
            <Skeleton className="col-span-full h-72 rounded-3xl" />
          </div>
        ) : data ? (
          <>
            <TabsContent value="overview">
              <OverviewTab data={data} />
            </TabsContent>
            <TabsContent value="macro">
              <MacroTab data={data} />
            </TabsContent>
            <TabsContent value="buy">
              <BuyExplorerTab data={data} />
            </TabsContent>
            <TabsContent value="rent">
              <RentalsTab data={data} />
            </TabsContent>
            <TabsContent value="compare">
              <ComparisonsTab data={data} />
            </TabsContent>
            <TabsContent value="quality">
              <QualityTab data={data} />
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </main>
  );
}
