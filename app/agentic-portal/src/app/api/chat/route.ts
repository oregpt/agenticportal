import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createDataSourceAdapter } from '@/lib/datasources';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

// Lazy init the client
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

// POST /api/chat - Send message and get AI response
export async function POST(request: NextRequest) {
  console.log('[chat] Starting request...');
  try {
    const body = await request.json();
    console.log('[chat] Body:', JSON.stringify(body));
    const { message, dataSourceId, sessionId } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // TODO: Get org from session
    const orgId = request.headers.get('x-org-id') || 'default-org';

    // Get data source and schema if provided
    let schemaContext = '';
    let dataSource: any = null;

    if (dataSourceId) {
      const [ds] = await db
        .select()
        .from(schema.dataSources)
        .where(eq(schema.dataSources.id, dataSourceId))
        .limit(1);

      if (ds) {
        dataSource = ds;

        // Build schema context for LLM
        if (ds.schemaCache) {
          const schemaCache = ds.schemaCache as any;
          if (schemaCache.tables) {
            schemaContext = `\n\nAvailable Tables:\n`;
            for (const table of schemaCache.tables) {
              schemaContext += `\n**${table.name}**\n`;
              schemaContext += `Columns:\n`;
              for (const col of table.columns || []) {
                schemaContext += `  - ${col.name} (${col.type})${col.description ? ': ' + col.description : ''}\n`;
              }
            }
          }
        }
      }
    }

    // Build system prompt
    const systemPrompt = `You are a data analyst assistant. Help users query and understand their data.

When the user asks a question about data:
1. Understand what they're asking for
2. Generate a valid SQL query to answer their question
3. Explain what the query does

Format your SQL queries in a code block with the language "sql".
${schemaContext}

If you generate a SQL query, always end your response with:
[GENERATED_SQL]
\`\`\`sql
YOUR SQL QUERY HERE
\`\`\`
[/GENERATED_SQL]

Be concise but helpful. If you need more information about the data structure, ask.`;

    // Call Claude
    console.log('[chat] Calling Claude API...');
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const assistantMessage = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    // Extract SQL if present
    let generatedSql: string | undefined;
    const sqlMatch = assistantMessage.match(/\[GENERATED_SQL\]\s*```sql\s*([\s\S]*?)\s*```\s*\[\/GENERATED_SQL\]/);
    if (sqlMatch) {
      generatedSql = sqlMatch[1].trim();
    }

    // Execute query if we have SQL and a data source
    let queryResults: any = null;
    if (generatedSql && dataSource) {
      try {
        const adapter = await createDataSourceAdapter({
          ...dataSource.config,
          id: dataSource.id,
          organizationId: dataSource.organizationId,
          name: dataSource.name,
          type: dataSource.type,
          createdAt: dataSource.createdAt,
          updatedAt: dataSource.updatedAt,
          createdBy: dataSource.createdBy,
        } as any);

        const result = await adapter.executeQuery(generatedSql);
        queryResults = {
          columns: result.columns,
          rows: result.rows.slice(0, 100), // Limit to 100 rows for response
          totalRows: result.rowCount,
          executionTimeMs: result.executionTimeMs,
        };

        await adapter.disconnect();
      } catch (err) {
        console.error('Query execution error:', err);
        queryResults = {
          error: err instanceof Error ? err.message : 'Query execution failed',
        };
      }
    }

    // Clean up the response (remove SQL markers)
    const cleanedMessage = assistantMessage
      .replace(/\[GENERATED_SQL\][\s\S]*?\[\/GENERATED_SQL\]/, '')
      .trim();

    return NextResponse.json({
      message: cleanedMessage,
      sql: generatedSql,
      data: queryResults,
      suggestedChart: queryResults && !queryResults.error ? suggestChartType(queryResults) : undefined,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

// Simple heuristic to suggest chart type
function suggestChartType(results: any): string | undefined {
  if (!results.columns || results.columns.length === 0) return undefined;

  const numericCols = results.columns.filter(
    (c: any) => c.type === 'number'
  ).length;
  const stringCols = results.columns.filter(
    (c: any) => c.type === 'string'
  ).length;
  const dateCols = results.columns.filter(
    (c: any) => c.type === 'date' || c.type === 'datetime'
  ).length;

  // Time series → line chart
  if (dateCols >= 1 && numericCols >= 1) {
    return 'line';
  }

  // Category + numbers → bar chart
  if (stringCols >= 1 && numericCols >= 1 && results.rows.length <= 20) {
    return 'bar';
  }

  // Few categories with one number → pie
  if (stringCols === 1 && numericCols === 1 && results.rows.length <= 10) {
    return 'pie';
  }

  // Default to table
  return 'table';
}
