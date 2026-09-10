/** Supported business currencies currently all have two decimal minor units. */
export function parseMoneyMinor(input: string): number {
  const value = input.trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value))
    throw new Error('Enter an amount with at most two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const minor = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Amount is too large.');
  return Number(minor);
}
export function moneyInputValue(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new Error('Amount must be a non-negative integer.');
  const value = BigInt(minor);
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
export function formatMoneyMinor(minor: number, currency: string): string {
  const value = moneyInputValue(minor);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
