import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { checkDatabaseConnection } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import travellerRoutes from './routes/travellerRoutes.js';
import metaRoutes from './routes/metaRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  try {
    if (!checkDatabaseConnection()) throw new Error('Database check failed');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/travellers', travellerRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/search', searchRoutes);
app.use('/api', requestRoutes);
app.use('/api/users', userRoutes);

app.use(errorHandler);

export default app;
