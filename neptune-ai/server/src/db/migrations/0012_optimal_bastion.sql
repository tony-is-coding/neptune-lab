ALTER TABLE "billing_records" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "cost_cents" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_records_run_id_idx" ON "billing_records" USING btree ("run_id");