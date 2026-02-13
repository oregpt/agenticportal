CREATE TABLE "ai_agent_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"key" varchar(64) NOT NULL,
	"encrypted_value" text NOT NULL,
	"iv" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agent_capabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"capability_id" varchar(64) NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agent_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"doc_type" varchar(50) NOT NULL,
	"doc_key" varchar(255) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agent_memory_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"doc_id" integer NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(1536),
	"line_start" integer,
	"line_end" integer,
	"content_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"instructions" text,
	"default_model" varchar(128) NOT NULL,
	"admin_key" varchar(128),
	"branding" jsonb,
	"features" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_capabilities" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(32) NOT NULL,
	"category" varchar(64),
	"config" jsonb,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_capability_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"capability_id" varchar(64) NOT NULL,
	"token1" text,
	"token2" text,
	"token3" text,
	"token4" text,
	"token5" text,
	"iv" varchar(32),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"sql" text,
	"view_id" varchar(64),
	"data" jsonb,
	"suggested_chart_type" varchar(32),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"data_source_id" varchar(64),
	"title" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" varchar(64) NOT NULL,
	"session_token" varchar(128) NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"external_user_id" varchar(255),
	"title" varchar(255),
	"session_summary" text,
	"message_count" integer DEFAULT 0,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_conversations_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_public" integer DEFAULT 0 NOT NULL,
	"public_slug" varchar(64),
	"layout" varchar(32) DEFAULT 'grid',
	"created_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dashboards_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"config" jsonb NOT NULL,
	"schema_cache" jsonb,
	"last_synced_at" timestamp,
	"created_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_document_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"token_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"mime_type" varchar(128),
	"size" integer,
	"storage_path" varchar(512),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"view_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"parameters" jsonb,
	"created_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"avatar_url" varchar(512),
	"organization_id" varchar(64),
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"is_platform_admin" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "views" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"organization_id" varchar(64) NOT NULL,
	"data_source_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sql" text NOT NULL,
	"natural_language_query" text,
	"columns" jsonb NOT NULL,
	"created_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "widgets" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"dashboard_id" varchar(64) NOT NULL,
	"view_id" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(255),
	"position" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
