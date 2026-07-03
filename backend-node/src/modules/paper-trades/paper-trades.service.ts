import { prisma } from '../../config/database';
import type { OpenPaperTradeInput, ClosePaperTradeInput } from './paper-trades.schema';

const OPEN_STATUSES  = ['PENDING', 'ACTIVE'] as const;
const CLOSED_STATUSES = ['TARGET_HIT', 'STOP_LOSS_HIT', 'MANUALLY_CLOSED', 'CANCELLED'] as const;

function computePnl(direction: string, entryPrice: number, exitPrice: number, qty: number): number {
  const raw = direction === 'LONG'
    ? (exitPrice - entryPrice) * qty
    : (entryPrice - exitPrice) * qty;
  return Math.round(raw * 100) / 100;
}

export const paperTradesService = {

  async open(userId: string, input: OpenPaperTradeInput) {
    return prisma.paperTrade.create({
      data: {
        userId,
        symbol:      input.symbol,
        timeframe:   input.timeframe,
        direction:   input.direction,
        entryPrice:  input.entryPrice,
        stopLoss:    input.stopLoss,
        target1:     input.target1,
        target2:     input.target2,
        quantity:    input.quantity,
        capitalUsed: input.capitalUsed,
        strategyId:  input.strategyId,
        setupId:     input.setupId,
        notes:       input.notes,
        status:      'PENDING',
      },
      include: { strategy: { select: { id: true, name: true } } },
    });
  },

  async activate(id: string, userId: string) {
    const trade = await this._getOwned(id, userId);
    if (trade.status !== 'PENDING') throw new Error('Only PENDING trades can be activated');
    return prisma.paperTrade.update({
      where: { id },
      data:  { status: 'ACTIVE', entryAt: new Date() },
    });
  },

  async close(id: string, userId: string, input: ClosePaperTradeInput) {
    const trade = await this._getOwned(id, userId);
    if (!OPEN_STATUSES.includes(trade.status as any)) throw new Error('Trade is already closed');

    const pnl = computePnl(
      trade.direction,
      Number(trade.entryPrice),
      input.exitPrice,
      trade.quantity,
    );

    const updated = await prisma.paperTrade.update({
      where: { id },
      data:  {
        status:    input.status,
        exitPrice: input.exitPrice,
        pnl,
        exitAt:    new Date(),
        notes:     input.notes ?? trade.notes,
      },
      include: { strategy: { select: { id: true, name: true } } },
    });

    // Auto-create a journal stub so the user can annotate later
    await prisma.tradeJournal.upsert({
      where:  { paperTradeId: id },
      create: {
        userId,
        paperTradeId: id,
        symbol:       updated.symbol,
        setupType:    updated.strategy?.name ?? `${updated.direction} ${updated.symbol}`,
        result:       pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN',
        pnl,
      },
      update: {},
    });

    return updated;
  },

  async cancel(id: string, userId: string) {
    const trade = await this._getOwned(id, userId);
    if (!OPEN_STATUSES.includes(trade.status as any)) throw new Error('Trade is already closed');
    return prisma.paperTrade.update({
      where: { id },
      data:  { status: 'CANCELLED' },
    });
  },

  async list(userId: string, statusFilter?: string) {
    let statusWhere: any = undefined;
    if (statusFilter === 'open')   statusWhere = { in: [...OPEN_STATUSES] };
    if (statusFilter === 'closed') statusWhere = { in: [...CLOSED_STATUSES] };
    if (statusFilter && statusFilter !== 'open' && statusFilter !== 'closed') {
      statusWhere = statusFilter;
    }

    return prisma.paperTrade.findMany({
      where:   { userId, ...(statusWhere ? { status: statusWhere } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { strategy: { select: { id: true, name: true } } },
    });
  },

  async getOne(id: string, userId: string) {
    return this._getOwned(id, userId, true);
  },

  async delete(id: string, userId: string) {
    await this._getOwned(id, userId);
    return prisma.paperTrade.delete({ where: { id } });
  },

  async _getOwned(id: string, userId: string, include = false) {
    const trade = await prisma.paperTrade.findFirst({
      where: { id, userId },
      ...(include ? { include: { strategy: { select: { id: true, name: true } } } } : {}),
    });
    if (!trade) throw new Error('Paper trade not found');
    return trade;
  },
};
