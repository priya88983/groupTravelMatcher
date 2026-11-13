import 'dotenv/config';
import app from './app.js';
import { checkDatabaseConnection } from './config/database.js';

const port = Number(process.env.PORT || 5000);

try {
  if (!checkDatabaseConnection()) {
    throw new Error('Database connection check failed');
  }

  console.log('[server] SQLite database connected successfully');

  app.listen(port, () => {
    console.log(`[server] Server running on http://localhost:${port}`);
    console.log(`[server] Health check: http://localhost:${port}/api/health`);
  });
} catch (error) {
  console.error('[server] Database connection failed:', error.message);
  process.exit(1);
}
