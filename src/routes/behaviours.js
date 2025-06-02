import { Router } from 'express';
import { list, create, remove } from '../controllers/behaviourController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
const router = Router();

router.get('/',  requireAuth, list);
router.post('/', requireAuth, create);
router.delete('/:id', requireAuth, remove);

export default router;
