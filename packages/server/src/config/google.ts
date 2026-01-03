import { google } from 'googleapis';
import { config } from './index.js';
import {
  GOOGLE_BASE_SCOPES,
  GOOGLE_OPTIONAL_SCOPES,
  type GoogleOptionalScope,
} from '@remoranotes/shared';

// Create OAuth2 client
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.callbackUrl
  );
}

// Generate auth URL with requested scopes
export function generateAuthUrl(
  optionalScopes: GoogleOptionalScope[] = [],
  state?: string
): string {
  const oauth2Client = createOAuth2Client();

  const scopes = [...GOOGLE_BASE_SCOPES, ...optionalScopes.map((s) => GOOGLE_OPTIONAL_SCOPES[s])];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Always show consent to get refresh token
    scope: scopes,
    state: state,
    include_granted_scopes: true, // Incremental auth
  });
}

// Exchange code for tokens
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

// Get user info from Google
export async function getGoogleUserInfo(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  return {
    googleId: data.id!,
    email: data.email!,
    name: data.name || data.email!,
    avatarUrl: data.picture,
  };
}

// Parse granted scopes from token response
export function parseGrantedScopes(scope: string | undefined): GoogleOptionalScope[] {
  if (!scope) return [];

  const grantedScopes: GoogleOptionalScope[] = [];

  if (scope.includes(GOOGLE_OPTIONAL_SCOPES.contacts)) {
    grantedScopes.push('contacts');
  }
  if (scope.includes(GOOGLE_OPTIONAL_SCOPES.calendar)) {
    grantedScopes.push('calendar');
  }

  return grantedScopes;
}

// Create authenticated People API client
export function createPeopleClient(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.people({ version: 'v1', auth: oauth2Client });
}

// Create authenticated Calendar API client
export function createCalendarClient(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}
