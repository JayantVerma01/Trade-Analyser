import type { Request, Response, NextFunction } from 'express';
import { createJournalSchema, updateJournalSchema, listJournalSchema } from './journal.schema';
import { journalService } from './journal.service';

export const journalController = {

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createJournalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await journalService.create(req.user!.id, parsed.data);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      if (err.message === 'Paper trade not found') return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateJournalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await journalService.update(req.params.id, req.user!.id, parsed.data);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message === 'Journal entry not found') return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listJournalSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
      const data = await journalService.list(req.user!.id, parsed.data);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await journalService.getOne(req.params.id, req.user!.id);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message === 'Journal entry not found') return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await journalService.delete(req.params.id, req.user!.id);
      res.json({ success: true, message: 'Journal entry deleted' });
    } catch (err: any) {
      if (err.message === 'Journal entry not found') return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  },

  async stats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await journalService.stats(req.user!.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};
