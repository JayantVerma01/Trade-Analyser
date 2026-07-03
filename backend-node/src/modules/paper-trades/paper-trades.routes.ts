import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { paperTradesController as c } from './paper-trades.controller';

const router = Router();
router.use(authenticate);

router.get('/',             c.list);
router.post('/',            c.open);
router.get('/:id',          c.getOne);
router.patch('/:id/activate', c.activate);
router.patch('/:id/close',  c.close);
router.patch('/:id/cancel', c.cancel);
router.delete('/:id',       c.delete);

export default router;
