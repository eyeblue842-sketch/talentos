import { Router } from 'express';
import {
  changePasswordHandler,
  emailVerificationConfirm,
  emailVerificationRequest,
  login,
  logout,
  me,
  oauthExchange,
  oauthCallback,
  passwordResetConfirm,
  passwordResetRequest,
  passwordResetSession,
  saveRecruiterProfile,
  signup,
  startOAuth,
} from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateSchema } from '../middleware/schema.js';
import { isPersonalEmail } from '../utils/email.js';
import {
  changePasswordSchema,
  loginSchema,
  oauthCallbackSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  signupSchema,
  tokenConfirmationSchema,
} from '@careeriz/shared';

export const authRouter = Router();

authRouter.post(
  '/signup',
  createRateLimiter({ keyPrefix: 'auth:signup', limit: 5 }),
  validateSchema(
    signupSchema.superRefine((value, ctx) => {
      if (value.role === 'RECRUITER' && isPersonalEmail(value.email)) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Recruiters must use a company email address.' });
      }
    })
  ),
  signup
);

authRouter.post('/login', createRateLimiter({ keyPrefix: 'auth:login', limit: 10 }), validateSchema(loginSchema), login);
// /me and /logout must stay reachable even while a password change is
// required - /me is how the frontend discovers mustChangePassword in the
// first place (requireUser(), the change-password page, and the post-login
// redirect all depend on it), and logout must always be an escape hatch.
authRouter.get('/me', auth([], { allowPasswordChangeRequired: true }), me);
authRouter.post(
  '/password-reset/request',
  createRateLimiter({ keyPrefix: 'auth:password-reset-request', limit: 5 }),
  validateSchema(passwordResetRequestSchema),
  passwordResetRequest
);
authRouter.post(
  '/password-reset/session',
  createRateLimiter({ keyPrefix: 'auth:password-reset-session', limit: 5 }),
  validateSchema(tokenConfirmationSchema),
  passwordResetSession
);
authRouter.post(
  '/password-reset/confirm',
  createRateLimiter({ keyPrefix: 'auth:password-reset-confirm', limit: 5 }),
  validateSchema(passwordResetConfirmSchema),
  passwordResetConfirm
);
authRouter.post(
  '/email-verification/request',
  createRateLimiter({ keyPrefix: 'auth:email-verification-request', limit: 5 }),
  validateSchema(passwordResetRequestSchema),
  emailVerificationRequest
);
authRouter.post(
  '/email-verification/confirm',
  createRateLimiter({ keyPrefix: 'auth:email-verification-confirm', limit: 5 }),
  validateSchema(tokenConfirmationSchema),
  emailVerificationConfirm
);
authRouter.get('/oauth/:provider/start', startOAuth);
authRouter.get('/oauth/:provider/callback', oauthCallback);
authRouter.post(
  '/oauth/callback',
  createRateLimiter({ keyPrefix: 'auth:oauth-callback', limit: 10 }),
  validateSchema(oauthCallbackSchema),
  oauthCallback
);
authRouter.post('/oauth/exchange', createRateLimiter({ keyPrefix: 'auth:oauth-exchange', limit: 10 }), validateSchema(tokenConfirmationSchema), oauthExchange);
authRouter.post(
  '/change-password',
  auth([], { allowPasswordChangeRequired: true }),
  createRateLimiter({ keyPrefix: 'auth:change-password', limit: 10 }),
  validateSchema(changePasswordSchema),
  changePasswordHandler
);
authRouter.post('/logout', auth([], { allowPasswordChangeRequired: true }), logout);
authRouter.patch('/recruiter-profile', auth(['RECRUITER']), saveRecruiterProfile);
