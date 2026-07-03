import { Router } from 'express';
import { analyseStock, listRecentSetups } from './analysis.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { stockAnalysisSchema } from './analysis.schema';

export const analysisRouter = Router();

analysisRouter.use(authenticate);
analysisRouter.post('/stock',  validate(stockAnalysisSchema), analyseStock);
analysisRouter.get('/recent',  listRecentSetups);
