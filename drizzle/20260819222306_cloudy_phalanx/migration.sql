ALTER TABLE "messages" ADD COLUMN "tokens_cached" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "tokens_cache_write" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "cost_usd" numeric(12,6);