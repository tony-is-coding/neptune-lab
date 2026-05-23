CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"locked_by" uuid,
	"locked_at" timestamp,
	"metadata_summary" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text DEFAULT 'warning' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"run_id" uuid,
	"owner_user_id" uuid,
	"reviewer_user_id" uuid,
	"metadata_summary" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "close_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"title" text NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb,
	"snapshot" jsonb NOT NULL,
	"snapshot_hash" text NOT NULL,
	"run_ids" jsonb DEFAULT '[]'::jsonb,
	"evidence_artifact_ids" jsonb DEFAULT '[]'::jsonb,
	"finding_ids" jsonb DEFAULT '[]'::jsonb,
	"human_review_ids" jsonb DEFAULT '[]'::jsonb,
	"audit_event_ids" jsonb DEFAULT '[]'::jsonb,
	"artifact_id" uuid,
	"generated_by" uuid,
	"generated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "close_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"checklist_item_id" uuid NOT NULL,
	"run_id" uuid,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assignee_id" uuid,
	"evidence_artifact_ids" jsonb DEFAULT '[]'::jsonb,
	"human_review_id" uuid,
	"decision_reason" text,
	"metadata_summary" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_workspace_id_close_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."close_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_workspace_id_close_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."close_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_period_id_accounting_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_reports" ADD CONSTRAINT "close_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_reports" ADD CONSTRAINT "close_reports_workspace_id_close_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."close_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_reports" ADD CONSTRAINT "close_reports_period_id_accounting_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_reports" ADD CONSTRAINT "close_reports_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_reports" ADD CONSTRAINT "close_reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_workspaces" ADD CONSTRAINT "close_workspaces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_workspaces" ADD CONSTRAINT "close_workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_workspace_id_close_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."close_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_period_id_accounting_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_human_review_id_human_reviews_id_fk" FOREIGN KEY ("human_review_id") REFERENCES "public"."human_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounting_periods_workspace_idx" ON "accounting_periods" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "accounting_periods_tenant_period_idx" ON "accounting_periods" USING btree ("tenant_id","period_key");--> statement-breakpoint
CREATE INDEX "accounting_periods_tenant_status_idx" ON "accounting_periods" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "checklist_items_period_idx" ON "checklist_items" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "checklist_items_workspace_idx" ON "checklist_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "checklist_items_tenant_status_idx" ON "checklist_items" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "checklist_items_code_idx" ON "checklist_items" USING btree ("code");--> statement-breakpoint
CREATE INDEX "close_reports_period_idx" ON "close_reports" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "close_reports_workspace_idx" ON "close_reports" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "close_reports_tenant_created_idx" ON "close_reports" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "close_reports_hash_idx" ON "close_reports" USING btree ("snapshot_hash");--> statement-breakpoint
CREATE INDEX "close_workspaces_tenant_created_idx" ON "close_workspaces" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "close_workspaces_tenant_status_idx" ON "close_workspaces" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "findings_period_idx" ON "findings" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "findings_workspace_idx" ON "findings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "findings_tenant_status_idx" ON "findings" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "findings_human_review_idx" ON "findings" USING btree ("human_review_id");