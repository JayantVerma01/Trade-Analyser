import { Router } from 'express';
import { upload, list, remove, reprocess, seedBuiltin, builtinSeedStatus } from './documents.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { uploadMiddleware } from '../../middleware/upload.middleware';

export const documentsRouter = Router();

documentsRouter.use(authenticate);

// Builtin theory seeding (admin action — authenticated users only)
documentsRouter.post('/seed-builtin', seedBuiltin);
documentsRouter.get('/seed-builtin/status', builtinSeedStatus);

documentsRouter.post('/upload', uploadMiddleware.single('file'), upload);
documentsRouter.get('/', list);
documentsRouter.delete('/:id', remove);
documentsRouter.post('/:id/reprocess', reprocess);
