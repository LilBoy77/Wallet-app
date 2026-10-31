/**
 * Utility to calculate month calendar date boundaries (YYYY-MM-DD).
 * Actual TIMESTAMPTZ realization boundaries are evaluated in PostgreSQL
 * using parameterized `AT TIME ZONE` and half-open intervals `[start_date, end_date + 1 day)`.
 */
export function getMonthDateRangeInTimezone(
  year: number,
  month: number // 1 - 12
): {
  startDateStr: string;
  endDateStr: string;
} {
  const padMonth = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const padLastDay = String(lastDay).padStart(2, '0');

  const startDateStr = `${year}-${padMonth}-01`;
  const endDateStr = `${year}-${padMonth}-${padLastDay}`;

  return {
    startDateStr,
    endDateStr,
  };
}

export function parseDateRange(
  month?: number,
  year?: number,
  startDate?: string,
  endDate?: string,
  timezone: string = 'Asia/Jakarta'
): {
  startDateStr: string;
  endDateStr: string;
  month: number;
  year: number;
} {
  if (month && year) {
    const range = getMonthDateRangeInTimezone(year, month);
    return { ...range, month, year };
  }

  if (startDate && endDate) {
    const startParts = startDate.split('-').map(Number);
    const parsedYear = startParts[0]!;
    const parsedMonth = startParts[1]!;

    return {
      startDateStr: startDate,
      endDateStr: endDate,
      month: parsedMonth,
      year: parsedYear,
    };
  }

  // Default to current calendar month in configured timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.format(now).split('-');
  const currentYear = parseInt(parts[0]!, 10);
  const currentMonth = parseInt(parts[1]!, 10);

  const range = getMonthDateRangeInTimezone(currentYear, currentMonth);
  return { ...range, month: currentMonth, year: currentYear };
}
