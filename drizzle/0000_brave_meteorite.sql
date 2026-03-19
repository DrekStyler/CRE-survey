CREATE TYPE "public"."enrichment_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."research_category" AS ENUM('hiring_trends', 'industry_benchmarks', 'workforce_growth', 'office_density', 'talent_geography', 'financial', 'general');--> statement-breakpoint
CREATE TYPE "public"."hypothesis_status" AS ENUM('proposed', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."hypothesis_type" AS ENUM('revenue', 'cost', 'operational', 'space', 'growth', 'risk');--> statement-breakpoint
CREATE TYPE "public"."driver_type" AS ENUM('revenue', 'cost', 'operational', 'space');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"common_name" varchar(255),
	"website" varchar(500),
	"email_domain" varchar(255),
	"canonical_domain" varchar(255),
	"industry" varchar(255),
	"hq_location" varchar(500),
	"employee_estimate" integer,
	"enrichment_status" "enrichment_status" DEFAULT 'pending',
	"enrichment_data" text,
	"entity_match_confidence" integer,
	"confirmed_by_broker" boolean DEFAULT false,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"broker_hypothesis" text,
	"known_client_issues" text,
	"market_constraints" text,
	"current_footprint" jsonb,
	"budget_signals" text,
	"timing" text,
	"pain_points" text,
	"growth_expectations" text,
	"additional_notes" text,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_interview_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"insight" text NOT NULL,
	"derived_from" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"category" "research_category" NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text NOT NULL,
	"source_url" varchar(1000),
	"source_name" varchar(255),
	"retrieval_date" timestamp NOT NULL,
	"confidence" integer NOT NULL,
	"raw_content" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hypotheses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "hypothesis_type" NOT NULL,
	"statement" text NOT NULL,
	"confidence_score" integer,
	"supporting_findings" text,
	"status" "hypothesis_status" DEFAULT 'proposed' NOT NULL,
	"dimension_score_npv" integer,
	"dimension_score_cost" integer,
	"dimension_score_ebitda" integer,
	"scoring_reasoning" text,
	"source" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"version" integer DEFAULT 1,
	"status" varchar(50) DEFAULT 'draft',
	"sections" jsonb NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'in_progress',
	"responses" jsonb DEFAULT '[]' NOT NULL,
	"unresolved_questions" jsonb DEFAULT '[]',
	"conducted_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "driver_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"impact" varchar(50),
	"supporting_evidence" jsonb,
	"linked_hypothesis_ids" jsonb DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255),
	"address" varchar(500),
	"city" varchar(255),
	"state" varchar(100),
	"country" varchar(100),
	"postal_code" varchar(20),
	"square_feet" integer,
	"headcount" integer,
	"lease_expiration" timestamp,
	"monthly_rent" numeric(12, 2),
	"location_type" varchar(100),
	"source" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broker_interviews" ADD CONSTRAINT "broker_interviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_insights" ADD CONSTRAINT "broker_insights_broker_interview_id_broker_interviews_id_fk" FOREIGN KEY ("broker_interview_id") REFERENCES "public"."broker_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_findings" ADD CONSTRAINT "research_findings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hypotheses" ADD CONSTRAINT "hypotheses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_templates" ADD CONSTRAINT "interview_templates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interviews" ADD CONSTRAINT "client_interviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interviews" ADD CONSTRAINT "client_interviews_template_id_interview_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."interview_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_locations" ADD CONSTRAINT "office_locations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;