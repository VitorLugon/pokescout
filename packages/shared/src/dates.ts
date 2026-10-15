// Calendar dates only: parsing never assigns a tournament timezone.
export function publicEventDate(label: string): string | null {
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const first = /^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[\s\S]*?\b(\d{4})$/.exec(label.trim());
  const second = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/.exec(label.trim());
  if (!first && !second) return null;
  const month = months.indexOf((first ? first[1] : second![2]).toLowerCase());
  const day = Number(first ? first[2] : second![1]);
  const year = Number(first ? first[3] : second![3]);
  // An end-year alone cannot establish the start year of a cross-year range.
  if (first && months.some((name, index) => index < month && new RegExp(`\\b${name}\\b`, 'i').test(label))) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (month < 0 || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
