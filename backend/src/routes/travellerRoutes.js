import { Router } from 'express';
import * as ctrl from '../controllers/travellerController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);
router.get('/me', ctrl.getMe);
router.put('/me', ctrl.putMe);

export default router;
