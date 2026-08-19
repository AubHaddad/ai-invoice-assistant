import { describe, expect, it } from "vitest";
import { SEEDED_EXCHANGE_RATES } from "@/lib/money/seed-rates";
import {
  buildReportResult,
  conversionAsOfDate,
  periodRange,
  pickTargetCurrency,
  reportCsvFileName,
  reportToCsv,
} from "./report-utils";
import type { GenerateReportInput } from "./types";

const monthlyByCategory: GenerateReportInput = {
  period: "month",
  groupBy: "category",
};

describe("periodRange", () => {
  it("uses the current calendar month, quarter, and year", () => {
    expect(periodRange("month", "2026-08-19")).toEqual({
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
    });
    expect(periodRange("quarter", "2026-08-19")).toEqual({
      dateFrom: "2026-07-01",
      dateTo: "2026-09-30",
    });
    expect(periodRange("year", "2026-08-19")).toEqual({
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });
  });

  it("covers quarter boundaries and leap-year February", () => {
    expect(periodRange("quarter", "2026-02-01")).toEqual({
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    });
    expect(periodRange("quarter", "2026-12-31")).toEqual({
      dateFrom: "2026-10-01",
      dateTo: "2026-12-31",
    });
    expect(periodRange("month", "2028-02-10")).toEqual({
      dateFrom: "2028-02-01",
      dateTo: "2028-02-29",
    });
  });
});

describe("conversionAsOfDate", () => {
  it("does not use a future period-end date", () => {
    expect(conversionAsOfDate("2026-08-31", "2026-08-19")).toBe("2026-08-19");
    expect(conversionAsOfDate("2026-03-31", "2026-08-19")).toBe("2026-03-31");
  });
});

describe("pickTargetCurrency", () => {
  it("prefers the requested currency, then the most common invoice currency", () => {
    const groups = [
      { key: "software", currency: "USD", count: 2, sum: 100 },
      { key: "travel", currency: "EUR", count: 5, sum: 50 },
    ];

    expect(pickTargetCurrency(groups, "MAD")).toBe("MAD");
    expect(pickTargetCurrency(groups)).toBe("EUR");
    expect(pickTargetCurrency([])).toBe("USD");
  });
});

describe("buildReportResult", () => {
  it("converts mixed currencies and merges the same category", () => {
    const built = buildReportResult({
      input: { period: "year", groupBy: "category", currency: "USD" },
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      groups: [
        { key: "software", currency: "USD", count: 1, sum: 220 },
        { key: "software", currency: "EUR", count: 1, sum: 180 },
        { key: "travel", currency: "MAD", count: 1, sum: 998 },
      ],
      rates: SEEDED_EXCHANGE_RATES,
      asOfDate: "2026-08-19",
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    expect(built.report.currency).toBe("USD");
    expect(built.report.rows).toEqual([
      { key: "software", label: "Software", amount: 416.95, count: 2 },
      { key: "travel", label: "Travel", amount: 100, count: 1 },
    ]);
    expect(built.report.total).toBe(516.95);
  });

  it("returns a monthly category report with a single converted total", () => {
    const built = buildReportResult({
      input: monthlyByCategory,
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      groups: [
        { key: "software", currency: "USD", count: 1, sum: 1320 },
      ],
      rates: SEEDED_EXCHANGE_RATES,
      asOfDate: "2026-08-19",
    });

    expect(built).toEqual({
      ok: true,
      report: {
        period: "month",
        groupBy: "category",
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
        rows: [{ key: "software", label: "Software", amount: 1320, count: 1 }],
        total: 1320,
        currency: "USD",
      },
    });
  });

  it("fails when a rate is missing", () => {
    const built = buildReportResult({
      input: { period: "month", groupBy: "vendor", currency: "USD" },
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      groups: [{ key: "Acme", currency: "GBP", count: 1, sum: 10 }],
      rates: SEEDED_EXCHANGE_RATES,
      asOfDate: "2026-08-19",
    });

    expect(built.ok).toBe(false);
    if (built.ok) {
      return;
    }

    expect(built.error).toMatch(/Unsupported currency/i);
  });
});

describe("reportToCsv", () => {
  it("escapes vendor names and includes a total row", () => {
    const csv = reportToCsv({
      period: "month",
      groupBy: "vendor",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      rows: [
        { key: "Acme, Inc.", label: "Acme, Inc.", amount: 1320, count: 1 },
      ],
      total: 1320,
      currency: "USD",
    });

    expect(csv).toBe(
      [
        "Vendor,Amount,Invoices,Currency",
        '"Acme, Inc.",1320.00,1,USD',
        "Total,1320.00,1,USD",
        "",
      ].join("\n"),
    );
    expect(reportCsvFileName({
      period: "month",
      groupBy: "vendor",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      rows: [],
      total: 0,
      currency: "USD",
    })).toBe("spending-month-by-vendor.csv");
  });
});
