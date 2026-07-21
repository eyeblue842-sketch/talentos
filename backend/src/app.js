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
      'connect-src': ["'self'", ...env.corsAllowedOrigins],
      'img-src': ["'self'", 'data:', 'blob:'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'script-src': ["'self'"],
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
app.use('/api/notifications', notificationRouter);
app.use('/api/offers', offerRouter);
app.use('/api/admin', adminRouter);
app.use('/api/intelligence', intelligenceRouter);

app.use(errorHandler);
