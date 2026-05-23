CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid,
	"request_id" text,
	"artifact_type" text DEFAULT 'file' NOT NULL,
	"title" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"sha256" text NOT NULL,
	"storage_uri" text NOT NULL,
	"source_type" text DEFAULT 'runtime_tool' NOT NULL,
	"source_ref" text,
	"created_by" uuid,
	"metadata_summary" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evidence_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"run_id" uuid,
	"request_id" text,
	"evidence_type" text DEFAULT 'generated_extract' NOT NULL,
	"source_system" text,
	"source_uri" text,
	"source_hash" text NOT NULL,
	"imported_by" uuid,
	"captured_at" timestamp,
	"metadata_summary" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_tenant_created_idx" ON "artifacts" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "artifacts_run_created_idx" ON "artifacts" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "artifacts_tenant_type_idx" ON "artifacts" USING btree ("tenant_id","artifact_type");--> statement-breakpoint
CREATE INDEX "artifacts_sha_idx" ON "artifacts" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "evidence_artifacts_tenant_created_idx" ON "evidence_artifacts" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "evidence_artifacts_run_created_idx" ON "evidence_artifacts" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "evidence_artifacts_artifact_idx" ON "evidence_artifacts" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX "evidence_artifacts_tenant_type_idx" ON "evidence_artifacts" USING btree ("tenant_id","evidence_type");