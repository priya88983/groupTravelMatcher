import { Router } from 'express';
import * as ctrl from '../controllers/hotelController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.get('/:groupId/hotels', ctrl.listOptions);
router.get('/:groupId/hotel-plan', ctrl.getPlan);
router.post('/:groupId/hotel-plan', ctrl.saveSelection);
router.patch('/:groupId/hotel-plan/:selectionId', ctrl.updateSelection);
router.delete('/:groupId/hotel-plan/:selectionId', ctrl.removeSelection);

export default router;
