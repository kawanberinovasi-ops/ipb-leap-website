export const periods = [3, 6, 9, 12];

const names = {
  3: 'Foundation',
  6: 'Action',
  9: 'Acceleration',
  12: 'Sustainable Impact',
};

export function phaseName(period) {
  return names[period] ?? 'Fase belum ditetapkan';
}

const month = new Intl.DateTimeFormat('id-ID', {month: 'long', timeZone: 'UTC'});

export function phaseDates(period, startsOn) {
  if (!periods.includes(period) || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn ?? '')) return '';
  const [year, startMonth] = startsOn.split('-').map(Number);
  const first = new Date(Date.UTC(year, startMonth + period - 4, 1));
  const last = new Date(Date.UTC(year, startMonth + period - 2, 1));
  const firstYear = first.getUTCFullYear(), lastYear = last.getUTCFullYear();
  return `${month.format(first)}${firstYear === lastYear ? '' : ' ' + firstYear}–${month.format(last)} ${lastYear}`;
}
