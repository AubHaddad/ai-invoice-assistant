import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray } from "drizzle-orm";
import { InvoiceSchema, type Invoice } from "@/lib/schemas";
import { invoiceInsertValues, lineItemInsertValues } from "./invoices";
import { documents, invoices, lineItems, users } from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const db = drizzle(databaseUrl);

const SEED_EMAIL = "aub.haddad@gmail.com";

const SEEDED_INVOICES: Array<Invoice & { fileName: string; gcsPath: string }> = [
  {
    fileName: "github-inv-2041.pdf",
    gcsPath: "seed/github-inv-2041.pdf",
    vendor: "GitHub",
    invoiceNumber: "INV-2041",
    issueDate: "2026-04-12",
    dueDate: "2026-05-12",
    currency: "USD",
    subtotal: 200,
    tax: 20,
    total: 220,
    category: "software",
    confidence: 0.95,
    raw: { vendorName: "GitHub", invoiceNumber: "INV-2041" },
    lineItems: [
      {
        description: "Team plan — April",
        quantity: 1,
        unitPrice: 200,
        amount: 200,
      },
    ],
  },
  {
    fileName: "figma-inv-2042.pdf",
    gcsPath: "seed/figma-inv-2042.pdf",
    vendor: "Figma",
    invoiceNumber: "INV-2042",
    issueDate: "2026-05-18",
    dueDate: "2026-06-17",
    currency: "EUR",
    subtotal: 150,
    tax: 30,
    total: 180,
    category: "software",
    confidence: 0.94,
    raw: { vendorName: "Figma", invoiceNumber: "INV-2042" },
    lineItems: [
      {
        description: "Organization seat — May",
        quantity: 1,
        unitPrice: 150,
        amount: 150,
      },
    ],
  },
  {
    fileName: "jetbrains-inv-2043.pdf",
    gcsPath: "seed/jetbrains-inv-2043.pdf",
    vendor: "JetBrains",
    invoiceNumber: "INV-2043",
    issueDate: "2026-06-09",
    dueDate: "2026-07-09",
    currency: "MAD",
    subtotal: 1820,
    tax: 364,
    total: 2184,
    category: "software",
    confidence: 0.93,
    raw: { vendorName: "JetBrains", invoiceNumber: "INV-2043" },
    lineItems: [
      {
        description: "All Products Pack — June",
        quantity: 1,
        unitPrice: 1820,
        amount: 1820,
      },
    ],
  },
  {
    fileName: "acme-inv-1042.pdf",
    gcsPath: "seed/acme-inv-1042.pdf",
    vendor: "Acme Corp",
    invoiceNumber: "INV-1042",
    issueDate: "2026-08-01",
    dueDate: "2026-08-31",
    currency: "USD",
    subtotal: 1200,
    tax: 120,
    total: 1320,
    category: "software",
    confidence: 0.96,
    raw: { vendorName: "Acme Corp", invoiceNumber: "INV-1042" },
    lineItems: [
      {
        description: "API usage — August",
        quantity: 1,
        unitPrice: 1200,
        amount: 1200,
      },
    ],
  },
  {
    fileName: "ram-inv-3108.pdf",
    gcsPath: "seed/ram-inv-3108.pdf",
    vendor: "Royal Air Maroc",
    invoiceNumber: "INV-3108",
    issueDate: "2026-08-05",
    dueDate: "2026-08-20",
    currency: "MAD",
    subtotal: 3800,
    tax: 760,
    total: 4560,
    category: "travel",
    confidence: 0.94,
    raw: { vendorName: "Royal Air Maroc", invoiceNumber: "INV-3108" },
    lineItems: [
      {
        description: "Round-trip CMN-CDG — August",
        quantity: 1,
        unitPrice: 3800,
        amount: 3800,
      },
    ],
  },
  {
    fileName: "marriott-inv-3107.pdf",
    gcsPath: "seed/marriott-inv-3107.pdf",
    vendor: "Marriott",
    invoiceNumber: "INV-3107",
    issueDate: "2026-07-22",
    dueDate: "2026-08-05",
    currency: "EUR",
    subtotal: 540,
    tax: 108,
    total: 648,
    category: "travel",
    confidence: 0.93,
    raw: { vendorName: "Marriott", invoiceNumber: "INV-3107" },
    lineItems: [
      {
        description: "Hotel stay 3 nights, Paris",
        quantity: 3,
        unitPrice: 180,
        amount: 540,
      },
    ],
  },
  {
    fileName: "cafe-clock-inv-4081.pdf",
    gcsPath: "seed/cafe-clock-inv-4081.pdf",
    vendor: "Cafe Clock",
    invoiceNumber: "INV-4081",
    issueDate: "2026-08-08",
    dueDate: null,
    currency: "MAD",
    subtotal: 800,
    tax: 80,
    total: 880,
    category: "meals",
    confidence: 0.91,
    raw: { vendorName: "Cafe Clock", invoiceNumber: "INV-4081" },
    lineItems: [
      {
        description: "Team lunch for 6 people",
        quantity: 1,
        unitPrice: 800,
        amount: 800,
      },
    ],
  },
  {
    fileName: "comptoir-inv-4082.pdf",
    gcsPath: "seed/comptoir-inv-4082.pdf",
    vendor: "Restaurant Le Grand Comptoir",
    invoiceNumber: "INV-4082",
    issueDate: "2026-07-15",
    dueDate: null,
    currency: "EUR",
    subtotal: 210,
    tax: 21,
    total: 231,
    category: "meals",
    confidence: 0.9,
    raw: {
      vendorName: "Restaurant Le Grand Comptoir",
      invoiceNumber: "INV-4082",
    },
    lineItems: [
      {
        description: "Client dinner",
        quantity: 1,
        unitPrice: 210,
        amount: 210,
      },
    ],
  },
  {
    fileName: "ikea-inv-5110.pdf",
    gcsPath: "seed/ikea-inv-5110.pdf",
    vendor: "IKEA",
    invoiceNumber: "INV-5110",
    issueDate: "2026-08-11",
    dueDate: "2026-08-25",
    currency: "EUR",
    subtotal: 350,
    tax: 70,
    total: 420,
    category: "office",
    confidence: 0.95,
    raw: { vendorName: "IKEA", invoiceNumber: "INV-5110" },
    lineItems: [
      {
        description: "Standing desk and office chair",
        quantity: 1,
        unitPrice: 350,
        amount: 350,
      },
    ],
  },
  {
    fileName: "staples-inv-5111.pdf",
    gcsPath: "seed/staples-inv-5111.pdf",
    vendor: "Staples",
    invoiceNumber: "INV-5111",
    issueDate: "2026-06-20",
    dueDate: "2026-07-04",
    currency: "USD",
    subtotal: 86,
    tax: 8.6,
    total: 94.6,
    category: "office",
    confidence: 0.92,
    raw: { vendorName: "Staples", invoiceNumber: "INV-5111" },
    lineItems: [
      {
        description: "Printer paper, pens, and toner",
        quantity: 1,
        unitPrice: 86,
        amount: 86,
      },
    ],
  },
  {
    fileName: "iam-inv-6201.pdf",
    gcsPath: "seed/iam-inv-6201.pdf",
    vendor: "Maroc Telecom",
    invoiceNumber: "INV-6201",
    issueDate: "2026-08-03",
    dueDate: "2026-08-18",
    currency: "MAD",
    subtotal: 500,
    tax: 100,
    total: 600,
    category: "telecom",
    confidence: 0.97,
    raw: { vendorName: "Maroc Telecom", invoiceNumber: "INV-6201" },
    lineItems: [
      {
        description: "Monthly fiber internet — August",
        quantity: 1,
        unitPrice: 500,
        amount: 500,
      },
    ],
  },
  {
    fileName: "orange-inv-6202.pdf",
    gcsPath: "seed/orange-inv-6202.pdf",
    vendor: "Orange",
    invoiceNumber: "INV-6202",
    issueDate: "2026-07-03",
    dueDate: "2026-07-18",
    currency: "MAD",
    subtotal: 249,
    tax: 49.8,
    total: 298.8,
    category: "telecom",
    confidence: 0.96,
    raw: { vendorName: "Orange", invoiceNumber: "INV-6202" },
    lineItems: [
      {
        description: "Mobile plan for the team — July",
        quantity: 1,
        unitPrice: 249,
        amount: 249,
      },
    ],
  },
  {
    fileName: "google-ads-inv-7304.pdf",
    gcsPath: "seed/google-ads-inv-7304.pdf",
    vendor: "Google",
    invoiceNumber: "INV-7304",
    issueDate: "2026-08-14",
    dueDate: "2026-09-13",
    currency: "USD",
    subtotal: 450,
    tax: 0,
    total: 450,
    category: "marketing",
    confidence: 0.95,
    raw: { vendorName: "Google", invoiceNumber: "INV-7304" },
    lineItems: [
      {
        description: "Google Ads campaign — August",
        quantity: 1,
        unitPrice: 450,
        amount: 450,
      },
    ],
  },
  {
    fileName: "linkedin-inv-7305.pdf",
    gcsPath: "seed/linkedin-inv-7305.pdf",
    vendor: "LinkedIn",
    invoiceNumber: "INV-7305",
    issueDate: "2026-05-12",
    dueDate: "2026-06-11",
    currency: "USD",
    subtotal: 280,
    tax: 0,
    total: 280,
    category: "marketing",
    confidence: 0.94,
    raw: { vendorName: "LinkedIn", invoiceNumber: "INV-7305" },
    lineItems: [
      {
        description: "Sponsored job posts — May",
        quantity: 1,
        unitPrice: 280,
        amount: 280,
      },
    ],
  },
  {
    fileName: "benani-inv-8401.pdf",
    gcsPath: "seed/benani-inv-8401.pdf",
    vendor: "Benani & Associates",
    invoiceNumber: "INV-8401",
    issueDate: "2026-08-18",
    dueDate: "2026-09-17",
    currency: "MAD",
    subtotal: 3000,
    tax: 600,
    total: 3600,
    category: "other",
    confidence: 0.92,
    raw: { vendorName: "Benani & Associates", invoiceNumber: "INV-8401" },
    lineItems: [
      {
        description: "Legal retainer for contract review",
        quantity: 1,
        unitPrice: 3000,
        amount: 3000,
      },
    ],
  },
];

async function insertInvoice(
  userId: string,
  seed: Invoice & { fileName: string; gcsPath: string },
) {
  const { fileName, gcsPath, ...invoiceFields } = seed;
  const parsed = InvoiceSchema.parse(invoiceFields);

  const [document] = await db
    .insert(documents)
    .values({
      userId,
      fileName,
      mime: "application/pdf",
      sizeBytes: 24_576,
      gcsPath,
      status: "uploaded",
      pages: 1,
    })
    .returning();

  const [invoice] = await db
    .insert(invoices)
    .values(
      invoiceInsertValues(parsed, {
        userId,
        documentId: document.id,
      }),
    )
    .returning();

  await db.insert(lineItems).values(lineItemInsertValues(parsed, invoice.id));

  return { document, invoice };
}

async function seed() {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, SEED_EMAIL))
    .limit(1);

  if (!user) {
    throw new Error(
      `No user found for ${SEED_EMAIL}. Sign in once, then re-run the seed.`,
    );
  }

  await db.delete(documents).where(
    and(
      eq(documents.userId, user.id),
      inArray(
        documents.gcsPath,
        SEEDED_INVOICES.map((invoice) => invoice.gcsPath),
      ),
    ),
  );

  const seeded = [];

  for (const invoiceSeed of SEEDED_INVOICES) {
    seeded.push(await insertInvoice(user.id, invoiceSeed));
  }

  console.log("Seeded demo invoices:");
  console.log(`  user:          ${user.email}`);
  for (const row of seeded) {
    console.log(
      `  invoice:       ${row.invoice.invoiceNumber} ${row.invoice.vendor} ${row.invoice.total} ${row.invoice.currency} (${row.invoice.issueDate})`,
    );
  }
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
