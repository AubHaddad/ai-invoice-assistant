import Decimal from "decimal.js";

/** Invoice money is stored and displayed to the centime / cent. */
export const MONEY_DECIMAL_PLACES = 2;

/** Quoted FX rates keep 8 decimal places for citation. */
export const RATE_DECIMAL_PLACES = 8;

/** Half away from zero — the rounding used for money and quoted rates. */
export const MONEY_ROUNDING = Decimal.ROUND_HALF_UP;

const MoneyDecimal = Decimal.clone({
  precision: 40,
  rounding: MONEY_ROUNDING,
});

export function toDecimal(value: Decimal.Value) {
  return new MoneyDecimal(value);
}

export function roundTo(
  value: Decimal.Value,
  decimalPlaces: number,
): Decimal {
  return toDecimal(value).toDecimalPlaces(decimalPlaces, MONEY_ROUNDING);
}

export function roundMoney(value: Decimal.Value) {
  return roundTo(value, MONEY_DECIMAL_PLACES).toNumber();
}

export function roundRate(value: Decimal.Value) {
  return roundTo(value, RATE_DECIMAL_PLACES).toNumber();
}

export function rateString(value: Decimal.Value) {
  return roundTo(value, RATE_DECIMAL_PLACES).toFixed(RATE_DECIMAL_PLACES);
}
