/** Remove display punctuation only; preserve +, country prefixes and leading zeros. */
export function normalizeMemberPhone(value: string): string {
  return value.trim().replace(/[\s().-]/g, '');
}
export const memberPhonePattern = /^\+?\d{6,15}$/;
export const fitnessGoals = [
  'Weight Loss',
  'Weight Gain',
  'Muscle Gain',
  'Strength',
  'General Fitness',
  'Endurance',
  'Other',
] as const;
export function calendarToday(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
export function parseWeightGrams(value: string): number {
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(value.trim()))
    throw new Error('Enter weight in kg with at most three decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  const grams = Number(
    BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, '0')),
  );
  if (grams < 1 || grams > 1000000)
    throw new Error('Weight must be greater than zero and at most 1000 kg.');
  return grams;
}
