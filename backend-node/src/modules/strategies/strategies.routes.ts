import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { strategiesController as ctrl } from './strategies.controller';

const router = Router();

router.use(authenticate);

router.get('/',                   ctrl.list);
router.get('/meta',               ctrl.getMeta);
router.get('/:id',                ctrl.getOne);
router.post('/',                  ctrl.create);
router.put('/:id',                ctrl.update);
router.delete('/:id',             ctrl.delete);
router.post('/:id/evaluate',      ctrl.evaluate);
router.post('/:id/scan',          ctrl.scan);

export default router;
