export type DateInput = Date | string;

export type DateRangeInput = {
  startDate: DateInput;
  endDate: DateInput;
};

export type NormalizedDateRange = {
  startDate: Date;
  endDate: Date;
};

export function toSqlDateString(input: DateInput): string {
  return parseDateInput(input).toISOString().slice(0, 10);
}

export function toSqlTimestamp(input: DateInput): Date {
  return parseDateInput(input);
}

export function toIsoString(input: DateInput | null | undefined): string | null {
  if (!input) {
    return null;
  }

  return parseDateInput(input).toISOString();
}

export function normalizeDateRange(input: DateRangeInput): NormalizedDateRange {
  const startDate = toSqlTimestamp(input.startDate);
  const endDate = toSqlTimestamp(input.endDate);

  if (endDate <= startDate) {
    throw new RangeError("endDate must be after startDate.");
  }

  return { startDate, endDate };
}

export function startOfDayUtc(input: DateInput): Date {
  const date = parseDateInput(input);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfDayUtc(input: DateInput): Date {
  const date = startOfDayUtc(input);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

export function startOfMonthUtc(input: DateInput): Date {
  const date = parseDateInput(input);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonthUtc(input: DateInput): Date {
  const date = parseDateInput(input);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function parseDateInput(input: DateInput): Date {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date input.");
  }

  return date;
}
