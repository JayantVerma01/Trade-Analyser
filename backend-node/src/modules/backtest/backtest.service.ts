import { prisma }    from '../../config/database';
import { aiService }  from '../../services/ai.service';
import { logger }     from '../../utils/logger';
import type { RunBacktestInput } from './backtest.schema';

export const backtestService = {

  async run(userId: string, input: RunBacktestInput) {
    // Fetch strategy + verify ownership
    const strategy = await prisma.strategy.findFirst({
      where:  { id: input.strategyId, userId },
    });
    if (!strategy) throw new Error('Strategy not found');

    // Mark backtest as RUNNING in DB
    const record = await prisma.backtest.create({
      data: {
        userId,
        strategyId: strategy.id,
        symbol:     input.symbol,
        timeframe:  input.timeframe,
        fromDate:   new Date(Date.now() - input.nCandles * 900_000), // approx start
        toDate:     new Date(),
        status:     'RUNNING',
      },
    });

    let result: any;
    try {
      result = await aiService.runBacktest(
        input.symbol,
        input.timeframe,
        strategy.conditions as Record<string, any>,
        input.capital,
        input.riskPct,
        input.nCandles,
      );

      // Persist results
      await prisma.backtest.update({
        where: { id: record.id },
        data:  {
          status:        'COMPLETED',
          totalTrades:   result.total_trades,
          winningTrades: result.winning_trades,
          losingTrades:  result.losing_trades,
          winRate:       result.win_rate,
          avgRR:         result.avg_rr,
          maxDrawdown:   result.max_drawdown_pct,
          netPnl:        result.net_pnl,
          resultData:    result,
        },
      });

      return { backtestId: record.id, ...result };
    } catch (err: any) {
      await prisma.backtest.update({
        where: { id: record.id },
        data:  { status: 'FAILED' },
      }).catch(() => {});
      throw err;
    }
  },

  async list(userId: string) {
    return prisma.backtest.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select: {
        id: true, symbol: true, timeframe: true, status: true,
        totalTrades: true, winRate: true, netPnl: true, maxDrawdown: true,
        avgRR: true, createdAt: true,
        strategy: { select: { id: true, name: true } },
      },
    });
  },

  async getOne(id: string, userId: string) {
    const bt = await prisma.backtest.findFirst({ where: { id, userId } });
    if (!bt) throw new Error('Backtest not found');
    return bt;
  },

  async delete(id: string, userId: string) {
    await this.getOne(id, userId);
    return prisma.backtest.delete({ where: { id } });
  },
};
