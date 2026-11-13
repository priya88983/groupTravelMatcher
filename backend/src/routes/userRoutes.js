import { Router } from 'express';
import * as groupCtrl from '../controllers/groupController.js';
import * as requestCtrl from '../controllers/requestController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);
router.get('/me/groups', groupCtrl.myGroups);
router.get('/me/requests', requestCtrl.profileSummary);

export default router;
