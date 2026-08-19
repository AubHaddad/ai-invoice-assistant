import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import { roundMoney } from "./precision";

describe("roundMoney", () => {
  it("rounds half away from zero to two decimal places", () => {
    expect(roundMoney("1.005")).toBe(1.01);
    expect(roundMoney("2.675")).toBe(2.68);
    expect(roundMoney("1.004")).toBe(1);
    expect(roundMoney("-1.005")).toBe(-1.01);
  });

  it("sums 0.1 and 0.2 without binary float error", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(calculate({ operation: "sum", values: [0.1, 0.2] })).toMatchObject({
      ok: true,
      result: 0.3,
    });
  });
});

describe("calculate", () => {
  it("sums and averages with the money precision rule", () => {
    expect(calculate({ operation: "sum", values: [10.105, 0.1, 0.2] })).toMatchObject({
      ok: true,
      result: 10.41,
      rounding: "half-up",
      decimalPlaces: 2,
    });
    expect(calculate({ operation: "avg", values: [10, 20, 21] })).toMatchObject({
      ok: true,
      result: 17,
    });
  });

  it("applies a percent rate to the sum of values", () => {
    expect(
      calculate({ operation: "percent", values: [200, 50], rate: 20 }),
    ).toMatchObject({
      ok: true,
      result: 50,
      rate: 20,
    });
  });

  it("requires a rate for percent and vat", () => {
    expect(calculate({ operation: "percent", values: [100] })).toMatchObject({
      ok: false,
    });
    expect(calculate({ operation: "vat", values: [100] })).toMatchObject({
      ok: false,
    });
  });
});

describe("VAT (MAD 20%, 10%, 7%)", () => {
  it("computes 20% Moroccan VAT on exclusive amounts", () => {
    expect(
      calculate({ operation: "vat", values: [100], rate: 20 }),
    ).toMatchObject({
      ok: true,
      net: 100,
      vat: 20,
      gross: 120,
      result: 20,
      rate: 20,
    });
  });

  it("computes 10% Moroccan VAT on exclusive amounts", () => {
    expect(
      calculate({ operation: "vat", values: [100], rate: 10 }),
    ).toMatchObject({
      ok: true,
      net: 100,
      vat: 10,
      gross: 110,
    });
  });

  it("computes 7% Moroccan VAT on exclusive amounts", () => {
    expect(
      calculate({ operation: "vat", values: [100], rate: 7 }),
    ).toMatchObject({
      ok: true,
      net: 100,
      vat: 7,
      gross: 107,
    });
  });

  it("rounds VAT half-up to the centime for each MAD rate", () => {
    expect(
      calculate({ operation: "vat", values: [19.99], rate: 20 }),
    ).toMatchObject({
      ok: true,
      net: 19.99,
      vat: 4,
      gross: 23.99,
    });

    expect(
      calculate({ operation: "vat", values: [123.45], rate: 10 }),
    ).toMatchObject({
      ok: true,
      net: 123.45,
      vat: 12.35,
      gross: 135.8,
    });

    expect(
      calculate({ operation: "vat", values: [88.88], rate: 7 }),
    ).toMatchObject({
      ok: true,
      net: 88.88,
      vat: 6.22,
      gross: 95.1,
    });
  });

  it("sums line amounts before applying MAD VAT", () => {
    expect(
      calculate({ operation: "vat", values: [50, 25.5, 24.5], rate: 20 }),
    ).toMatchObject({
      ok: true,
      net: 100,
      vat: 20,
      gross: 120,
    });
  });
});
