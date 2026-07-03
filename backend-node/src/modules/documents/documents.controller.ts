import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { aiService } from '../../services/ai.service';
import {
  createDocument,
  getUserDocuments,
  deleteDocument,
  reprocessDocument,
} from './documents.service';

export const upload = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }
  const doc = await createDocument(req.user!.id, req.file);
  sendSuccess(res, doc, 'Document uploaded — processing started', 201);
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const docs = await getUserDocuments(req.user!.id);
  sendSuccess(res, docs);
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await deleteDocument(req.params.id, req.user!.id);
  sendSuccess(res, null, 'Document deleted');
};

export const reprocess = async (req: Request, res: Response): Promise<void> => {
  const doc = await reprocessDocument(req.params.id, req.user!.id);
  sendSuccess(res, doc, 'Reprocessing started');
};

export const seedBuiltin = async (_req: Request, res: Response): Promise<void> => {
  const result = await aiService.seedBuiltinTheories();
  sendSuccess(res, result, `Built-in theory seeded: ${result.chunks_stored} chunks from ${result.theories_count} documents`);
};

export const builtinSeedStatus = async (_req: Request, res: Response): Promise<void> => {
  const result = await aiService.getBuiltinSeedStatus();
  sendSuccess(res, result);
};
