require('dotenv').config();
const express = require('express');
const proxy = require('express-http-proxy');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';
const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || 'http://localhost:3003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3011';
const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://localhost:3012';
const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'http://localhost:3013';
const COMMENT_SERVICE_URL = process.env.COMMENT_SERVICE_URL || 'http://localhost:3014';
const REMINDER_SERVICE_URL = process.env.REMINDER_SERVICE_URL || 'http://localhost:3015';

const forwardUserHeaders = (proxyReqOpts, srcReq) => {
  proxyReqOpts.headers['x-user-id'] = srcReq.headers['x-user-id'];
  proxyReqOpts.headers['x-user-email'] = srcReq.headers['x-user-email'];
  proxyReqOpts.headers['x-user-role'] = srcReq.headers['x-user-role'];
  proxyReqOpts.headers['x-user-name'] = srcReq.headers['x-user-name'];
  return proxyReqOpts;
};

const protectedProxy = (target, pathPrefix, serviceName) =>
  proxy(target, {
    proxyReqPathResolver: (req) => `${pathPrefix}${req.url}`,
    proxyReqOptDecorator: forwardUserHeaders,
    proxyErrorHandler: (err, res) => {
      console.error(`${serviceName} proxy error:`, err.message);
      res.status(502).json({ error: `${serviceName} unavailable` });
    },
  });

// Security
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(morgan('combined'));

// Global rate limit
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Too many requests' },
  })
);

// Auth routes — no authentication required
app.use(
  '/api/auth',
  proxy(AUTH_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/auth${req.url}`,
    proxyErrorHandler: (err, res) => {
      console.error('Auth service proxy error:', err.message);
      res.status(502).json({ error: 'Auth service unavailable' });
    },
  })
);

// Protected routes — JWT required
app.use(
  '/api/users',
  authenticate,
  proxy(USER_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/users${req.url}`,
    proxyReqOptDecorator: forwardUserHeaders,
    proxyErrorHandler: (err, res) => {
      console.error('User service proxy error:', err.message);
      res.status(502).json({ error: 'User service unavailable' });
    },
  })
);

app.use(
  '/api/tasks',
  authenticate,
  proxy(TASK_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/tasks${req.url}`,
    proxyReqOptDecorator: forwardUserHeaders,
    proxyErrorHandler: (err, res) => {
      console.error('Task service proxy error:', err.message);
      res.status(502).json({ error: 'Task service unavailable' });
    },
  })
);

app.use('/api/notifications', authenticate, protectedProxy(NOTIFICATION_SERVICE_URL, '/notifications', 'Notification service'));
app.use('/api/analytics', authenticate, protectedProxy(ANALYTICS_SERVICE_URL, '/analytics', 'Analytics service'));
app.use('/api/files', authenticate, protectedProxy(FILE_SERVICE_URL, '/files', 'File service'));
app.use('/api/search', authenticate, protectedProxy(SEARCH_SERVICE_URL, '/search', 'Search service'));
app.use('/api/comments', authenticate, protectedProxy(COMMENT_SERVICE_URL, '/comments', 'Comment service'));
app.use('/api/reminders', authenticate, protectedProxy(REMINDER_SERVICE_URL, '/reminders', 'Reminder service'));

// Gateway health + upstream status
app.get('/health', async (req, res) => {
  const axios = require('axios');
  const services = {
    'auth-service': AUTH_SERVICE_URL,
    'user-service': USER_SERVICE_URL,
    'task-service': TASK_SERVICE_URL,
    'notification-service': NOTIFICATION_SERVICE_URL,
    'analytics-service': ANALYTICS_SERVICE_URL,
    'file-service': FILE_SERVICE_URL,
    'search-service': SEARCH_SERVICE_URL,
    'comment-service': COMMENT_SERVICE_URL,
    'reminder-service': REMINDER_SERVICE_URL,
  };
  const checks = await Promise.allSettled(
    Object.entries(services).map(async ([name, url]) => {
      const resp = await axios.get(`${url}/health`, { timeout: 3000 });
      return { name, status: resp.data.status };
    })
  );

  const results = checks.map((r, i) => ({
    service: Object.keys(services)[i],
    status: r.status === 'fulfilled' ? r.value.status : 'down',
  }));

  const allUp = results.every((s) => s.status === 'ok');
  res.status(allUp ? 200 : 207).json({ gateway: 'ok', services: results });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
