CREATE TYPE "document_status" AS ENUM('uploading', 'uploaded', 'failed');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"status" "document_status" DEFAULT 'uploading'::"document_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" ("user_id");--> statement-breakpoint
CREATE INDEX "documents_conversation_id_idx" ON "documents" ("conversation_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" ("status");--> statement-breakpoint
CREATE INDEX "documents_storage_key_idx" ON "documents" ("storage_key");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL;