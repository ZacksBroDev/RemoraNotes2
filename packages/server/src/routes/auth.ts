import { Router, type Request, type Response, type NextFunction } from 'express';
import type { ApiResponse } from '@remoranotes/shared';
import {
  exchangeCodeForTokens,
  generateAuthUrl,
  getGoogleUserInfo,
  parseGrantedScopes,
} from '../config/google.js';
import { User } from '../models/index.js';
import { generateToken, setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/index.js';
import {
  createUserDEK,
  encrypt,
  hashEmail,
  clearDEKCache,
  logger,
  errors,
} from '../utils/index.js';
import { logAudit } from '../services/index.js';
import { config } from '../config/index.js';
import type { GoogleOptionalScope } from '@remoranotes/shared';

const router = Router();

// Get auth status
router.get('/me', requireAuth, (req: Request, res: Response<ApiResponse>) => {
  res.json({
    success: true,
    data: { user: req.user!.toJSON() },
  });
});

// Initiate Google OAuth
router.get('/google', (req: Request, res: Response) => {
  const { scopes, returnTo } = req.query;

  // Parse requested optional scopes
  const optionalScopes: GoogleOptionalScope[] = [];
  if (typeof scopes === 'string') {
    const requestedScopes = scopes.split(',');
    if (requestedScopes.includes('contacts')) optionalScopes.push('contacts');
    if (requestedScopes.includes('calendar')) optionalScopes.push('calendar');
  }

  // Create state with returnTo URL
  const state = JSON.stringify({
    returnTo: typeof returnTo === 'string' ? returnTo : '/',
    requestedScopes: optionalScopes,
  });

  const authUrl = generateAuthUrl(optionalScopes, Buffer.from(state).toString('base64'));
  res.redirect(authUrl);
});

// Google OAuth callback
router.get(
  '/google/callback',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code, state: stateBase64 } = req.query;

      if (!code || typeof code !== 'string') {
        throw errors.validation('Authorization code required');
      }

      // Parse state
      let returnTo = '/';
      let requestedScopes: GoogleOptionalScope[] = [];
      if (stateBase64 && typeof stateBase64 === 'string') {
        try {
          const state = JSON.parse(Buffer.from(stateBase64, 'base64').toString());
          returnTo = state.returnTo || '/';
          requestedScopes = state.requestedScopes || [];
        } catch {
          // Ignore state parse errors
        }
      }

      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code);
      if (!tokens.access_token) {
        throw errors.googleApiError('Failed to get access token');
      }

      // Get user info
      const googleUser = await getGoogleUserInfo(tokens.access_token);

      // Parse granted scopes
      const grantedScopes = parseGrantedScopes(tokens.scope);

      // Find or create user
      let user = await User.findOne({ googleId: googleUser.googleId });
      const isNewUser = !user;

      if (user) {
        // Update existing user
        user.email = googleUser.email;
        user.name = googleUser.name;
        user.avatarUrl = googleUser.avatarUrl;
        user.lastLoginAt = new Date();

        // Merge granted scopes (don't remove existing)
        const existingScopes = new Set(user.grantedScopes);
        grantedScopes.forEach((s) => existingScopes.add(s));
        user.grantedScopes = Array.from(existingScopes) as GoogleOptionalScope[];

        // Update refresh token if provided
        if (tokens.refresh_token) {
          const dek = Buffer.from(
            await (
              await import('../config/aws.js')
            ).decryptDataKey(Buffer.from(user.encryptedDEK, 'base64'))
          );
          user.encryptedRefreshToken = encrypt(tokens.refresh_token, dek);
        }

        await user.save();
      } else {
        // Create new user
        const { plaintext: dek, encryptedDEK } = await createUserDEK();

        user = new User({
          googleId: googleUser.googleId,
          email: googleUser.email,
          emailHash: hashEmail(googleUser.email),
          name: googleUser.name,
          avatarUrl: googleUser.avatarUrl,
          encryptedDEK,
          encryptedRefreshToken: tokens.refresh_token
            ? encrypt(tokens.refresh_token, dek)
            : undefined,
          grantedScopes,
          mode: 'both',
          plan: 'free',
          onboardingCompleted: false,
          lastLoginAt: new Date(),
        });

        await user.save();
      }

      // Generate JWT
      const token = generateToken(user._id.toString());
      setAuthCookie(res, token);

      // Audit log
      logAudit({
        userId: user._id,
        action: 'AUTH_LOGIN',
        resourceType: 'user',
        resourceId: user._id,
        metadata: { isNewUser, grantedScopes },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Redirect
      const redirectUrl = new URL(returnTo, config.server.clientUrl);
      if (isNewUser) {
        redirectUrl.pathname = '/onboarding';
      }
      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error({ error }, 'OAuth callback error');
      next(error);
    }
  }
);

// Request additional scopes (incremental auth)
router.get('/google/scopes', requireAuth, (req: Request, res: Response) => {
  const { scopes } = req.query;

  if (!scopes || typeof scopes !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'scopes parameter required' },
    });
    return;
  }

  const optionalScopes: GoogleOptionalScope[] = [];
  const requestedScopes = scopes.split(',');
  if (requestedScopes.includes('contacts')) optionalScopes.push('contacts');
  if (requestedScopes.includes('calendar')) optionalScopes.push('calendar');

  const state = JSON.stringify({
    returnTo: '/settings',
    requestedScopes: optionalScopes,
  });

  const authUrl = generateAuthUrl(optionalScopes, Buffer.from(state).toString('base64'));
  res.json({ success: true, data: { authUrl } });
});

// Logout
router.post('/logout', requireAuth, async (req: Request, res: Response<ApiResponse>) => {
  // Clear DEK cache
  clearDEKCache(req.userId!);

  // Clear auth cookie
  clearAuthCookie(res);

  // Audit log
  logAudit({
    userId: req.user!._id,
    action: 'AUTH_LOGOUT',
    resourceType: 'user',
    resourceId: req.user!._id,
    ip: req.ip,
  });

  res.json({ success: true });
});

export default router;
