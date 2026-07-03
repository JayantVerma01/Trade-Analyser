import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { brokerController as c } from './broker.controller';

const router = Router();
router.use(authenticate);

router.get('/connections',        c.list);
router.post('/connections',       c.connect);
router.delete('/connections/:id', c.disconnect);

router.get('/account',   c.getAccount);
router.get('/positions', c.getPositions);
router.get('/orders',    c.getOrders);
router.get('/holdings',  c.getHoldings);

export default router;
