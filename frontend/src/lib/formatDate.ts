import { format, isToday, isYesterday } from 'date-fns';

export function formatTimestamp(value: string | Date | null | undefined) {
  if (!value) return 'No timestamp';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No timestamp';

  if (isToday(date)) return `Today at ${format(date, 'p')}`;
  if (isYesterday(date)) return `Yesterday at ${format(date, 'p')}`;

  return format(date, 'MMM d, yyyy');
}
