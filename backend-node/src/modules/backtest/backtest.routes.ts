import { Router }            from 'express';
import { authenticate }       from '../../middleware/auth.middleware';
import { backtestController } from './backtest.controller';

const router = Router();
router.use(authenticate);

router.get('/',      backtestController.list);
router.post('/run',  backtestController.run);
router.get('/:id',   backtestController.getOne);
router.delete('/:id',backtestController.delete);

export default router;
