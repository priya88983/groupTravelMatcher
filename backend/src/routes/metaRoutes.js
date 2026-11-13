import { Router } from 'express';
import * as ctrl from '../controllers/metaController.js';

const router = Router();

router.get('/interests', ctrl.getInterests);

export default router;
