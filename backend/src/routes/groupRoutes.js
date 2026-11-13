import { Router } from 'express';
import * as ctrl from '../controllers/groupController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.post('/', ctrl.create);
router.get('/', ctrl.list);
router.get('/:groupId', ctrl.detail);

export default router;
