import { Router } from 'express';
import { getRecurring, createRecurring, updateRecurring, deleteRecurring } from '../controllers/recurring.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getRecurring);
router.post('/', createRecurring);
router.put('/:id', updateRecurring);
router.delete('/:id', deleteRecurring);

export default router;
