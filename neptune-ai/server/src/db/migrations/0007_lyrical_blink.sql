CREATE TABLE "policy_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid,
	"request_id" text,
	"policy_type" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"details_summary" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "policy_decisions_tenant_created_idx" ON "policy_decisions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "policy_decisions_run_idx" ON "policy_decisions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "policy_decisions_request_idx" ON "policy_decisions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "policy_decisions_decision_idx" ON "policy_decisions" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "policy_decisions_type_idx" ON "policy_decisions" USING btree ("policy_type");