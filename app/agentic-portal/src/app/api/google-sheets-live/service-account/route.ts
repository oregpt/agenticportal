/**
 * Google Sheets Live - Service Account Info
 * 
 * GET /api/google-sheets-live/service-account
 * Returns the platform service account email for users to share sheets with
 */

import { NextResponse } from 'next/server';
import { loadPlatformGcpCredentials } from '@/lib/gcpCredentials';

export async function GET() {
  const { credentials, diagnostics } = loadPlatformGcpCredentials();

  if (!credentials) {
    let error = 'Platform GCP credentials not configured. Contact admin.';
    if (!diagnostics.envVarPresent && !diagnostics.envVarB64Present) {
      error = 'Missing env var EDS_GCP_SERVICE_ACCOUNT_KEY or EDS_GCP_SERVICE_ACCOUNT_KEY_B64.';
    } else if (!diagnostics.jsonParseOk) {
      error = 'Configured GCP credential env var is not valid JSON.';
    } else if (diagnostics.missingFields.length > 0) {
      error = `GCP credential JSON is missing required fields: ${diagnostics.missingFields.join(', ')}.`;
    }

    return NextResponse.json({
      configured: false,
      error,
      diagnostics,
    });
  }

  const clientEmail = String(credentials.client_email || '');
  const projectId = String(credentials.project_id || '');

  return NextResponse.json({
    configured: true,
    serviceAccountEmail: clientEmail,
    projectId,
    instructions: `Share your Google Sheet with "${clientEmail}" (Viewer access) to enable SQL queries.`,
    diagnostics,
  });
}
