import { ClaudeProvider } from './claudeProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';
import { GrokProvider } from './grokProvider';
import { LLMProvider } from './types';

// Re-export types
export * from './types';

// Cached provider instances
const providers: Record<string, LLMProvider> = {};

function getOrCreateProvider(id: string): LLMProvider {
  if (!providers[id]) {
    switch (id) {
      case 'openai':
        providers[id] = new OpenAIProvider();
        break;
      case 'gemini':
        providers[id] = new GeminiProvider();
        break;
      case 'grok':
        providers[id] = new GrokProvider();
        break;
      default:
        providers[id] = new ClaudeProvider();
        break;
    }
  }
  return providers[id]!;
}

// Determine which provider to use based on model name prefix
export function getProviderForModel(model: string): LLMProvider {
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) {
    return getOrCreateProvider('openai');
  }
  if (model.startsWith('gemini-')) {
    return getOrCreateProvider('gemini');
  }
  if (model.startsWith('grok-')) {
    return getOrCreateProvider('grok');
  }
  // Default to Claude for claude-* and anything else
  return getOrCreateProvider('claude');
}

// For backward compatibility
export function getDefaultLLMProvider(): LLMProvider {
  return getOrCreateProvider('claude');
}

// Available models — all 4 providers
export const AVAILABLE_MODELS = [
  // Claude
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic' },
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai' },
  // Gemini
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'gemini' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'gemini' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', provider: 'gemini' },
  // Grok
  { id: 'grok-3', name: 'Grok 3', provider: 'grok' },
  { id: 'grok-3-fast', name: 'Grok 3 Fast', provider: 'grok' },
];

/**
 * Get all available models (static list).
 */
export async function getAvailableModels(): Promise<typeof AVAILABLE_MODELS> {
  return [...AVAILABLE_MODELS];
}
