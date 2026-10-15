import type { RequestHandler } from 'express';
import { getAuth } from '../../shared/middlewares/authenticate.js';
import { taskService } from './task.service.js';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from './task.validation.js';

type TaskParams = { taskId: string };

const create: RequestHandler = async (req, res) => {
  const task = await taskService.create(getAuth(req).userId, req.body as CreateTaskInput);
  res.status(201).json({ success: true, data: task });
};

const list: RequestHandler = async (req, res) => {
  const { items, meta } = await taskService.list(
    getAuth(req).userId,
    req.query as unknown as ListTasksQuery,
  );
  res.status(200).json({ success: true, data: items, meta });
};

const getById: RequestHandler<TaskParams> = async (req, res) => {
  const task = await taskService.getById(getAuth(req).userId, req.params.taskId);
  res.status(200).json({ success: true, data: task });
};

const update: RequestHandler<TaskParams> = async (req, res) => {
  const task = await taskService.update(
    getAuth(req).userId,
    req.params.taskId,
    req.body as UpdateTaskInput,
  );
  res.status(200).json({ success: true, data: task });
};

const remove: RequestHandler<TaskParams> = async (req, res) => {
  await taskService.delete(getAuth(req).userId, req.params.taskId);
  res.status(204).end();
};

export const taskController = { create, list, getById, update, remove };
