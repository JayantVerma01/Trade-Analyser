import { Router } from 'express';
import { authenticate }    from '../../middleware/auth.middleware';
import { agentController } from './agent.controller';

const router = Router();
router.use(authenticate);
router.post('/trade-query', agentController.tradeQuery);

export default router;
