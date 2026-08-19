import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { InvoiceSchema, type Invoice } from "@/lib/schemas";
import { invoiceInsertValues, lineItemInsertValues } from "./invoices";
import {
  conversationInvoices,
  conversations,
  documents,
  invoices,
  lineItems,
  messages,
  users,
} from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const db = drizzle(databaseUrl);

const DEMO_EMAIL = "ada@invoice-assistant.dev";

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
  await db.delete(users).where(eq(users.email, DEMO_EMAIL));

  const [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      name: "Ada Lovelace",
      image: "https://api.dicebear.com/9.x/initials/svg?seed=Ada%20Lovelace",
    })
    .returning();

  const seeded = [];

  for (const invoiceSeed of SEEDED_INVOICES) {
    seeded.push(await insertInvoice(user.id, invoiceSeed));
  }

  const acme = seeded.find(
    (row) => row.invoice.invoiceNumber === "INV-1042",
  );

  if (!acme) {
    throw new Error("Expected Acme invoice in seed data");
  }

  const [conversation] = await db
    .insert(conversations)
    .values({
      userId: user.id,
      title: "Acme invoice tax",
    })
    .returning();

  await db.insert(conversationInvoices).values({
    conversationId: conversation.id,
    invoiceId: acme.invoice.id,
  });

  await db.insert(messages).values([
    {
      conversationId: conversation.id,
      role: "user",
      content: [
        { type: "text", text: "What's the tax on the Acme invoice?" },
      ],
    },
    {
      conversationId: conversation.id,
      role: "assistant",
      content: [
        { type: "text", text: "I'll look that up from the extracted invoice." },
        {
          type: "tool-call",
          toolCallId: "call_tax_1",
          toolName: "get_invoice_totals",
          args: { invoiceNumber: "INV-1042" },
        },
      ],
      tokensIn: 48,
      tokensOut: 22,
    },
    {
      conversationId: conversation.id,
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call_tax_1",
          toolName: "get_invoice_totals",
          result: { tax: 120, total: 1320, currency: "USD" },
        },
      ],
    },
    {
      conversationId: conversation.id,
      role: "assistant",
      content: [
        {
          type: "text",
          text: "The Acme invoice (INV-1042) has $120.00 tax, for a total of $1,320.00.",
        },
      ],
      tokensIn: 96,
      tokensOut: 34,
    },
  ]);

  console.log("Seeded demo data:");
  console.log(`  user:          ${user.email}`);
  for (const row of seeded) {
    console.log(
      `  invoice:       ${row.invoice.invoiceNumber} ${row.invoice.vendor} ${row.invoice.total} ${row.invoice.currency} (${row.invoice.issueDate})`,
    );
  }
  console.log(`  conversation:  ${conversation.title}`);
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
