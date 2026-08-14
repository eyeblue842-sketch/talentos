import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRouter } from './routes/authRoutes.js';
import { jobRouter } from './routes/jobRoutes.js';
import { resumeRouter } from './routes/resumeRoutes.js';
import { atsRouter } from './routes/atsRoutes.js';
import { resumeBuilderRouter } from './routes/resumeBuilderRoutes.js';
import { dashboardRouter } from './routes/dashboardRoutes.js';
import { organisationRouter } from './routes/organisationRoutes.js';
import { requisitionRouter } from './routes/requisitionRoutes.js';
import { interviewRouter } from './routes/interviewRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { offerRouter } from './routes/offerRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { publicRouter } from './routes/publicRoutes.js';
import { candidateRouter } from './routes/candidateRoutes.js';
import { applicationWorkflowRouter } from './routes/applicationWorkflowRoutes.js';
import { intelligenceRouter } from './routes/intelligenceRoutes.js';
import { meetingProviderRouter } from './routes/meetingProviderRoutes.js';
import { setupRouter } from './routes/setupRoutes.js';
import { resumeImportRouter } from './routes/resumeImportRoutes.js';
import { networkRouter } from './routes/networkRoutes.js';
import { messagingRouter } from './routes/messagingRoutes.js';
import { billingRouter } from './routes/billingRoutes.js';
import { adminBillingRouter } from './routes/adminBillingRoutes.js';
import { postRazorpayWebhook } from './controllers/billingController.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { requestContext } from './middleware/requestContext.js';
import { errorHandler } from './middleware/error.js';
import { getApplicationHealth } from './services/healthService.js';

export const app = express();

app.disable('x-powered-by');
if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      // Razorpay Standard Checkout (checkout.js + its api.razorpay.com XHR
      // calls + its lumberjack.razorpay.com telemetry beacon) are the only
      // third-party additions here - everything else stays 'self'. This
      // backend serves JSON only, so the frontend's own CSP (see
      // frontend/next.config.mjs) is what actually governs the page that
      // loads checkout.js; this is kept in sync for defense-in-depth.
      'connect-src': ["'self'", ...env.corsAllowedOrigins, 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'script-src': ["'self'", 'https://checkout.razorpay.com'],
      'frame-src': ["'self'", 'https://api.razorpay.com'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(requestContext);

// Razorpay webhook: signature verification (razorpayService.verifyWebhookSignature)
// requires the UNMODIFIED raw request body bytes, so this route is mounted
// with express.raw() ahead of the global express.json() parser below - if
// this route were reached after express.json(), req.body would already be
// a re-serialized JS object and signature verification would never match a
// real Razorpay delivery. Rate-limited by source IP since webhook calls are
// unauthenticated (their trust comes entirely from the signature).
app.post(
  '/api/billing/webhooks/razorpay',
  createRateLimiter({ keyPrefix: 'billing:webhook', limit: 120, windowMinutes: 5, keyResolver: (req) => req.ip }),
  express.raw({ type: 'application/json', limit: `${env.apiBodyLimitMb}mb` }),
  postRazorpayWebhook,
);

app.use(express.json({ limit: `${env.apiBodyLimitMb}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${env.apiBodyLimitMb}mb` }));
app.get('/api/health', async (req, res, next) => {
  try {
    const health = await getApplicationHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRouter);
app.use('/api/setup', setupRouter);
app.use('/api', applicationWorkflowRouter);
app.use('/api/jobs', jobRouter);
app.use('/api/public', publicRouter);
app.use('/api/candidate', candidateRouter);
app.use('/api/resumes', resumeRouter);
app.use('/api/ats', atsRouter);
app.use('/api/resume-builder', resumeBuilderRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/organisations', organisationRouter);
app.use('/api/requisitions', requisitionRouter);
app.use('/api/interviews', interviewRouter);
app.use('/api/meeting-providers', meetingProviderRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/offers', offerRouter);
app.use('/api/admin', adminRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/resume-imports', resumeImportRouter);
app.use('/api/network', networkRouter);
app.use('/api/messages', messagingRouter);
app.use('/api/billing', billingRouter);
app.use('/api/admin/billing', adminBillingRouter);

app.use(errorHandler);
