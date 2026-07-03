import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { journalController as c } from './journal.controller';

const router = Router();
router.use(authenticate);

router.get('/stats', c.stats);
router.get('/',       c.list);
router.post('/',      c.create);
router.get('/:id',    c.getOne);
router.put('/:id',    c.update);
router.delete('/:id', c.delete);

export default router;
