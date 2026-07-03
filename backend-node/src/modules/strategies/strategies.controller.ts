import type { Request, Response, NextFunction } from 'express';
import { strategiesService } from './strategies.service';
import {
  createStrategySchema,
  updateStrategySchema,
  evaluateStrategySchema,
  scanStrategySchema,
} from './strategies.schema';

export const strategiesController = {

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await strategiesService.list(req.user!.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await strategiesService.getOne(req.params.id, req.user!.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createStrategySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await strategiesService.create(req.user!.id, parsed.data);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateStrategySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await strategiesService.update(req.params.id, req.user!.id, parsed.data);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await strategiesService.delete(req.params.id, req.user!.id);
      res.json({ success: true, message: 'Strategy deleted' });
    } catch (err) { next(err); }
  },

  async evaluate(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = evaluateStrategySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await strategiesService.evaluate(
        req.params.id, req.user!.id, parsed.data.symbol, parsed.data.timeframe,
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async scan(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = scanStrategySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await strategiesService.scan(
        req.params.id, req.user!.id, parsed.data.symbols, parsed.data.timeframe,
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getMeta(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await strategiesService.getMeta();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};
