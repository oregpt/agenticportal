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

const envApiKey = process.env.GOOGLE_AI_API_KEY;

async function getApiKey(): Promise<string> {
  if (!envApiKey) {
    throw new Error('Google AI API key not configured. Set GOOGLE_AI_API_KEY env var.');
  }
  return envApiKey;
}

// Gemini uses the OpenAI-compatible API endpoint
// https://ai.google.dev/gemini-api/docs/openai

function toOpenAIMessages(messages: LLMMessage[]): any[] {
  const result: any[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      result.push({ role: 'system', content: m.content });
    } else if (m.role === 'user') {
      result.push({ role: 'user', content: m.content });
    } else if (m.role === 'tool') {
      result.push({ role: 'tool', tool_call_id: m.toolCallId || '', content: m.content });
    } else if (m.role === 'assistant') {
      if (m.toolCalls && m.toolCalls.length > 0) {
        result.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
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

function toOpenAITools(tools: Tool[]): any[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.inputSchema.properties,
        ...(tool.inputSchema.required?.length ? { required: tool.inputSchema.required } : {}),
      },
    },
  }));
}

async function geminiRequest(apiKey: string, model: string, body: any): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, ...body }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API Error ${response.status}: ${text}`);
  }
  return response.json();
}

export class GeminiProvider implements LLMProvider {
  id = 'gemini';

  async generate(messages: LLMMessage[], options: GenerateOptions): Promise<string> {
    const result = await this.generateWithTools(messages, options);
    return result.text || '';
  }

  async generateWithTools(messages: LLMMessage[], options: GenerateOptions): Promise<GenerateResult> {
    const model = options.model || 'gemini-2.5-flash';
    const apiKey = await getApiKey();

    const body: any = {
      max_tokens: options.maxTokens || 4096,
      messages: toOpenAIMessages(messages),
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = toOpenAITools(options.tools);
    }

    console.log(`[gemini] Calling ${model} with ${messages.length} messages, ${options.tools?.length || 0} tools`);
    const data = await geminiRequest(apiKey, model, body);
    const choice = data.choices?.[0];
    if (!choice) {
      console.warn('[gemini] Empty choices in response:', JSON.stringify(data).slice(0, 200));
      return { type: 'text', text: '', stopReason: 'end_turn' };
    }

    const msg = choice.message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const toolCalls: ToolCall[] = msg.tool_calls.map((tc: any) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.function.arguments || '{}');
        } catch (e) {
          console.warn('[gemini] Failed to parse tool arguments:', tc.function.arguments);
        }
        return { id: tc.id, name: tc.function.name, input };
      });
      return { type: 'tool_use', text: msg.content || '', toolCalls, stopReason: 'tool_use' };
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
    const model = options.model || 'gemini-2.5-flash';
    const apiKey = await getApiKey();

    const body: any = {
      max_tokens: options.maxTokens || 4096,
      messages: toOpenAIMessages(messages),
      stream: true,
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = toOpenAITools(options.tools);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, ...body }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API Error ${response.status}: ${text}`);
    }

    let full = '';
    const reader = response.body?.getReader();
    if (!reader) { onChunk({ type: 'final', content: '' }); return; }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onChunk({ type: 'delta', content: delta });
          }
        } catch {}
      }
    }

    onChunk({ type: 'final', content: full });
  }
}


