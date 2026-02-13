import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getRedirectUri } from '@/lib/google-oauth';
import { db, schema } from '@/lib/db';
import { randomUUID } from 'crypto';

/**
 * Get the canonical base URL for redirects
 */
function getBaseUrl(): string {
  // In production, always use the canonical domain
  if (process.env.NODE_ENV === 'production') {
    return 'https://agenticportal.agenticledger.ai';
  }
  return 'http://localhost:3000';
}

/**
 * GET /api/auth/google/callback
 * 
 * Handles OAuth callback from Google.
 * Creates the data source with the obtained tokens.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateString = searchParams.get('state');
    const error = searchParams.get('error');
    const baseUrl = getBaseUrl();
    
    // Handle OAuth errors
    if (error) {
      console.error('[google/callback] OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/datasources?error=${encodeURIComponent(error)}`, baseUrl)
      );
    }
    
    if (!code || !stateString) {
      return NextResponse.redirect(
        new URL('/datasources?error=missing_code', baseUrl)
      );
    }
    
    // Decode state
    let state: { id: string; name: string; spreadsheetId: string; timestamp: number };
    try {
      state = JSON.parse(Buffer.from(stateString, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/datasources?error=invalid_state', baseUrl)
      );
    }
    
    // Check state timestamp (expire after 10 minutes)
    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(
        new URL('/datasources?error=expired', baseUrl)
      );
    }
    
    // Exchange code for tokens
    const redirectUri = getRedirectUri(request);
    const tokens = await exchangeCodeForTokens({ code, redirectUri });
    
    // TODO: Get org and user from session
    const orgId = request.headers.get('x-org-id') || 'default-org';
    const userId = request.headers.get('x-user-id') || 'default-user';
    
    // If no spreadsheet ID provided, redirect to a page where user can enter it
    if (!state.spreadsheetId) {
      // Store tokens temporarily and redirect to complete setup
      const url = new URL('/datasources', baseUrl);
      url.searchParams.set('complete', 'google_sheets');
      url.searchParams.set('name', state.name);
      url.searchParams.set('accessToken', tokens.accessToken);
      url.searchParams.set('refreshToken', tokens.refreshToken);
      return NextResponse.redirect(url);
    }
    
    // Create data source with tokens
    const id = randomUUID();
    const now = new Date();
    
    await db.insert(schema.dataSources).values({
      id,
      organizationId: orgId,
      name: state.name,
      type: 'google_sheets',
      config: {
        spreadsheetId: state.spreadsheetId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    
    return NextResponse.redirect(
      new URL(`/datasources?success=connected&id=${id}`, baseUrl)
    );
  } catch (error) {
    console.error('[google/callback] Error:', error);
    const baseUrl = getBaseUrl();
    return NextResponse.redirect(
      new URL(`/datasources?error=${encodeURIComponent(error instanceof Error ? error.message : 'callback_failed')}`, baseUrl)
    );
  }
}
