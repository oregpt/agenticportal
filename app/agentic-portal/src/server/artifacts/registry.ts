export type DeterministicArtifactType = 'table' | 'chart' | 'kpi';

type ColumnKind = 'number' | 'string' | 'boolean' | 'date' | 'object' | 'unknown';

type InferredColumn = {
  name: string;
  kind: ColumnKind;
};

function isLikelyDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|T\d{2}:\d{2}/.test(value);
}

function inferValueKind(value: unknown): ColumnKind {
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (isLikelyDate(value)) return 'date';
  if (typeof value === 'string') return 'string';
  if (value && typeof value === 'object') return 'object';
  return 'unknown';
}

export function getSampleRows(metadataJson?: Record<string, unknown> | null): Record<string, unknown>[] {
  const rows = metadataJson?.sampleRows;
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
}

export function inferColumnsFromSampleRows(
  metadataJson?: Record<string, unknown> | null
): InferredColumn[] {
  const rows = getSampleRows(metadataJson);
  if (!rows.length) return [];
  const names = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return names.map((name) => {
    let kind: ColumnKind = 'unknown';
    for (const row of rows) {
      const value = row[name];
      if (value === null || value === undefined || value === '') continue;
      kind = inferValueKind(value);
      break;
    }
    return { name, kind };
  });
}

function firstOfKind(columns: InferredColumn[], kind: ColumnKind): string | null {
  return columns.find((column) => column.kind === kind)?.name || null;
}

function mergeConfig(
  base: Record<string, unknown>,
  override?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!override) return base;
  return { ...base, ...override };
}

export const ARTIFACT_TYPE_REGISTRY = {
  table: {
    id: 'table',
    label: 'Table',
    description: 'Tabular dashboard block rendered from SQL results.',
  },
  chart: {
    id: 'chart',
    label: 'Chart',
    description: 'Deterministic chart block configured from SQL columns.',
  },
  kpi: {
    id: 'kpi',
    label: 'KPI Tile',
    description: 'Single metric tile derived from SQL results.',
  },
} as const;

export function buildDeterministicArtifactConfig(input: {
  artifactType: DeterministicArtifactType;
  metadataJson?: Record<string, unknown> | null;
  overrideConfig?: Record<string, unknown> | null;
}) {
  const columns = inferColumnsFromSampleRows(input.metadataJson);
  const firstNumeric = firstOfKind(columns, 'number');
  const firstDate = firstOfKind(columns, 'date');
  const firstString = firstOfKind(columns, 'string');
  const fallbackX = firstDate || firstString || columns[0]?.name || null;
  const fallbackY = firstNumeric || columns[1]?.name || columns[0]?.name || null;

  if (input.artifactType === 'table') {
    return mergeConfig(
      {
        renderer: 'table',
        columns: columns.map((column) => ({
          key: column.name,
          label: column.name,
          kind: column.kind,
        })),
        pagination: { pageSize: 50 },
        sort: null,
      },
      input.overrideConfig
    );
  }

  if (input.artifactType === 'chart') {
    const chartType = firstDate && fallbackY ? 'line' : 'bar';
    return mergeConfig(
      {
        renderer: 'chart',
        chartType,
        xField: fallbackX,
        yField: fallbackY,
        aggregation: firstNumeric ? 'sum' : 'count',
        seriesField: null,
      },
      input.overrideConfig
    );
  }

  return mergeConfig(
    {
      renderer: 'kpi',
      metricField: firstNumeric,
      aggregation: firstNumeric ? 'sum' : 'count',
      format: 'number',
      comparisonWindow: null,
    },
    input.overrideConfig
  );
}

export function defaultDashboardDisplay(input: { artifactType: DeterministicArtifactType; title: string }) {
  return {
    title: input.title,
    artifactType: input.artifactType,
  };
}

export function defaultDashboardPosition(input: {
  artifactType: DeterministicArtifactType;
  existingItemCount: number;
}) {
  const y = input.existingItemCount * 4;
  if (input.artifactType === 'kpi') {
    return { x: 0, y, w: 4, h: 2 };
  }
  if (input.artifactType === 'chart') {
    return { x: 0, y, w: 12, h: 6 };
  }
  return { x: 0, y, w: 12, h: 7 };
}
