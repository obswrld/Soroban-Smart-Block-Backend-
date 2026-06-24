/**
 * GET  /api/v1/analytics/gas                            — pre-aggregated gas cost snapshots
 * POST /api/v1/analytics/gas/run                        — trigger an on-demand analytics run
 * GET  /api/v1/analytics/protocol-economics             — protocol fee/burn/revenue snapshots (#301)
 * GET  /api/v1/analytics/protocol-economics/summary     — cross-bucket totals (#301)
 * POST /api/v1/analytics/protocol-economics/run         — on-demand recompute (#301)
 */

import { Router, Request, Response } from 'express';
import { prismaRead as prisma } from '../db';
import { runGasAnalytics } from '../indexer/gasAnalytics';
import { z } from 'zod';
import { protocolEconomicsRouter } from './protocol-economics';
import { asyncHandler } from '../middleware/asyncHandler';

export const analyticsRouter = Router();

const querySchema = z.object({
  bucket: z.enum(['hour', 'day', 'week']).default('day'),
  limit: z.coerce.number().min(1).max(500).default(48),
});

// GET /analytics/gas — return pre-computed snapshots
analyticsRouter.get(
  '/gas',
  asyncHandler(async (req: Request, res: Response) => {
    const { bucket, limit } = querySchema.parse(req.query);

    const snapshots = await prisma.gasAnalyticsSnapshot.findMany({
      where: { bucket },
      orderBy: { bucketStart: 'desc' },
      take: limit,
    });

    res.json({ bucket, data: snapshots });
  }),
);

// POST /analytics/gas/run — on-demand trigger
analyticsRouter.post(
  '/gas/run',
  asyncHandler(async (_req: Request, res: Response) => {
    await runGasAnalytics();
    res.json({ ok: true });
  }),
);

// ── Protocol Economic Dashboard (#301) ────────────────────────────────────────
analyticsRouter.use('/protocol-economics', protocolEconomicsRouter);
