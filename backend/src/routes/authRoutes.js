import { Router } from 'express';
import {
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
authRouter.get('/me', auth(), me);
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
authRouter.post('/logout', auth(), logout);
authRouter.patch('/recruiter-profile', auth(['RECRUITER']), saveRecruiterProfile);
