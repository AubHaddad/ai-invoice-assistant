export const SUPPORTED_CURRENCIES = ["MAD", "EUR", "USD"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const supported = new Set<string>(SUPPORTED_CURRENCIES);

export function isSupportedCurrency(
  value: string,
): value is SupportedCurrency {
  return supported.has(value);
}

export function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}
