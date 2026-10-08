export function accuracyFromEvents(events) {
  if (!events.length) return null;
  const correct = events.filter((event) => event.correct).length;
  return correct / events.length * 100;
}

export function formatPercent(value) {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value >= 100) return '100%';
  let digits = 1;
  while (Number(value.toFixed(digits)) === 100 && digits < 4) digits++;
  return `${value.toFixed(digits)}%`;
}

export function formatAccuracy(events) {
  return formatPercent(accuracyFromEvents(events));
}
