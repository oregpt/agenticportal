/**
 * Google Sheets Live - Service Account Info
 * 
 * GET /api/google-sheets-live/service-account
 * Returns the platform service account email for users to share sheets with
 */

import { NextResponse } from 'next/server';

function getPlatformCredentials() {
  const keyJson = process.env.EDS_GCP_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    return null;
  }
  
  try {
    return JSON.parse(keyJson);
  } catch {
    // Railway sometimes strips quotes from JSON keys, try to fix it
    try {
      const fixed = keyJson.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      return JSON.parse(fixed);
    } catch {
      console.error('[sheets-live] Failed to parse GCP credentials');
      return null;
    }
  }
}

export async function GET() {
  const credentials = getPlatformCredentials();
  
  if (!credentials) {
    return NextResponse.json({
      configured: false,
      error: 'Platform GCP credentials not configured. Contact admin.',
    });
  }

  return NextResponse.json({
    configured: true,
    serviceAccountEmail: credentials.client_email,
    projectId: credentials.project_id,
    instructions: `Share your Google Sheet with "${credentials.client_email}" (Viewer access) to enable SQL queries.`,
  });
}
