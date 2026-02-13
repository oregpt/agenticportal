/**
 * CSV Export Tool — AgentLite
 *
 * Deep tool that converts structured data (JSON rows) into CSV format.
 * The LLM calls this after querying data to produce downloadable CSV output.
 *
 * Tools:
 *   data__export_csv(data, filename?, columns?) — convert JSON rows to CSV
 */

import { Tool } from '../llm/types';

// ============================================================================
// Tool Definition (LLM schema)
// ============================================================================

export const CSV_EXPORT_TOOL: Tool = {
  name: 'data__export_csv',
  description: '[data] Convert structured data (array of objects/rows) into CSV format. Use this when the user asks to export, download, or save query results as CSV. Pass the data rows from a previous query result.',
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        description: 'Array of objects (rows) to convert to CSV. Each object is one row with key-value pairs.',
      },
      filename: {
        type: 'string',
        description: 'Suggested filename for the CSV (default: export.csv)',
      },
      columns: {
        type: 'array',
        description: 'Optional ordered list of column names to include. If omitted, all columns from the first row are used.',
      },
    },
    required: ['data'],
  },
};

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Escape a CSV field value — handles commas, quotes, newlines
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  // If the field contains a comma, quote, or newline, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Execute CSV export — converts JSON rows to CSV string
 */
export async function executeCsvExport(
  input: Record<string, unknown>,
): Promise<{ success: boolean; output: string }> {
  const data = input.data as Array<Record<string, unknown>>;

  if (!data || !Array.isArray(data)) {
    return { success: false, output: 'Missing or invalid "data" parameter. Expected an array of objects.' };
  }

  if (data.length === 0) {
    return { success: true, output: 'No data rows to export.' };
  }

  const filename = (input.filename as string) || 'export.csv';
  const requestedColumns = input.columns as string[] | undefined;

  try {
    // Determine columns — use requested columns or extract from first row
    const columns = requestedColumns && requestedColumns.length > 0
      ? requestedColumns
      : Object.keys(data[0] || {});

    if (columns.length === 0) {
      return { success: false, output: 'Could not determine columns from data.' };
    }

    // Build CSV
    const headerRow = columns.map(escapeCSVField).join(',');
    const dataRows = data.map(row =>
      columns.map(col => escapeCSVField(row[col])).join(',')
    );

    const csv = [headerRow, ...dataRows].join('\n');
    const rowCount = data.length;
    const colCount = columns.length;

    console.log(`[data__export_csv] Generated CSV: ${rowCount} rows, ${colCount} columns, filename="${filename}"`);

    // Return CSV with metadata header so the LLM can present it properly
    return {
      success: true,
      output: `CSV Export: ${rowCount} rows, ${colCount} columns\nFilename: ${filename}\nColumns: ${columns.join(', ')}\n\n---CSV-START---\n${csv}\n---CSV-END---\n\nThe CSV data above contains ${rowCount} rows with columns: ${columns.join(', ')}. You can present this to the user as a downloadable CSV file.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[data__export_csv] Error:`, msg);
    return { success: false, output: `CSV export error: ${msg}` };
  }
}
