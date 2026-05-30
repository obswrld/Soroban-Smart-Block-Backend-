/**
 * GET /api/v1/bn254                   — aggregate BN254 gas exemption stats
 * GET /api/v1/bn254/tx/:hash          — single tx BN254 savings
 * GET /api/v1/bn254/contract/:address — BN254 savings for a contract
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getBn254ExemptionByTx,
  getBn254ExemptionsByContract,
  getBn254AggregateStats,
} from '../indexer/bn254-tracker';

export const bn254Router = Router();

const listSchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(100),
});

/**
 * @swagger
 * /bn254:
 *   get:
 *     summary: BN254 ZK host function gas exemption aggregate statistics
 *     description: >
 *       Returns aggregate statistics for transactions that used BN254 curve
 *       host functions (CAP-0080), including total stroop savings, average
 *       savings percentage, and recent transactions.
 *     tags: [BN254]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 500 }
 *         description: Number of recent records to aggregate
 *     responses:
 *       200:
 *         description: Aggregate BN254 statistics
 */
bn254Router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit } = listSchema.parse(req.query);
    const stats = await getBn254AggregateStats(limit);
    res.json(stats);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

/**
 * @swagger
 * /bn254/tx/{hash}:
 *   get:
 *     summary: Get BN254 gas exemption for a specific transaction
 *     description: >
 *       Returns the BN254 host function gas savings data for a given
 *       transaction hash, including detected operations, stroop savings,
 *       and the savings percentage.
 *     tags: [BN254]
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema: { type: string }
 *         description: Transaction hash
 *     responses:
 *       200:
 *         description: BN254 gas exemption data
 *       404:
 *         description: No BN254 operations found for this transaction
 */
bn254Router.get('/tx/:hash', async (req: Request, res: Response) => {
  const result = await getBn254ExemptionByTx(req.params.hash);
  if (!result) {
    return res.status(404).json({ error: 'No BN254 operations found for this transaction' });
  }
  res.json(result);
});

/**
 * @swagger
 * /bn254/contract/{address}:
 *   get:
 *     summary: Get BN254 gas exemptions for a contract
 *     description: >
 *       Returns all BN254 host function gas exemption records for a given
 *       contract address, ordered by ledger sequence descending.
 *     tags: [BN254]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: List of BN254 gas exemption records
 */
bn254Router.get('/contract/:address', async (req: Request, res: Response) => {
  try {
    const { limit } = listSchema.parse(req.query);
    const results = await getBn254ExemptionsByContract(req.params.address, limit);
    res.json({ data: results });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});
