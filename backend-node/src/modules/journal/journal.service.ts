import { prisma } from '../../config/database';
import type { CreateJournalInput, UpdateJournalInput, ListJournalInput } from './journal.schema';

export const journalService = {

  async create(userId: string, input: CreateJournalInput) {
    // If linked to a paper trade, verify ownership
    if (input.paperTradeId) {
      const pt = await prisma.paperTrade.findFirst({ where: { id: input.paperTradeId, userId } });
      if (!pt) throw new Error('Paper trade not found');
    }

    return prisma.tradeJournal.create({
      data: {
        userId,
        paperTradeId:   input.paperTradeId,
        symbol:         input.symbol,
        setupType:      input.setupType,
        result:         input.result,
        pnl:            input.pnl,
        notes:          input.notes,
        mistakes:       input.mistakes ?? [],
        emotionTags:    input.emotionTags ?? [],
        lessonsLearned: input.lessonsLearned,
      },
      include: { paperTrade: { select: { id: true, symbol: true, direction: true } } },
    });
  },

  async update(id: string, userId: string, input: UpdateJournalInput) {
    await this._getOwned(id, userId);
    return prisma.tradeJournal.update({
      where: { id },
      data:  {
        ...(input.symbol         !== undefined ? { symbol: input.symbol }                 : {}),
        ...(input.setupType      !== undefined ? { setupType: input.setupType }           : {}),
        ...(input.result         !== undefined ? { result: input.result }                 : {}),
        ...(input.pnl            !== undefined ? { pnl: input.pnl }                      : {}),
        ...(input.notes          !== undefined ? { notes: input.notes }                   : {}),
        ...(input.mistakes       !== undefined ? { mistakes: input.mistakes }             : {}),
        ...(input.emotionTags    !== undefined ? { emotionTags: input.emotionTags }       : {}),
        ...(input.lessonsLearned !== undefined ? { lessonsLearned: input.lessonsLearned } : {}),
      },
      include: { paperTrade: { select: { id: true, symbol: true, direction: true } } },
    });
  },

  async list(userId: string, filters: ListJournalInput) {
    const where: any = { userId };
    if (filters.symbol)   where.symbol = { equals: filters.symbol, mode: 'insensitive' };
    if (filters.result)   where.result = filters.result;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo)   where.createdAt.lte = new Date(filters.dateTo);
    }

    const [entries, total] = await Promise.all([
      prisma.tradeJournal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    filters.take,
        skip:    filters.skip,
        include: { paperTrade: { select: { id: true, symbol: true, direction: true, entryPrice: true } } },
      }),
      prisma.tradeJournal.count({ where }),
    ]);

    return { entries, total, take: filters.take, skip: filters.skip };
  },

  async getOne(id: string, userId: string) {
    return this._getOwned(id, userId, true);
  },

  async delete(id: string, userId: string) {
    await this._getOwned(id, userId);
    return prisma.tradeJournal.delete({ where: { id } });
  },

  async stats(userId: string) {
    const all = await prisma.tradeJournal.findMany({
      where: { userId },
      select: { result: true, pnl: true, mistakes: true, emotionTags: true },
    });

    const total     = all.length;
    const wins      = all.filter(e => e.result === 'WIN').length;
    const losses    = all.filter(e => e.result === 'LOSS').length;
    const breakevens = total - wins - losses;
    const winRate   = total > 0 ? Math.round((wins / total) * 100) : 0;
    const totalPnl  = all.reduce((acc, e) => acc + Number(e.pnl ?? 0), 0);
    const avgPnl    = total > 0 ? Math.round(totalPnl / total) : 0;

    // Flatten mistake tags
    const mistakeCounts: Record<string, number> = {};
    const emotionCounts: Record<string, number> = {};
    for (const e of all) {
      for (const m of (e.mistakes as string[] ?? [])) {
        mistakeCounts[m] = (mistakeCounts[m] ?? 0) + 1;
      }
      for (const t of (e.emotionTags as string[] ?? [])) {
        emotionCounts[t] = (emotionCounts[t] ?? 0) + 1;
      }
    }
    const topMistakes  = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count }));
    const topEmotions  = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count }));

    return { total, wins, losses, breakevens, winRate, totalPnl: Math.round(totalPnl), avgPnl, topMistakes, topEmotions };
  },

  async _getOwned(id: string, userId: string, include = false) {
    const entry = await prisma.tradeJournal.findFirst({
      where: { id, userId },
      ...(include ? { include: { paperTrade: { select: { id: true, symbol: true, direction: true, entryPrice: true, exitPrice: true } } } } : {}),
    });
    if (!entry) throw new Error('Journal entry not found');
    return entry;
  },
};
