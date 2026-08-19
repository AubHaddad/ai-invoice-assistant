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
  },
  accounts: {
    user: r.one.users({
      from: r.accounts.userId,
      to: r.users.id,
    }),
  },
  invoices: {
    conversationLinks: r.many.conversationInvoices({
      from: r.invoices.id,
      to: r.conversationInvoices.invoiceId,
    }),
    conversations: r.many.conversations({
      from: r.invoices.id.through(r.conversationInvoices.invoiceId),
      to: r.conversations.id.through(r.conversationInvoices.conversationId),
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
