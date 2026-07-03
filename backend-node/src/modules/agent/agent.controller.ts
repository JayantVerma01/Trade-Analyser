import type { Request, Response, NextFunction } from 'express';
import { agentQuerySchema }   from './agent.schema';
import { aiService }          from '../../services/ai.service';
import { prisma }             from '../../config/database';
import { logger }             from '../../utils/logger';

export const agentController = {

  async tradeQuery(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = agentQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.flatten() });
      }

      const { symbol, timeframe, capital, riskPct, marketType, strategyId, query } = parsed.data;

      // Resolve strategy name (for agent context — non-blocking)
      let strategyName: string | undefined;
      if (strategyId) {
        const strat = await prisma.strategy.findFirst({
          where:  { id: strategyId, userId: req.user!.id },
          select: { name: true },
        }).catch(() => null);
        strategyName = strat?.name;
      }

      const result = await aiService.agentTradeQuery(
        req.user!.id,
        query,
        symbol,
        timeframe,
        capital,
        riskPct,
        marketType,
        strategyName,
      );

      // Persist trade setup if analysis was returned (non-blocking)
      if (result.analysis) {
        const a = result.analysis;
        prisma.tradeSetup.create({
          data: {
            userId:               req.user!.id,
            strategyId:           strategyId ?? null,
            symbol:               a.symbol,
            timeframe:            a.timeframe,
            marketBias:           a.market_bias,
            setupType:            a.setup_type,
            entryZone:            a.entry_zone,
            stopLoss:             a.stop_loss,
            target1:              a.target1,
            target2:              a.target2,
            riskReward:           parseFloat(a.risk_reward.replace('1:', '')),
            positionSize:         a.position_size,
            confidenceScore:      a.confidence_score,
            rulesPassed:          a.rules_passed,
            rulesFailed:          a.rules_failed,
            theoryReferences:     result.theory_references ?? [],
            reasoning:            result.recommendation,
            invalidationCondition: a.invalidation_condition,
            rawAnalysis:          a,
          },
        }).then((s) => logger.info(`Agent setup saved: ${s.id}`))
          .catch((e) => logger.warn('Agent setup persist failed:', e.message));
      }

      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
};
