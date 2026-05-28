import { Router, Request, Response } from 'express';
import {
  extractOraclePriceUpdate,
  buildOracleAnalyticalMatrix,
  storeOracleMatrix,
  isOracleUpdate,
} from '../indexer/oracle-ingest-processor';
import { prismaRead as prisma } from '../db';

export const oracleFeedsRouter = Router();

/**
 * GET /api/v1/oracle-feeds/:transactionHash
 * Extract oracle price update from transaction.
 */
oracleFeedsRouter.get('/:transactionHash', async (req: Request, res: Response) => {
  try {
    const { transactionHash } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { hash: transactionHash },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (!isOracleUpdate(transaction.functionName, transaction.contractAddress)) {
      return res.json({
        transactionHash,
        isOracleUpdate: false,
        message: 'Not an oracle price update transaction',
      });
    }

    const update = await extractOraclePriceUpdate(transactionHash);

    res.json({
      transactionHash,
      isOracleUpdate: true,
      oracle: update,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/v1/oracle-feeds/matrix/:assetPair
 * Retrieve analytical matrix for asset pair price history.
 */
oracleFeedsRouter.get('/matrix/:assetPair', async (req: Request, res: Response) => {
  try {
    const { assetPair } = req.params;
    const { source, ledgerStart, ledgerEnd } = req.query;

    const matrix = await buildOracleAnalyticalMatrix(
      assetPair,
      source as string | undefined,
      ledgerStart ? parseInt(ledgerStart as string) : undefined,
      ledgerEnd ? parseInt(ledgerEnd as string) : undefined
    );

    if (!matrix) {
      return res.status(404).json({
        error: `No price history found for asset pair: ${assetPair}`,
      });
    }

    res.json({
      assetPair,
      source: matrix.source,
      updateCount: matrix.updateCount,
      averagePrice: matrix.averagePrice,
      minPrice: matrix.minPrice,
      maxPrice: matrix.maxPrice,
      volatility: matrix.volatility.toFixed(8),
      lastUpdate: new Date(matrix.lastUpdate).toISOString(),
      priceHistory: matrix.priceHistory.slice(-100), // Last 100 updates
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/v1/oracle-feeds
 * List all oracle price updates (filtered from user transactions).
 */
oracleFeedsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { source, assetPair, limit = '50' } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: {
        functionName: {
          contains: 'price',
        },
      },
      orderBy: { ledgerSequence: 'desc' },
      take: Math.min(parseInt(limit as string), 500),
      include: { ledger: true },
    });

    const oracleUpdates = [];

    for (const tx of transactions) {
      if (!isOracleUpdate(tx.functionName, tx.contractAddress)) continue;

      const update = await extractOraclePriceUpdate(tx.hash);
      if (!update) continue;

      if (source && update.source !== source) continue;
      if (assetPair && update.assetPair !== assetPair) continue;

      oracleUpdates.push({
        transactionHash: tx.hash,
        ledger: tx.ledgerSequence,
        timestamp: tx.ledger?.closeTime.toISOString(),
        oracle: update,
      });
    }

    res.json({
      totalUpdates: oracleUpdates.length,
      filters: {
        source: source || 'all',
        assetPair: assetPair || 'all',
      },
      updates: oracleUpdates,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/v1/oracle-feeds/matrix/build
 * Build and store analytical matrix for asset pair.
 */
oracleFeedsRouter.post('/matrix/build', async (req: Request, res: Response) => {
  try {
    const { assetPair, source, ledgerStart, ledgerEnd } = req.body;

    if (!assetPair) {
      return res.status(400).json({ error: 'assetPair is required' });
    }

    const matrix = await buildOracleAnalyticalMatrix(
      assetPair,
      source,
      ledgerStart,
      ledgerEnd
    );

    if (!matrix) {
      return res.status(404).json({
        error: `No price history found for asset pair: ${assetPair}`,
      });
    }

    await storeOracleMatrix(matrix);

    res.json({
      assetPair: matrix.assetPair,
      source: matrix.source,
      updateCount: matrix.updateCount,
      averagePrice: matrix.averagePrice,
      minPrice: matrix.minPrice,
      maxPrice: matrix.maxPrice,
      volatility: matrix.volatility.toFixed(8),
      message: 'Analytical matrix built and stored',
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});
