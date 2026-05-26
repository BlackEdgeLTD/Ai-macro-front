export const numberFormatter = new Intl.NumberFormat("he-IL");

export const preciseFormatter = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 2,
});

export const compactFormatter = new Intl.NumberFormat("he-IL", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return numberFormatter.format(n);
}

export function fmtCurrency(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return "₪" + numberFormatter.format(Math.round(n));
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toFixed(digits) + "%";
}

export function fmtSignedPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function ymToMonthYear(ym: number): string {
  const y = Math.floor(ym / 12);
  const m = (ym % 12) + 1;
  return `${String(m).padStart(2, "0")}/${y}`;
}
