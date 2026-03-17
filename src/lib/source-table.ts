export type SourceTableRow = {
  source: "boi" | "cbs";
  series_key: string;
  series_label: string;
  observation_date: string;
  value: number;
  change: number | null;
  unit: string | null;
  category: string | null;
  region: string | null;
  base: string | null;
  is_partial: boolean;
};

const CSV_HEADER = [
  "source",
  "series_key",
  "series_label",
  "observation_date",
  "value",
  "change",
  "unit",
  "category",
  "region",
  "base",
  "is_partial",
] as const;

function escapeCsv(value: string | number | boolean | null) {
  if (value == null) {
    return "";
  }

  const text = String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function toCsv(rows: SourceTableRow[]) {
  const lines = [CSV_HEADER.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.source,
        row.series_key,
        row.series_label,
        row.observation_date,
        row.value,
        row.change,
        row.unit,
        row.category,
        row.region,
        row.base,
        row.is_partial,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}
