import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

/** "12 Okt 2026, 14:30" */
export function formatDateTime(isoTimestamp: string): string {
  const parsedDate = parseISO(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return format(parsedDate, "d MMM yyyy, HH:mm", { locale: localeId });
}

/** "14:30" atau "Kemarin, 14:30" — ringkas untuk daftar rute. */
export function formatRelativeDate(isoTimestamp: string): string {
  const parsedDate = parseISO(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  if (isToday(parsedDate)) return `Hari ini, ${format(parsedDate, "HH:mm")}`;
  if (isYesterday(parsedDate)) return `Kemarin, ${format(parsedDate, "HH:mm")}`;

  return format(parsedDate, "d MMM yyyy", { locale: localeId });
}

/** "3 menit lalu" */
export function formatTimeAgo(isoTimestamp: string): string {
  const parsedDate = parseISO(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return `${formatDistanceToNowStrict(parsedDate, { locale: localeId })} lalu`;
}

/** Jam singkat untuk estimasi tiba: "14:07" */
export function formatClock(isoTimestamp: string): string {
  const parsedDate = parseISO(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return format(parsedDate, "HH:mm");
}
