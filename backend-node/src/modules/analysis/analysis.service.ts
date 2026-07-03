import { prisma } from '../../config/database';
import { aiService } from '../../services/ai.service';
import { StockAnalysisInput } from './analysis.schema';
import { logger } from '../../utils/logger';

export const runStockAnalysis = async (userId: string, input: StockAnalysisInput) => {
  // Resolve strategy conditions from DB if strategyId provided
  let strategyConditions: Record<string, any> | undefined;
  let strategyName = '';
  if (input.strategyId) {
    try {
      const strat = await prisma.strategy.findFirst({
        where: { id: input.strategyId, userId },
        select: { conditions: true, name: true },
      });
      if (strat) {
        strategyConditions = strat.conditions as Record<string, any>;
        strategyName = strat.name;
      }
    } catch { /* non-critical — proceed without strategy */ }
  }

  // Call Python analysis engine
  const result = await aiService.analyseStock(
    input.symbol,
    input.timeframe,
    input.capital,
    input.riskPct,
    input.marketType,
    input.notes ?? '',
    strategyConditions,
    strategyName,
  );

  // Persist the setup to DB (non-blocking best-effort)
  prisma.tradeSetup.create({
    data: {
      userId,
      strategyId:           input.strategyId ?? null,
      symbol:               result.symbol,
      timeframe:            result.timeframe,
      marketBias:           result.market_bias,
      setupType:            result.setup_type,
      entryZone:            result.entry_zone,
      stopLoss:             result.stop_loss,
      target1:              result.target1,
      target2:              result.target2,
      riskReward:           parseFloat(result.risk_reward.replace('1:', '')),
      positionSize:         result.position_size,
      confidenceScore:      result.confidence_score,
      rulesPassed:          result.rules_passed,
      rulesFailed:          result.rules_failed,
      theoryReferences:     result.theory_references,
      reasoning:            result.reasoning,
      invalidationCondition: result.invalidation_condition,
      rawAnalysis:          result,
    },
  }).then((setup) => {
    logger.info(`Trade setup saved: ${setup.id} for ${result.symbol}`);
  }).catch((err) => {
    logger.warn('Could not persist trade setup:', err.message);
  });

  return result;
};

export const getRecentSetups = async (userId: string, limit = 10) => {
  return prisma.tradeSetup.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      symbol: true,
      timeframe: true,
      marketBias: true,
      setupType: true,
      entryZone: true,
      stopLoss: true,
      target1: true,
      target2: true,
      riskReward: true,
      positionSize: true,
      confidenceScore: true,
      createdAt: true,
    },
  });
};
