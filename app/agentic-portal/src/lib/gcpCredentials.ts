export interface PlatformGcpCredentials {
  client_email: string;
  project_id: string;
  private_key: string;
  [key: string]: unknown;
}

export interface PlatformGcpDiagnostics {
  envVarPresent: boolean;
  envVarB64Present: boolean;
  source: 'b64' | 'raw' | null;
  jsonParseOk: boolean;
  missingFields: string[];
}

export interface PlatformGcpLoadResult {
  credentials: PlatformGcpCredentials | null;
  diagnostics: PlatformGcpDiagnostics;
}

function parseJsonWithFallback(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      // Some platforms can strip quotes from JSON keys in env values.
      const fixed = raw.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

function decodeBase64Utf8(value: string): string | null {
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

export function loadPlatformGcpCredentials(): PlatformGcpLoadResult {
  const rawB64 = process.env.EDS_GCP_SERVICE_ACCOUNT_KEY_B64;
  const rawJson = process.env.EDS_GCP_SERVICE_ACCOUNT_KEY;

  const envVarB64Present = Boolean(rawB64 && rawB64.trim());
  const envVarPresent = Boolean(rawJson && rawJson.trim());

  const tryValues: Array<{ source: 'b64' | 'raw'; value: string }> = [];
  if (envVarB64Present) {
    const decoded = decodeBase64Utf8(rawB64!.trim());
    if (decoded) {
      tryValues.push({ source: 'b64', value: decoded });
    }
  }
  if (envVarPresent) {
    tryValues.push({ source: 'raw', value: rawJson!.trim() });
  }

  for (const candidate of tryValues) {
    const parsed = parseJsonWithFallback(candidate.value);
    if (!parsed) continue;

    const requiredFields = ['client_email', 'project_id', 'private_key'];
    const missingFields = requiredFields.filter((field) => {
      const value = parsed[field];
      return typeof value !== 'string' || !value.trim();
    });

    if (missingFields.length === 0) {
      return {
        credentials: parsed as PlatformGcpCredentials,
        diagnostics: {
          envVarPresent,
          envVarB64Present,
          source: candidate.source,
          jsonParseOk: true,
          missingFields: [],
        },
      };
    }

    return {
      credentials: null,
      diagnostics: {
        envVarPresent,
        envVarB64Present,
        source: candidate.source,
        jsonParseOk: true,
        missingFields,
      },
    };
  }

  return {
    credentials: null,
    diagnostics: {
      envVarPresent,
      envVarB64Present,
      source: null,
      jsonParseOk: false,
      missingFields: [],
    },
  };
}
