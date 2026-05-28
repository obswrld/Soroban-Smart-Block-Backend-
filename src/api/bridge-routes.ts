import { Router, Request, Response } from 'express';
import {
  analyzeBridgeRoute,
  storeBridgeRoute,
  queryBridgeRoutes,
} from '../indexer/bridge-route-mapper';

export const bridgeRoutesRouter = Router();

/**
 * GET /api/v1/bridge-routes/:transactionHash
 * Analyze cross-chain bridge route for a transaction.
 */
bridgeRoutesRouter.get('/:transactionHash', async (req: Request, res: Response) => {
  try {
    const { transactionHash } = req.params;

    const route = await analyzeBridgeRoute(transactionHash);

    if (!route) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Store metadata
    await storeBridgeRoute(transactionHash, route);

    res.json({
      transactionHash,
      direction: route.direction,
      sourceChain: route.sourceChain,
      destinationChain: route.destinationChain,
      token: {
        address: route.tokenAddress,
        symbol: route.tokenSymbol,
        amount: route.amount,
      },
      sender: route.senderAddress,
      recipient: route.recipientAddress,
      bridgeStandard: route.bridgeStandard,
      externalScannerUrl: route.externalScannerUrl,
      actions: {
        lock: route.lockAction,
        unlock: route.unlockAction,
      },
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/v1/bridge-routes
 * Query bridge routes by direction and destination chain.
 */
bridgeRoutesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { direction, destinationChain } = req.query;

    if (!direction || !['inbound', 'outbound'].includes(direction as string)) {
      return res.status(400).json({
        error: 'direction query param required: inbound or outbound',
      });
    }

    const routes = await queryBridgeRoutes(
      direction as 'inbound' | 'outbound',
      destinationChain as string | undefined
    );

    res.json({
      direction,
      destinationChain: destinationChain || 'all',
      routeCount: routes.length,
      routes,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/v1/bridge-routes/batch
 * Analyze multiple transactions for bridge routes.
 */
bridgeRoutesRouter.post('/batch', async (req: Request, res: Response) => {
  try {
    const { transactionHashes } = req.body;

    if (!Array.isArray(transactionHashes)) {
      return res.status(400).json({ error: 'transactionHashes must be an array' });
    }

    const results = await Promise.all(
      transactionHashes.map(async (hash: string) => {
        const route = await analyzeBridgeRoute(hash);
        return {
          transactionHash: hash,
          isBridgeRoute: !!route,
          direction: route?.direction,
          destinationChain: route?.destinationChain,
          externalScannerUrl: route?.externalScannerUrl,
        };
      })
    );

    const bridgeRoutes = results.filter(r => r.isBridgeRoute);

    res.json({
      totalAnalyzed: results.length,
      bridgeRouteCount: bridgeRoutes.length,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});
