import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export interface AgentDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string;
  instructions?: string;
  defaultModel: string;
}

export interface FeatureFlags {
  soulMemory: boolean;
  deepTools: boolean;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  defaultAgent: AgentDefinition;
  features: FeatureFlags;
}

const defaultAgent: AgentDefinition = {
  id: 'default-agent',
  slug: 'default',
  name: 'AgentLite',
  description: 'AI assistant powered by AgentLite',
  instructions:
    'You are a helpful AI assistant. Use your available tools and capabilities when relevant to answer questions accurately.',
  defaultModel: process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514',
};

export function getFeatureFlags(): FeatureFlags {
  return {
    soulMemory: process.env.FEATURE_SOUL_MEMORY === 'true',
    deepTools: process.env.FEATURE_DEEP_TOOLS !== 'false', // default ON
  };
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT || 4000);
  const databaseUrl = process.env.DATABASE_URL || '';

  if (!databaseUrl) {
    console.warn('[agent-lite] DATABASE_URL is not set. Required for production.');
  }

  return {
    port,
    databaseUrl,
    defaultAgent,
    features: getFeatureFlags(),
  };
}
