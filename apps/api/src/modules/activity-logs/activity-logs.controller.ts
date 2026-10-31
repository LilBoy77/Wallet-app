import type { Request, Response, RequestHandler } from 'express';
import { activityLogsService } from './activity-logs.service.js';
import { asyncHandler } from '../../shared/errors/index.js';
import type { ActivityLogQuery } from '@wallet-app/shared';

export const getMyActivityLogs: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query = req.query as unknown as ActivityLogQuery;
    const result = await activityLogsService.getMyLogs(userId, query);

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }
);

export const getAdminActivityLogs: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as ActivityLogQuery;
    const result = await activityLogsService.getAdminLogs(query);

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }
);
