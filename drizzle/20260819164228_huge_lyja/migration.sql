CREATE TABLE "line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12,4) NOT NULL,
	"unit_price" numeric(12,2) NOT NULL,
	"amount" numeric(12,2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" RENAME COLUMN "mime_type" TO "mime";--> statement-breakpoint
ALTER TABLE "documents" RENAME COLUMN "storage_key" TO "gcs_path";--> statement-breakpoint
ALTER TABLE "invoices" RENAME COLUMN "vendor_name" TO "vendor";--> statement-breakpoint
ALTER TABLE "invoices" RENAME COLUMN "invoice_date" TO "issue_date";--> statement-breakpoint
ALTER INDEX "documents_storage_key_idx" RENAME TO "documents_gcs_path_idx";--> statement-breakpoint
ALTER INDEX "invoices_vendor_name_idx" RENAME TO "invoices_vendor_idx";--> statement-breakpoint
DROP INDEX "invoices_status_idx";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "pages" integer;--> statement-breakpoint
DELETE FROM "conversation_invoices";--> statement-breakpoint
DELETE FROM "invoices";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "confidence" numeric(4,3) NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "raw" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "file_name";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "mime_type";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "storage_key";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "extracted_data";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "error_message";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "vendor" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "invoice_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "issue_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "currency" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "subtotal" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tax" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "total" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "invoices_user_id_idx" ON "invoices" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_document_id_idx" ON "invoices" ("document_id");--> statement-breakpoint
CREATE INDEX "invoices_invoice_number_idx" ON "invoices" ("invoice_number");--> statement-breakpoint
CREATE INDEX "line_items_invoice_id_idx" ON "line_items" ("invoice_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_document_id_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
DROP TYPE "invoice_status";