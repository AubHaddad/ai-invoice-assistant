import { z } from "zod";
import {
  MONEY_DECIMAL_PLACES,
  roundMoney,
  toDecimal,
} from "./precision";

export const CALCULATE_OPERATIONS = ["sum", "avg", "percent", "vat"] as const;

export type CalculateOperation = (typeof CALCULATE_OPERATIONS)[number];

/** Moroccan VAT rates the assistant is expected to handle. */
export const MAD_VAT_RATES = [20, 10, 7] as const;

export const CalculateInputSchema = z
  .object({
    operation: z.enum(CALCULATE_OPERATIONS),
    values: z
      .array(z.number().finite())
      .min(1)
      .describe("Amounts to operate on. For vat, these are exclusive (HT) amounts."),
    rate: z
      .number()
      .finite()
      .nonnegative()
      .optional()
      .describe(
        "Percentage rate. Required for vat. For percent, the share of the values (e.g. 20 for 20%).",
      ),
  })
  .describe(
    "Decimal-safe invoice math. Use vat with rate 20, 10, or 7 for Moroccan MAD invoices.",
  );

export type CalculateInput = z.infer<typeof CalculateInputSchema>;

type CalculateMeta = {
  decimalPlaces: typeof MONEY_DECIMAL_PLACES;
  rounding: "half-up";
};

export type CalculateSuccess = {
  ok: true;
  operation: CalculateOperation;
  values: number[];
  result: number;
  rate?: number;
  net?: number;
  vat?: number;
  gross?: number;
} & CalculateMeta;

export type CalculateFailure = {
  ok: false;
  error: string;
};

export type CalculateResult = CalculateSuccess | CalculateFailure;

function meta(): CalculateMeta {
  return {
    decimalPlaces: MONEY_DECIMAL_PLACES,
    rounding: "half-up",
  };
}

function sumValues(values: number[]) {
  return values.reduce((total, value) => total.plus(value), toDecimal(0));
}

export function calculate(input: CalculateInput): CalculateResult {
  const parsed = CalculateInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { operation, values, rate } = parsed.data;

  switch (operation) {
    case "sum": {
      return {
        ok: true,
        operation,
        values,
        result: roundMoney(sumValues(values)),
        ...meta(),
      };
    }
    case "avg": {
      return {
        ok: true,
        operation,
        values,
        result: roundMoney(sumValues(values).div(values.length)),
        ...meta(),
      };
    }
    case "percent": {
      if (rate == null) {
        return {
          ok: false,
          error: "percent requires a rate (e.g. 20 for 20%).",
        };
      }

      return {
        ok: true,
        operation,
        values,
        rate,
        result: roundMoney(sumValues(values).times(rate).div(100)),
        ...meta(),
      };
    }
    case "vat": {
      if (rate == null) {
        return {
          ok: false,
          error: "vat requires a rate. Moroccan MAD rates are 20, 10, and 7.",
        };
      }

      const net = roundMoney(sumValues(values));
      const vat = roundMoney(toDecimal(net).times(rate).div(100));
      const gross = roundMoney(toDecimal(net).plus(vat));

      return {
        ok: true,
        operation,
        values,
        rate,
        result: vat,
        net,
        vat,
        gross,
        ...meta(),
      };
    }
  }
}
