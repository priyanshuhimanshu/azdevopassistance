const pad = (n: number) => String(n).padStart(2, "0");

/** DD/MM/YYYY */
export function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(+d)) return "-";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** DD/MM/YYYY HH:mm (24h) */
export function formatDateTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(+d)) return "-";
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** HH:mm (24h) */
export function formatTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(+d)) return "-";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
