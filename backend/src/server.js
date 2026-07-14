import { app } from './app.js';
import { env } from './config/env.js';
import { ensureResumeIndex } from './config/elastic.js';

const start = async () => {
  try {
    await ensureResumeIndex();
    app.listen(env.port, () => {
      console.log(`Careeriz API running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

start();
