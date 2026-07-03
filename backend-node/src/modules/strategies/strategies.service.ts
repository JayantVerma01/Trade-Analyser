import { PrismaClient } from '@prisma/client';
import { aiService }    from '../../services/ai.service';
import type { CreateStrategyInput, UpdateStrategyInput } from './strategies.schema';

const prisma = new PrismaClient();

export const strategiesService = {

  async list(userId: string) {
    return prisma.strategy.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id:          true,
        name:        true,
        description: true,
        marketType:  true,
        conditions:  true,
        isActive:    true,
        createdAt:   true,
        updatedAt:   true,
        _count:      { select: { tradeSetups: true } },
      },
    });
  },

  async getOne(id: string, userId: string) {
    const strategy = await prisma.strategy.findFirst({ where: { id, userId } });
    if (!strategy) throw new Error('Strategy not found');
    return strategy;
  },

  async create(userId: string, data: CreateStrategyInput) {
    return prisma.strategy.create({
      data: {
        userId,
        name:        data.name,
        description: data.description,
        marketType:  data.marketType,
        conditions:  data.conditions as any,
      },
    });
  },

  async update(id: string, userId: string, data: UpdateStrategyInput) {
    await this.getOne(id, userId);   // ownership check
    return prisma.strategy.update({
      where: { id },
      data: {
        ...(data.name        !== undefined && { name:        data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.marketType  !== undefined && { marketType:  data.marketType }),
        ...(data.conditions  !== undefined && { conditions:  data.conditions as any }),
        ...(data.isActive    !== undefined && { isActive:    data.isActive }),
      },
    });
  },

  async delete(id: string, userId: string) {
    await this.getOne(id, userId);
    return prisma.strategy.delete({ where: { id } });
  },

  async evaluate(id: string, userId: string, symbol: string, timeframe: string) {
    const strategy = await this.getOne(id, userId);
    const result   = await aiService.evaluateStrategy(symbol, timeframe, strategy.conditions as any);
    return { strategy: { id: strategy.id, name: strategy.name }, ...result };
  },

  async scan(id: string, userId: string, symbols: string[], timeframe: string) {
    const strategy = await this.getOne(id, userId);
    const result   = await aiService.scanStrategy(symbols, timeframe, strategy.conditions as any);
    return { strategy: { id: strategy.id, name: strategy.name }, ...result };
  },

  async getMeta() {
    return aiService.getStrategyMeta();
  },
};
