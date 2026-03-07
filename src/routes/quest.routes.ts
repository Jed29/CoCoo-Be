import { Router } from 'express';
import { getActiveQuests } from '../controllers/quest.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getActiveQuests);

export default router;
