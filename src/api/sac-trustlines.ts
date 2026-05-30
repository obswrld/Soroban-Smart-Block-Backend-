/**
 * GET /api/v1/sac-trustlines                  — aggregate stats & list
 * GET /api/v1/sac-trustlines/account/:gAccount — trustlines for a G-account
 * GET /api/v1/sac-trustlines/sac/:sacAddress   — trustlines for a SAC contract
 * GET /api/v1/sac-trustlines/lookup/:gAccount/:sacAddress — single mapping
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getTrustlinesByAccount,
  getTrustlinesBySac,
  getTrustlineByAccountAndSac,
  getSacTrustlineStats,
} from '../indexer/sac-trustline-mapper';

export const sacTrustlinesRouter = Router();

const listSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
});

/**
 * GET /sac-trustlines
 * Returns aggregate statistics and optionally a list of recent mappings.
 */
sacTrustlinesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const stats = await getSacTrustlineStats();
    res.json(stats);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

/**
 * GET /sac-trustlines/account/:gAccount
 * Returns all trustlines for a given G-account.
 */
sacTrustlinesRouter.get('/account/:gAccount', async (req: Request, res: Response) => {
  try {
    const { limit } = listSchema.parse(req.query);
    const results = await getTrustlinesByAccount(req.params.gAccount, limit);
    res.json({ data: results });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

/**
 * GET /sac-trustlines/sac/:sacAddress
 * Returns all trustlines for a given SAC contract address.
 */
sacTrustlinesRouter.get('/sac/:sacAddress', async (req: Request, res: Response) => {
  try {
    const { limit } = listSchema.parse(req.query);
    const results = await getTrustlinesBySac(req.params.sacAddress, limit);
    res.json({ data: results });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

/**
 * GET /sac-trustlines/lookup/:gAccount/:sacAddress
 * Returns a single trustline mapping by G-account and SAC address.
 */
sacTrustlinesRouter.get('/lookup/:gAccount/:sacAddress', async (req: Request, res: Response) => {
  try {
    const result = await getTrustlineByAccountAndSac(req.params.gAccount, req.params.sacAddress);
    if (!result) {
      return res.status(404).json({ error: 'Trustline mapping not found' });
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});
