import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  users: {
    conversations: r.many.conversations({
      from: r.users.id,
      to: r.conversations.userId,
    }),
    accounts: r.many.accounts({
      from: r.users.id,
      to: r.accounts.userId,
    }),
    documents: r.many.documents({
      from: r.users.id,
      to: r.documents.userId,
    }),
    invoices: r.many.invoices({
      from: r.users.id,
      to: r.invoices.userId,
    }),
  },
  accounts: {
    user: r.one.users({
      from: r.accounts.userId,
      to: r.users.id,
    }),
  },
  invoices: {
    user: r.one.users({
      from: r.invoices.userId,
      to: r.users.id,
    }),
    document: r.one.documents({
      from: r.invoices.documentId,
      to: r.documents.id,
    }),
    lineItems: r.many.lineItems({
      from: r.invoices.id,
      to: r.lineItems.invoiceId,
    }),
    conversationLinks: r.many.conversationInvoices({
      from: r.invoices.id,
      to: r.conversationInvoices.invoiceId,
    }),
    conversations: r.many.conversations({
      from: r.invoices.id.through(r.conversationInvoices.invoiceId),
      to: r.conversations.id.through(r.conversationInvoices.conversationId),
    }),
  },
  lineItems: {
    invoice: r.one.invoices({
      from: r.lineItems.invoiceId,
      to: r.invoices.id,
    }),
  },
  conversations: {
    user: r.one.users({
      from: r.conversations.userId,
      to: r.users.id,
    }),
    messages: r.many.messages({
      from: r.conversations.id,
      to: r.messages.conversationId,
    }),
    documents: r.many.documents({
      from: r.conversations.id,
      to: r.documents.conversationId,
    }),
    invoiceLinks: r.many.conversationInvoices({
      from: r.conversations.id,
      to: r.conversationInvoices.conversationId,
    }),
    invoices: r.many.invoices({
      from: r.conversations.id.through(r.conversationInvoices.conversationId),
      to: r.invoices.id.through(r.conversationInvoices.invoiceId),
    }),
  },
  documents: {
    user: r.one.users({
      from: r.documents.userId,
      to: r.users.id,
    }),
    conversation: r.one.conversations({
      from: r.documents.conversationId,
      to: r.conversations.id,
    }),
    invoices: r.many.invoices({
      from: r.documents.id,
      to: r.invoices.documentId,
    }),
  },
  conversationInvoices: {
    conversation: r.one.conversations({
      from: r.conversationInvoices.conversationId,
      to: r.conversations.id,
    }),
    invoice: r.one.invoices({
      from: r.conversationInvoices.invoiceId,
      to: r.invoices.id,
    }),
  },
  messages: {
    conversation: r.one.conversations({
      from: r.messages.conversationId,
      to: r.conversations.id,
    }),
  },
}));
