import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { InvoiceSchema } from "@/lib/schemas";
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

  const [document] = await db
    .insert(documents)
    .values({
      userId: user.id,
      fileName: "acme-inv-1042.pdf",
      mime: "application/pdf",
      sizeBytes: 24_576,
      gcsPath: "seed/acme-inv-1042.pdf",
      status: "uploaded",
      pages: 1,
    })
    .returning();

  const parsed = InvoiceSchema.parse({
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
    raw: {
      vendorName: "Acme Corp",
      invoiceNumber: "INV-1042",
    },
    lineItems: [
      {
        description: "API usage — August",
        quantity: 1,
        unitPrice: 1200,
        amount: 1200,
      },
    ],
  });

  const [invoice] = await db
    .insert(invoices)
    .values(
      invoiceInsertValues(parsed, {
        userId: user.id,
        documentId: document.id,
      }),
    )
    .returning();

  await db
    .insert(lineItems)
    .values(lineItemInsertValues(parsed, invoice.id));

  const [conversation] = await db
    .insert(conversations)
    .values({
      userId: user.id,
      title: "Acme invoice tax",
    })
    .returning();

  await db.insert(conversationInvoices).values({
    conversationId: conversation.id,
    invoiceId: invoice.id,
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
  console.log(`  document:      ${document.fileName} (${document.gcsPath})`);
  console.log(`  invoice:       ${invoice.invoiceNumber} (${invoice.vendor})`);
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
