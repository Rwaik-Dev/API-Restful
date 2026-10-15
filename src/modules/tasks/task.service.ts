import { AppError } from '../../shared/errors/AppError.js';
import { toPublicTask, type PublicTask, type TaskDocument } from './task.model.js';
import { taskRepository } from './task.repository.js';
import { applyStatusChange, initialStatusState } from './task.rules.js';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from './task.validation.js';

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

const taskNotFound = (): AppError => AppError.notFound('Tarefa não encontrada.');

async function findOwnedOrFail(userId: string, taskId: string): Promise<TaskDocument> {
  const task = await taskRepository.findOwned(taskId, userId);
  if (!task) throw taskNotFound();
  return task;
}

export const taskService = {
  async create(userId: string, input: CreateTaskInput): Promise<PublicTask> {
    const { status, completedAt } = initialStatusState(input.status, new Date());
    const task = await taskRepository.create({
      userId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueDate: input.dueDate,
      tags: input.tags,
      status,
      completedAt,
    });
    return toPublicTask(task);
  },

  async getById(userId: string, taskId: string): Promise<PublicTask> {
    return toPublicTask(await findOwnedOrFail(userId, taskId));
  },

  async list(
    userId: string,
    query: ListTasksQuery,
  ): Promise<{ items: PublicTask[]; meta: PaginationMeta }> {
    const { items, totalItems } = await taskRepository.list(userId, query);
    return {
      items: items.map(toPublicTask),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  },

  async update(userId: string, taskId: string, input: UpdateTaskInput): Promise<PublicTask> {
    const task = await findOwnedOrFail(userId, taskId);

    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate;
    if (input.tags !== undefined) task.tags = input.tags;
    if (input.status !== undefined) {
      const next = applyStatusChange(
        { status: task.status, completedAt: task.completedAt ?? null },
        input.status,
        new Date(),
      );
      task.status = next.status;
      task.completedAt = next.completedAt;
    }

    await task.save();
    return toPublicTask(task);
  },

  async delete(userId: string, taskId: string): Promise<void> {
    if (!(await taskRepository.deleteOwned(taskId, userId))) throw taskNotFound();
  },
};
