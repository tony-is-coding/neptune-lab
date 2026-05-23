CREATE TABLE "human_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid,
	"request_id" text,
	"review_type" text DEFAULT 'run_result' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"assigned_to" uuid,
	"requested_by" uuid,
	"decided_by" uuid,
	"decision" text,
	"decision_reason" text,
	"decision_summary" jsonb DEFAULT '{}'::jsonb,
	"metadata_summary" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"decided_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "human_reviews_tenant_created_idx" ON "human_reviews" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "human_reviews_tenant_status_idx" ON "human_reviews" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "human_reviews_run_idx" ON "human_reviews" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "human_reviews_subject_idx" ON "human_reviews" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "human_reviews_assignee_idx" ON "human_reviews" USING btree ("assigned_to");