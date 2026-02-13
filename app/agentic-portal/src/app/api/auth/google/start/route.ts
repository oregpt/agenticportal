import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthUrl, getRedirectUri } from '@/lib/google-oauth';
import { randomUUID } from 'crypto';

/**
 * GET /api/auth/google/start
 * 
 * Initiates Google OAuth flow for connecting Google Sheets.
 * Query params:
 *   - name: Display name for the data source
 *   - spreadsheetId: (optional) Pre-fill spreadsheet ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name') || 'Google Sheets';
    const spreadsheetId = searchParams.get('spreadsheetId') || '';
    
    // Create state object to pass through OAuth flow
    const state = {
      id: randomUUID(),
      name,
      spreadsheetId,
      timestamp: Date.now(),
    };
    
    // Encode state as base64
    const stateString = Buffer.from(JSON.stringify(state)).toString('base64url');
    
    const redirectUri = getRedirectUri(request);
    const authUrl = buildGoogleAuthUrl({
      redirectUri,
      state: stateString,
    });
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[google/start] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start OAuth flow' },
      { status: 500 }
    );
  }
}
