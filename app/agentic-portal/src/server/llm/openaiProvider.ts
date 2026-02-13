import OpenAI from 'openai';
import {
  LLMMessage,
  LLMProvider,
  GenerateOptions,
  StreamOptions,
  LLMStreamChunk,
  GenerateResult,
  Tool,
  ToolCall,
} from './types';

const envApiKey = process.env.OPENAI_API_KEY;

async function getApiKey(agentId?: string): Promise<string> {
  if (agentId) {
    try {
      const { getAgentApiKeyWithFallback } = await import('../capabilities/capabilityService');
      const agentKey = await getAgentApiKeyWithFallback(agentId, 'openai_api_key');
      if (agentKey) return agentKey;
    } catch {}
  }
  return envApiKey || 'missing-key';
}

function toOpenAIMessages(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      result.push({ role: 'system', content: m.content });
    } else if (m.role === 'user') {
      result.push({ role: 'user', content: m.content });
    } else if (m.role === 'tool') {
      result.push({
        role: 'tool',
        tool_call_id: m.toolCallId || '',
        content: m.content,
      });
    } else if (m.role === 'assistant') {
      if (m.toolCalls && m.toolCalls.length > 0) {
        result.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          })),
        });
      } else {
        result.push({ role: 'assistant', content: m.content });
      }
    }
  }
  return result;
}

function toOpenAITools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: tool.inputSchema.properties as Record<string, unknown>,
        ...(tool.inputSchema.required?.length ? { required: tool.inputSchema.required } : {}),
      },
    },
  }));
}

export class OpenAIProvider implements LLMProvider {
  id = 'openai';

  async generate(messages: LLMMessage[], options: GenerateOptions): Promise<string> {
    const result = await this.generateWithTools(messages, options);
    return result.text || '';
  }

  async generateWithTools(messages: LLMMessage[], options: GenerateOptions): Promise<GenerateResult> {
    const model = options.model || 'gpt-4o';
    const apiKey = await getApiKey(options.agentId);
    const client = new OpenAI({ apiKey });

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      max_tokens: options.maxTokens || 1024,
      messages: toOpenAIMessages(messages),
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = toOpenAITools(options.tools);
    }

    const response = await client.chat.completions.create(params);
    const choice = response.choices[0];
    if (!choice) return { type: 'text', text: '', stopReason: 'end_turn' };

    const msg = choice.message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const toolCalls: ToolCall[] = msg.tool_calls
        .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { type: 'function' } => tc.type === 'function')
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}'),
        }));
      return {
        type: 'tool_use',
        text: msg.content || '',
        toolCalls,
        stopReason: 'tool_use',
      };
    }

    return {
      type: 'text',
      text: msg.content || '',
      stopReason: choice.finish_reason === 'stop' ? 'end_turn' : 'max_tokens',
    };
  }

  async stream(
    messages: LLMMessage[],
    options: StreamOptions,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    const model = options.model || 'gpt-4o';
    const apiKey = await getApiKey(options.agentId);
    const client = new OpenAI({ apiKey });

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      max_tokens: options.maxTokens || 1024,
      messages: toOpenAIMessages(messages),
      stream: true,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = toOpenAITools(options.tools);
    }

    const stream = await client.chat.completions.create(params);
    let full = '';

    for await (const chunk of stream as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        full += delta.content;
        onChunk({ type: 'delta', content: delta.content });
      }
    }

    onChunk({ type: 'final', content: full });
  }
}
