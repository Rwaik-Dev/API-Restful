import { TaskModel, type TaskDocument } from '../../src/modules/tasks/task.model.js';

type TaskOverrides = Partial<{
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: Date;
  tags: string[];
  completedAt: Date | null;
}>;

let counter = 0;

export function createTask(userId: string, overrides: TaskOverrides = {}): Promise<TaskDocument> {
  counter += 1;
  return TaskModel.create({
    userId,
    title: `Task ${counter}`,
    status: 'pending',
    priority: 'medium',
    tags: [],
    completedAt: overrides.status === 'completed' ? new Date() : null,
    ...overrides,
  });
}
