import { Router } from 'express';
import * as ctrl from '../controllers/requestController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.post('/groups/:groupId/requests', ctrl.send);
router.get('/groups/:groupId/requests', ctrl.listForGroup);
router.patch('/requests/:requestId', ctrl.decide);

export default router;
