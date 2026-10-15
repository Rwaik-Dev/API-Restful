import type { QueryFilter, SortOrder } from 'mongoose';
import { TaskModel, type Task, type TaskDocument } from './task.model.js';
import type { ListTasksQuery } from './task.validation.js';

export type CreateTaskData = Pick<
  Task,
  'title' | 'status' | 'priority' | 'tags' | 'completedAt'
> & {
  userId: string;
  description?: string | undefined;
  dueDate?: Date | undefined;
};

const sortFieldMap: Record<ListTasksQuery['sortBy'], string> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  dueDate: 'dueDate',
  title: 'title',
  priority: 'priorityRank',
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildListFilter(userId: string, query: ListTasksQuery): QueryFilter<Task> {
  const filter: QueryFilter<Task> = { userId };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.tags) filter.tags = { $all: query.tags };
  if (query.dueBefore || query.dueAfter) {
    filter.dueDate = {
      ...(query.dueAfter ? { $gte: query.dueAfter } : {}),
      ...(query.dueBefore ? { $lte: query.dueBefore } : {}),
    };
  }
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }
  return filter;
}

export const taskRepository = {
  create(data: CreateTaskData): Promise<TaskDocument> {
    return TaskModel.create(data);
  },

  findOwned(id: string, userId: string): Promise<TaskDocument | null> {
    return TaskModel.findOne({ _id: id, userId }).exec();
  },

  async deleteOwned(id: string, userId: string): Promise<boolean> {
    const result = await TaskModel.deleteOne({ _id: id, userId }).exec();
    return result.deletedCount > 0;
  },

  async list(
    userId: string,
    query: ListTasksQuery,
  ): Promise<{ items: TaskDocument[]; totalItems: number }> {
    const filter = buildListFilter(userId, query);
    const direction: SortOrder = query.order === 'asc' ? 1 : -1;
    const [items, totalItems] = await Promise.all([
      TaskModel.find(filter)
        .sort({ [sortFieldMap[query.sortBy]]: direction, _id: direction })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      TaskModel.countDocuments(filter).exec(),
    ]);
    return { items, totalItems };
  },
};
