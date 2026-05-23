CREATE TABLE "run_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"sequence" integer NOT NULL,
	"request_id" text,
	"payload_summary" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tool_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"tool_use_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"request_id" text,
	"input_summary" jsonb DEFAULT '{}'::jsonb,
	"output_summary" jsonb,
	"error_summary" jsonb,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_events_run_sequence_idx" ON "run_events" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "run_events_tenant_occurred_idx" ON "run_events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "run_events_type_idx" ON "run_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "tool_invocations_run_idx" ON "tool_invocations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "tool_invocations_tenant_started_idx" ON "tool_invocations" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "tool_invocations_tool_use_idx" ON "tool_invocations" USING btree ("tool_use_id");