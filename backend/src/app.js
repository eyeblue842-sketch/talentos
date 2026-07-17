import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
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
import { publicRouter } from './routes/publicRoutes.js';
import { candidateRouter } from './routes/candidateRoutes.js';
import { errorHandler } from './middleware/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(__dirname, '..', env.localStoragePath)));

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'careeriz-api' } });
});

app.use('/api/auth', authRouter);
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

app.use(errorHandler);
