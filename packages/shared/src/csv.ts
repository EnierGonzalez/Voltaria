export type CsvColumn<TRecord extends Record<string, unknown>> = {
  key: keyof TRecord;
  header: string;
};

export function toCsv<TRecord extends Record<string, unknown>>(
  rows: TRecord[],
  columns: CsvColumn<TRecord>[]
) {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key])).join(",")
  );

  return [header, ...body].join("\n");
}

function escapeCsvValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
