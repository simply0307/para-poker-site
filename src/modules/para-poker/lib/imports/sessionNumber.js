export function positiveSessionNumber(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function nextSessionNumber(rows = []) {
  const currentMaximum = rows.reduce((maximum, row) => {
    const candidate = positiveSessionNumber(row?.session_number);
    return candidate === null ? maximum : Math.max(maximum, candidate);
  }, 0);
  return currentMaximum + 1;
}
