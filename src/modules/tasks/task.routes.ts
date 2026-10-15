import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { validate } from '../../shared/middlewares/validate.js';
import { taskController } from './task.controller.js';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskParamsSchema,
  updateTaskSchema,
} from './task.validation.js';

export function createTaskRouter(): Router {
  const router = Router();

  router.use(authenticate);
  router.post('/', validate({ body: createTaskSchema }), taskController.create);
  router.get('/', validate({ query: listTasksQuerySchema }), taskController.list);
  router.get('/:taskId', validate({ params: taskParamsSchema }), taskController.getById);
  router.patch(
    '/:taskId',
    validate({ params: taskParamsSchema, body: updateTaskSchema }),
    taskController.update,
  );
  router.delete('/:taskId', validate({ params: taskParamsSchema }), taskController.remove);

  return router;
}
