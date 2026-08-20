import { describe, expect, it, vi } from "vitest";
import { QueryInvoicesInputSchema } from "./types";

vi.mock("server-only", () => ({}));

const dbState = vi.hoisted(() => ({
  groups: [] as Array<{
    currency: string;
    count: number;
    sum: string | number | null;
  }>,
  rows: [] as Array<{
    id: string;
    vendor: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string | null;
    category: string | null;
    currency: string;
    total: number;
  }>,
}));

vi.mock("@/lib/db", () => {
  function selectChain() {
    let grouped = false;
    const chain = {
      from: () => chain,
      where: () => chain,
      groupBy: () => {
        grouped = true;
        return chain;
      },
      orderBy: () => chain,
      limit: () => chain,
      then(
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(grouped ? dbState.groups : dbState.rows).then(
          resolve,
          reject,
        );
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

import { invoiceWhere, queryInvoices } from "./query";

function sqlSnapshot(value: unknown) {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, current) => {
    if (typeof current === "object" && current !== null) {
      if (seen.has(current)) {
        return undefined;
      }
      seen.add(current);
    }
    return current;
  });
}

describe("QueryInvoicesInputSchema", () => {
  it("accepts optional filters and a category enum value", () => {
    expect(
      QueryInvoicesInputSchema.parse({
        vendor: "Acme",
        dateFrom: "2026-04-01",
        dateTo: "2026-06-30",
        category: "software",
        minAmount: 10,
        maxAmount: 500,
        currency: "EUR",
        limit: 10,
      }),
    ).toMatchObject({
      vendor: "Acme",
      category: "software",
      currency: "EUR",
    });
  });

  it("rejects a category outside the enum, a bad date, and an out-of-range limit", () => {
    expect(
      QueryInvoicesInputSchema.safeParse({ category: "legal" }).success,
    ).toBe(false);
    expect(
      QueryInvoicesInputSchema.safeParse({ dateFrom: "June 1" }).success,
    ).toBe(false);
    expect(QueryInvoicesInputSchema.safeParse({ limit: 0 }).success).toBe(
      false,
    );
    expect(QueryInvoicesInputSchema.safeParse({ limit: 51 }).success).toBe(
      false,
    );
  });
});

describe("invoiceWhere", () => {
  it("always scopes to the signed-in user", () => {
    const snapshot = sqlSnapshot(invoiceWhere("user-1", {}));
    expect(snapshot).toContain("user-1");
    expect(snapshot).toContain("user_id");
  });

  it("builds vendor, date, category, amount, and currency filters", () => {
    const snapshot = sqlSnapshot(
      invoiceWhere("user-1", {
        vendor: "Acme_%Corp",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        category: "travel",
        minAmount: 50,
        maxAmount: 200,
        currency: "eur",
      }),
    );

    expect(snapshot).toContain("%AcmeCorp%");
    expect(snapshot).not.toContain("Acme_%");
    expect(snapshot).toContain("2026-06-01");
    expect(snapshot).toContain("2026-06-30");
    expect(snapshot).toContain("travel");
    expect(snapshot).toContain("50");
    expect(snapshot).toContain("200");
    expect(snapshot).toContain("EUR");
    expect(snapshot).toContain("issue_date");
    expect(snapshot).toContain("ilike");
  });
});

describe("queryInvoices", () => {
  it("returns mapped invoices and a single-currency summary", async () => {
    dbState.groups = [{ currency: "USD", count: 2, sum: "1320.50" }];
    dbState.rows = [
      {
        id: "inv-1",
        vendor: "Acme",
        invoiceNumber: "INV-1",
        issueDate: "2026-08-01",
        dueDate: null,
        category: "software",
        currency: "USD",
        total: 1320.5,
      },
    ];

    const result = await queryInvoices({
      userId: "user-1",
      filters: { vendor: "Acme", category: "software" },
    });

    expect(result.invoices).toEqual([
      expect.objectContaining({
        id: "inv-1",
        category: "software",
        total: 1320.5,
      }),
    ]);
    expect(result.summary).toEqual({
      count: 2,
      sum: 1320.5,
      currency: "USD",
      returned: 1,
    });
  });

  it("nulls mixed-currency totals and clamps unknown categories", async () => {
    dbState.groups = [
      { currency: "USD", count: 1, sum: 100 },
      { currency: "EUR", count: 1, sum: null },
    ];
    dbState.rows = [
      {
        id: "inv-2",
        vendor: "Legal Co",
        invoiceNumber: "INV-2",
        issueDate: "2026-08-02",
        dueDate: "2026-09-01",
        category: "legal",
        currency: "USD",
        total: 100,
      },
    ];

    const result = await queryInvoices({
      userId: "user-1",
      filters: {},
    });

    expect(result.invoices[0]?.category).toBeNull();
    expect(result.summary).toEqual({
      count: 2,
      sum: 100,
      currency: null,
      returned: 1,
    });
  });
});
