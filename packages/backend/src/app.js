import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import taskRoutes from './routes/tasks.js';
import telegramRoutes from './routes/telegram.js';
import propertyTypesRoutes from './routes/propertyTypes.js';
import catalogRoutes from './routes/catalog.js';
import propertiesRoutes from './routes/properties.js';
import reservationsRoutes from './routes/reservations.js';
import cleaningTasksRoutes from './routes/cleaningTasks.js';
import cleaningSettlementsRoutes from './routes/cleaning-settlements.js';
import maintenanceSettlementsRoutes from './routes/maintenance-settlements.js';
import tenantsRoutes from './routes/tenants.js';
import billingRoutes from './routes/billing.js';
import webhookRoutes from './routes/webhooks.js';
import adminRoutes from './routes/admin.js';

// Middleware
import { errorHandler, notFound } from './middleware/error.js';
import { tenantIsolation } from './middleware/auth.js';
import { apiLimiter, publicLimiter } from './middleware/rateLimiter.js';
import { metricsMiddleware, metricsEndpoint } from './middleware/metrics.js';

dotenv.config();

const app = express();

// Trust proxy - needed when behind nginx/reverse proxy
// Trust only the first proxy hop (nginx in our case)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Webhook routes MUST come before body parser (they need raw body)
app.use('/webhooks', webhookRoutes);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware
app.use(cookieParser());

// Request logging (simple)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Prometheus metrics middleware
app.use(metricsMiddleware);

// Health check endpoint (with lenient rate limiting)
app.get('/health', publicLimiter, (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Prometheus metrics endpoint
app.get('/metrics', metricsEndpoint);

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
      telegram: '/api/telegram',
      billing: '/api/billing',
      webhooks: '/webhooks',
      admin: '/api/admin'
    }
  });
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/property-types', propertyTypesRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/cleaning-tasks', cleaningTasksRoutes);
app.use('/api/cleaning-settlements', cleaningSettlementsRoutes);
app.use('/api/maintenance-settlements', maintenanceSettlementsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
