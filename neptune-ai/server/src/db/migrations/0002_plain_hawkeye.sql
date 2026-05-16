CREATE TABLE "agent_skills"
(
    "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id"    uuid                                       NOT NULL,
    "skill_id"    uuid                                       NOT NULL,
    "assigned_at" timestamp        DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skills"
(
    "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id"   uuid                                       NOT NULL,
    "name"        text                                       NOT NULL,
    "description" text,
    "content"     text,
    "status"      text             DEFAULT 'active'          NOT NULL,
    "created_at"  timestamp        DEFAULT now(),
    "updated_at"  timestamp        DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agent_skills"
    ADD CONSTRAINT "agent_skills_agent_id_agent_templates_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_templates" ("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills"
    ADD CONSTRAINT "agent_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills" ("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills"
    ADD CONSTRAINT "skills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants" ("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_skills_agent_id_idx" ON "agent_skills" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_skills_skill_id_idx" ON "agent_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "agent_skills_agent_skill_unique_idx" ON "agent_skills" USING btree ("agent_id","skill_id");--> statement-breakpoint
CREATE INDEX "skills_tenant_id_idx" ON "skills" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "skills_status_idx" ON "skills" USING btree ("status");