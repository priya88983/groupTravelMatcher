import { Router } from 'express';
import * as ctrl from '../controllers/groupController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/', authenticate, ctrl.search);

export default router;
