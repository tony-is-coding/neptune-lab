CREATE TABLE "customer_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"environment" text DEFAULT 'sandbox' NOT NULL,
	"solution_pack" text,
	"created_by" uuid,
	"archived_at" timestamp,
	"metadata_summary" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "customer_projects" ADD CONSTRAINT "customer_projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_projects" ADD CONSTRAINT "customer_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_projects_tenant_status_idx" ON "customer_projects" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "customer_projects_tenant_created_idx" ON "customer_projects" USING btree ("tenant_id","created_at");