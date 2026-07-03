import type { Request, Response, NextFunction } from 'express';
import { connectBrokerSchema } from './broker.schema';
import { brokerService }      from './broker.service';

export const brokerController = {

  async connect(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = connectBrokerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await brokerService.connect(req.user!.id, parsed.data);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      if (err.message?.includes('required')) return res.status(400).json({ success: false, message: err.message });
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await brokerService.list(req.user!.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      await brokerService.disconnect(req.params.id, req.user!.id);
      res.json({ success: true, message: 'Broker disconnected' });
    } catch (err: any) {
      if (err.message === 'Broker connection not found') return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },

  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await brokerService.getAccount(req.user!.id);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message?.includes('No active')) return res.status(404).json({ success: false, message: err.message });
      if (err.message?.includes('not yet available')) return res.status(501).json({ success: false, message: err.message });
      next(err);
    }
  },

  async getPositions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await brokerService.getPositions(req.user!.id);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message?.includes('No active')) return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },

  async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await brokerService.getOrders(req.user!.id);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message?.includes('No active')) return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },

  async getHoldings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await brokerService.getHoldings(req.user!.id);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message?.includes('No active')) return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },
};
