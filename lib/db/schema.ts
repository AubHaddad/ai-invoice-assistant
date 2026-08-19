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
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "uploaded",
  "processing",
  "ready",
  "failed",
]);

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

export type InvoiceLineItem = {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
};

export type ExtractedInvoiceData = {
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  currency?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  lineItems?: InvoiceLineItem[];
};

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

export const invoices = snakeCase.table(
  "invoices",
  {
    id: uuid().primaryKey().defaultRandom(),
    fileName: text().notNull(),
    mimeType: text().notNull(),
    storageKey: text().notNull(),
    status: invoiceStatusEnum().notNull().default("uploaded"),
    vendorName: text(),
    invoiceNumber: text(),
    invoiceDate: date(),
    currency: text().notNull().default("USD"),
    subtotal: numeric({ precision: 12, scale: 2 }),
    tax: numeric({ precision: 12, scale: 2 }),
    total: numeric({ precision: 12, scale: 2 }),
    extractedData: jsonb().$type<ExtractedInvoiceData>(),
    errorMessage: text(),
    ...timestamps,
  },
  (table) => [
    index("invoices_status_idx").on(table.status),
    index("invoices_vendor_name_idx").on(table.vendorName),
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
    mimeType: text().notNull(),
    sizeBytes: integer().notNull(),
    storageKey: text().notNull(),
    status: documentStatusEnum().notNull().default("uploading"),
    ...timestamps,
  },
  (table) => [
    index("documents_user_id_idx").on(table.userId),
    index("documents_conversation_id_idx").on(table.conversationId),
    index("documents_status_idx").on(table.status),
    index("documents_storage_key_idx").on(table.storageKey),
  ],
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
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
