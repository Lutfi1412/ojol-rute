/** "850 m" / "12,4 km" */
export function formatDistance(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return "-";

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  const distanceKilometers = distanceMeters / 1000;
  const fractionDigits = distanceKilometers < 10 ? 1 : 0;

  return `${distanceKilometers.toLocaleString("id-ID", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} km`;
}

/** "8 mnt" / "1 jam 12 mnt" */
export function formatDuration(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return "-";

  const totalMinutes = Math.round(durationSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} mnt`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours} jam` : `${hours} jam ${minutes} mnt`;
}
