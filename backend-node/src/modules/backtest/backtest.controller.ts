import type { Request, Response, NextFunction } from 'express';
import { runBacktestSchema } from './backtest.schema';
import { backtestService }   from './backtest.service';

export const backtestController = {

  async run(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = runBacktestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await backtestService.run(req.user!.id, parsed.data);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await backtestService.list(req.user!.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await backtestService.getOne(req.params.id, req.user!.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await backtestService.delete(req.params.id, req.user!.id);
      res.json({ success: true, message: 'Backtest deleted' });
    } catch (err) { next(err); }
  },
};
