ALTER TABLE "sessions"
    ALTER COLUMN "status" SET DEFAULT 'created';--> statement-breakpoint
ALTER TABLE "documents"
    ADD COLUMN "category" text DEFAULT 'document' NOT NULL;