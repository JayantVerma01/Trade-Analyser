import { prisma }    from '../../config/database';
import { aiService }  from '../../services/ai.service';
import type { ConnectBrokerInput } from './broker.schema';

export const brokerService = {

  async connect(userId: string, input: ConnectBrokerInput) {
    // Only one active connection per broker per user
    const existing = await prisma.brokerConnection.findFirst({
      where: { userId, brokerName: input.brokerName },
    });

    if (input.brokerName !== 'MOCK' && (!input.apiKey || !input.apiSecret)) {
      throw new Error(`API key and secret are required to connect ${input.brokerName}`);
    }

    const data = {
      brokerName:          input.brokerName,
      isActive:            input.brokerName === 'MOCK', // real brokers start inactive until OAuth
      apiKeyEncrypted:     input.apiKey    ? Buffer.from(input.apiKey).toString('base64')    : null,
      apiSecretEncrypted:  input.apiSecret ? Buffer.from(input.apiSecret).toString('base64') : null,
    };

    if (existing) {
      return prisma.brokerConnection.update({ where: { id: existing.id }, data });
    }
    return prisma.brokerConnection.create({ data: { userId, ...data } });
  },

  async list(userId: string) {
    return prisma.brokerConnection.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, brokerName: true, isActive: true, createdAt: true,
        tokenExpiresAt: true,
      },
    });
  },

  async disconnect(id: string, userId: string) {
    const conn = await prisma.brokerConnection.findFirst({ where: { id, userId } });
    if (!conn) throw new Error('Broker connection not found');
    return prisma.brokerConnection.delete({ where: { id } });
  },

  async getActiveConnection(userId: string) {
    return prisma.brokerConnection.findFirst({
      where:   { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getAccount(userId: string) {
    const conn = await this.getActiveConnection(userId);
    if (!conn) throw new Error('No active broker connection');
    if (conn.brokerName === 'MOCK') {
      return aiService.getBrokerAccount(userId);
    }
    throw new Error(`Live broker integration for ${conn.brokerName} is not yet available`);
  },

  async getPositions(userId: string) {
    const conn = await this.getActiveConnection(userId);
    if (!conn) throw new Error('No active broker connection');
    if (conn.brokerName === 'MOCK') {
      return aiService.getBrokerPositions(userId);
    }
    throw new Error(`Live broker integration for ${conn.brokerName} is not yet available`);
  },

  async getOrders(userId: string) {
    const conn = await this.getActiveConnection(userId);
    if (!conn) throw new Error('No active broker connection');
    if (conn.brokerName === 'MOCK') {
      return aiService.getBrokerOrders(userId);
    }
    throw new Error(`Live broker integration for ${conn.brokerName} is not yet available`);
  },

  async getHoldings(userId: string) {
    const conn = await this.getActiveConnection(userId);
    if (!conn) throw new Error('No active broker connection');
    if (conn.brokerName === 'MOCK') {
      return aiService.getBrokerHoldings(userId);
    }
    throw new Error(`Live broker integration for ${conn.brokerName} is not yet available`);
  },
};
