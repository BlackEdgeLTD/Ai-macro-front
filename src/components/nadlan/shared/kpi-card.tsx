import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

import { fmtSignedPct } from "./formatters";

type KpiCardProps = {
  label: string;
  value: string;
  detail?: string;
  yoy?: number | null;
  accent?: string;
  className?: string;
};

export function KpiCard({
  label,
  value,
  detail,
  yoy,
  accent = "linear-gradient(135deg, #0f766e 0%, #2563eb 100%)",
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("metric-panel border-0 shadow-none", className)}>
      <CardContent className="p-5">
        <div
          className="mb-4 h-2 w-20 rounded-full"
          style={{ background: accent }}
        />
        <p className="text-sm text-[#64748b]">{label}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-[#13202b]">
          {value}
        </p>
        {(detail || yoy != null) && (
          <p className="mt-2 flex items-baseline gap-2 text-sm text-[#64748b]">
            {yoy != null && (
              <span
                className={cn(
                  "font-semibold",
                  yoy >= 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {fmtSignedPct(yoy)}
              </span>
            )}
            {detail && <span>{detail}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
