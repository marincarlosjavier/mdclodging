import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import taskRoutes from './routes/tasks.js';
import telegramRoutes from './routes/telegram.js';
import propertyTypesRoutes from './routes/propertyTypes.js';
import catalogRoutes from './routes/catalog.js';
import propertiesRoutes from './routes/properties.js';

// Middleware
import { errorHandler, notFound } from './middleware/error.js';
import { tenantIsolation } from './middleware/auth.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (simple)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'MDCLodging API',
    version: '1.0.0',
    description: 'Multi-tenant Hotel Management System API',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      tasks: '/api/tasks',
      telegram: '/api/telegram'
    }
  });
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/property-types', propertyTypesRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/properties', propertiesRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
