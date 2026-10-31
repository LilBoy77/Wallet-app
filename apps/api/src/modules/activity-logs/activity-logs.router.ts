import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../middlewares/index.js';
import { asyncHandler } from '../../shared/errors/index.js';
import { activityLogQuerySchema } from '@wallet-app/shared';
import { getMyActivityLogs, getAdminActivityLogs } from './activity-logs.controller.js';

export const activityLogsRouter: Router = Router();

// 1. User views own activity logs via /my
activityLogsRouter.get(
  '/my',
  asyncHandler(authenticate),
  validate({ query: activityLogQuerySchema }),
  getMyActivityLogs
);

// 2. GET /: Regular user gets own logs; Admin gets all logs
activityLogsRouter.get(
  '/',
  asyncHandler(authenticate),
  validate({ query: activityLogQuerySchema }),
  (req, res, next) => {
    if (req.user?.role === 'admin') {
      return getAdminActivityLogs(req, res, next);
    }
    return getMyActivityLogs(req, res, next);
  }
);

// Router specifically for /admin/activity-logs per API_CONTRACT.md
export const adminActivityLogsRouter: Router = Router();

adminActivityLogsRouter.get(
  '/activity-logs',
  asyncHandler(authenticate),
  requireRole('admin'),
  validate({ query: activityLogQuerySchema }),
  getAdminActivityLogs
);
