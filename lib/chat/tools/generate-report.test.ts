import { describe, expect, it, vi } from "vitest";
import { GenerateReportInputSchema } from "@/lib/invoices/types";
import { SEEDED_EXCHANGE_RATES } from "@/lib/money/seed-rates";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));

const dbState = vi.hoisted(() => ({
  groups: [] as Array<{
    key: string;
    currency: string;
    count: number;
    sum: string | number | null;
  }>,
}));

vi.mock("@/lib/db", () => {
  function selectChain() {
    const chain = {
      from: () => chain,
      where: () => chain,
      groupBy: () => chain,
      then(
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(dbState.groups).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    db: {
      select: vi.fn(() => selectChain()),
    },
  };
});

vi.mock("@/lib/db/exchange-rates", () => ({
  loadExchangeRatesOnOrBefore: vi.fn(async () => SEEDED_EXCHANGE_RATES),
}));

import { generateReport } from "@/lib/invoices/report";
import { generateReportTool } from "./generate-report";

describe("GenerateReportInputSchema", () => {
  it("defaults groupBy to category and accepts a supported currency", () => {
    expect(GenerateReportInputSchema.parse({ period: "month" })).toEqual({
      period: "month",
      groupBy: "category",
    });
    expect(
      GenerateReportInputSchema.parse({
        period: "year",
        year: 2024,
        groupBy: "category",
      }),
    ).toMatchObject({ period: "year", year: 2024 });
    expect(
      GenerateReportInputSchema.parse({
        period: "quarter",
        groupBy: "vendor",
        currency: "EUR",
      }),
    ).toMatchObject({ groupBy: "vendor", currency: "EUR" });
  });

  it("rejects an unknown period or currency", () => {
    expect(
      GenerateReportInputSchema.safeParse({ period: "week" }).success,
    ).toBe(false);
    expect(
      GenerateReportInputSchema.safeParse({
        period: "month",
        currency: "GBP",
      }).success,
    ).toBe(false);
  });
});

describe("generateReport tool", () => {
  it("aggregates mocked DB groups and converts to one currency", async () => {
    dbState.groups = [
      { key: "software", currency: "USD", count: 1, sum: 220 },
      { key: "software", currency: "EUR", count: 1, sum: 180 },
    ];

    const report = await generateReport({
      userId: "user-1",
      filters: { period: "year", groupBy: "category", currency: "USD" },
      now: new Date("2026-08-19T12:00:00.000Z"),
    });

    expect(report).toMatchObject({
      period: "year",
      groupBy: "category",
      currency: "USD",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });
    expect(report).not.toHaveProperty("error");
    if ("error" in report) {
      return;
    }
    expect(report.rows[0]).toMatchObject({ key: "software", count: 2 });
  });

  it("uses a named year instead of the current calendar year", async () => {
    dbState.groups = [];

    const report = await generateReport({
      userId: "user-1",
      filters: { period: "year", year: 2024, groupBy: "category" },
      now: new Date("2026-08-19T12:00:00.000Z"),
    });

    expect(report).toMatchObject({
      period: "year",
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
    });
  });

  it("passes the signed-in user through the tool execute wrapper", async () => {
    dbState.groups = [
      { key: "Acme", currency: "USD", count: 1, sum: "100" },
    ];

    const result = await generateReportTool.execute!(
      { period: "month", groupBy: "vendor" },
      {
        toolCallId: "rpt-1",
        messages: [],
        context: { userId: "user-1" },
      } as never,
    );

    expect(result).toMatchObject({
      period: "month",
      groupBy: "vendor",
      currency: "USD",
      rows: [{ key: "Acme", amount: 100, count: 1 }],
      total: 100,
    });
  });
});
