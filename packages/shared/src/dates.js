/** Add or subtract whole days from a 'YYYY-MM-DD' string. */
export function shiftLocalDate(localDate, days) {
  const [y, m, d] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Human label for a 'YYYY-MM-DD' string, e.g. 'Wed 29 Jul'. */
export function formatLocalDate(localDate) {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
