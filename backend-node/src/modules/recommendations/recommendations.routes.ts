import { Router } from 'express';
import {
  getSectors,
  searchSymbols,
  scanRecommendations,
} from './recommendations.controller';
import { authenticate } from '../../middleware/auth.middleware';

const recommendationsRouter = Router();
recommendationsRouter.use(authenticate);

recommendationsRouter.get('/sectors', getSectors);
recommendationsRouter.get('/search',  searchSymbols);
recommendationsRouter.post('/scan',   scanRecommendations);

export default recommendationsRouter;
