import type { Request, Response, NextFunction } from 'express';
import { openPaperTradeSchema, closePaperTradeSchema, listPaperTradesSchema } from './paper-trades.schema';
import { paperTradesService } from './paper-trades.service';

export const paperTradesController = {

  async open(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = openPaperTradeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await paperTradesService.open(req.user!.id, parsed.data);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await paperTradesService.activate(req.params.id, req.user!.id);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message === 'Paper trade not found') return res.status(404).json({ success: false, message: err.message });
      if (err.message?.includes('PENDING')) return res.status(400).json({ success: false, message: err.message });
      next(err);
    }
  },

  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = closePaperTradeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await paperTradesService.close(req.params.id, req.user!.id, parsed.data);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message === 'Paper trade not found') return res.status(404).json({ success: false, message: err.message });
      if (err.message?.includes('already closed')) return res.status(400).json({ success: false, message: err.message });
      next(err);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await paperTradesService.cancel(req.params.id, req.user!.id);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message === 'Paper trade not found') return res.status(404).json({ success: false, message: err.message });
      if (err.message?.includes('already closed')) return res.status(400).json({ success: false, message: err.message });
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listPaperTradesSchema.safeParse(req.query);
      const status = parsed.success ? parsed.data.status : undefined;
      const data = await paperTradesService.list(req.user!.id, status);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await paperTradesService.getOne(req.params.id, req.user!.id);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message === 'Paper trade not found') return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await paperTradesService.delete(req.params.id, req.user!.id);
      res.json({ success: true, message: 'Paper trade deleted' });
    } catch (err: any) {
      if (err.message === 'Paper trade not found') return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },
};
