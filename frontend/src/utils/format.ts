const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('en-IN');

const valid = (d: Date) => !Number.isNaN(d.getTime());

export function formatDateTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return valid(d) ? dateTimeFmt.format(d) : '—';
}
export function formatDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return valid(d) ? dateFmt.format(d) : '—';
}
/** "2026-11-11" (a calendar date, not an instant) → "11 Nov" without timezone shifting. */
export function formatDay(isoDay: string): string {
  const [y, m, d] = isoDay.slice(0, 10).split('-').map(Number);
  return shortDateFmt.format(new Date(y, (m ?? 1) - 1, d ?? 1));
}
export function formatRelative(v: string | null | undefined): string {
  if (!v) return 'Never';
  const d = new Date(v);
  if (!valid(d)) return '—';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (abs < min) return diff >= 0 ? 'Just now' : 'In under a minute';
  const fmt = (n: number, unit: string) => {
    const r = Math.round(n);
    const label = `${r} ${unit}${r === 1 ? '' : 's'}`;
    return diff >= 0 ? `${label} ago` : `in ${label}`;
  };
  if (abs < hr) return fmt(abs / min, 'minute');
  if (abs < day) return fmt(abs / hr, 'hour');
  if (abs < 30 * day) return fmt(abs / day, 'day');
  return formatDate(v);
}
export const formatINR = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === '' ? '—' : inrFmt.format(Number(v));
export const formatNumber = (v: number | null | undefined) => (v === null || v === undefined ? '—' : numFmt.format(v));
export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
/** "site_visit_requested" → "Site visit requested" */
export function humanize(v: string | null | undefined): string {
  if (!v) return '—';
  const s = v.replace(/[_.]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8) : '—');
export const yesNo = (b: boolean | null | undefined) => (b ? 'Yes' : 'No');
