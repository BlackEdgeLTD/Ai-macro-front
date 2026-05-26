import { NadlanDashboardApp } from "@/components/nadlan-dashboard-app";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "נדל״ן ישראל — חוקר עסקאות ושכירות",
  description: "מסך נדל״ן ישראל: עסקאות מכר, שכירות, מאקרו ואיכות נתונים",
};

export default function NadlanPage() {
  return <NadlanDashboardApp />;
}
