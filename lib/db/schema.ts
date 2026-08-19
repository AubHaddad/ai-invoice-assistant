import type { AdapterAccountType } from "next-auth/adapters";
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  primaryKey,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Invoice, LineItem } from "@/lib/schemas";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

const money = () => numeric({ precision: 12, scale: 2, mode: "number" });

export const documentStatusEnum = pgEnum("document_status", [
  "uploading",
  "uploaded",
  "failed",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

export type MessagePart = {
  type: string;
  [key: string]: unknown;
};

export type MessageContent = MessagePart[];

export const users = snakeCase.table("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  emailVerified: timestamp({ withTimezone: true, mode: "date" }),
  name: text(),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const accounts = snakeCase.table(
  "accounts",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().$type<AdapterAccountType>().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const conversations = snakeCase.table(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text(),
    ...timestamps,
  },
  (table) => [index("conversations_user_id_idx").on(table.userId)],
);

export const documents = snakeCase.table(
  "documents",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid().references(() => conversations.id, {
      onDelete: "set null",
    }),
    fileName: text().notNull(),
    mime: text().notNull(),
    sizeBytes: integer().notNull(),
    gcsPath: text().notNull(),
    status: documentStatusEnum().notNull().default("uploading"),
    pages: integer(),
    ...timestamps,
  },
  (table) => [
    index("documents_user_id_idx").on(table.userId),
    index("documents_conversation_id_idx").on(table.conversationId),
    index("documents_status_idx").on(table.status),
    index("documents_gcs_path_idx").on(table.gcsPath),
  ],
);

export const invoices = snakeCase.table(
  "invoices",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    vendor: text().notNull(),
    invoiceNumber: text().notNull(),
    issueDate: date({ mode: "string" }).notNull(),
    dueDate: date({ mode: "string" }),
    currency: text().notNull(),
    subtotal: money().notNull(),
    tax: money().notNull(),
    total: money().notNull(),
    category: text(),
    confidence: numeric({ precision: 4, scale: 3, mode: "number" }).notNull(),
    raw: jsonb().$type<Invoice["raw"]>().notNull(),
    ...timestamps,
  },
  (table) => [
    index("invoices_user_id_idx").on(table.userId),
    uniqueIndex("invoices_document_id_idx").on(table.documentId),
    index("invoices_vendor_idx").on(table.vendor),
    index("invoices_invoice_number_idx").on(table.invoiceNumber),
  ],
);

export const lineItems = snakeCase.table(
  "line_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text().notNull(),
    quantity: numeric({ precision: 12, scale: 4, mode: "number" }).notNull(),
    unitPrice: money().notNull(),
    amount: money().notNull(),
  },
  (table) => [index("line_items_invoice_id_idx").on(table.invoiceId)],
);

export const conversationInvoices = snakeCase.table(
  "conversation_invoices",
  {
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    attachedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.invoiceId] }),
  ],
);

const fxRate = () => numeric({ precision: 18, scale: 8, mode: "string" });

export const exchangeRates = snakeCase.table(
  "exchange_rates",
  {
    id: uuid().primaryKey().defaultRandom(),
    fromCurrency: text().notNull(),
    toCurrency: text().notNull(),
    rate: fxRate().notNull(),
    effectiveDate: date({ mode: "string" }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("exchange_rates_pair_date_idx").on(
      table.fromCurrency,
      table.toCurrency,
      table.effectiveDate,
    ),
  ],
);

export const messages = snakeCase.table(
  "messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum().notNull(),
    content: jsonb().$type<MessageContent>().notNull(),
    tokensIn: integer(),
    tokensOut: integer(),
    tokensCached: integer(),
    tokensCacheWrite: integer(),
    costUsd: numeric({ precision: 12, scale: 6, mode: "number" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("messages_conversation_id_idx").on(table.conversationId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type InvoiceRow = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type LineItemRow = typeof lineItems.$inferSelect;
export type NewLineItem = typeof lineItems.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ExchangeRateRow = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;

type InvoiceInsertFields = Pick<
  NewInvoice,
  | "vendor"
  | "invoiceNumber"
  | "issueDate"
  | "dueDate"
  | "currency"
  | "subtotal"
  | "tax"
  | "total"
  | "category"
  | "confidence"
  | "raw"
>;

type LineItemInsertFields = Pick<
  NewLineItem,
  "description" | "quantity" | "unitPrice" | "amount"
>;

type AssertAssignable<T extends U, U> = T;

type _InvoiceSchemaMatchesInsert = AssertAssignable<
  Omit<Invoice, "lineItems">,
  InvoiceInsertFields
>;
type _LineItemSchemaMatchesInsert = AssertAssignable<
  LineItem,
  LineItemInsertFields
>;
