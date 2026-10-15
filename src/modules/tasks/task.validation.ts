import { z } from 'zod';
import { objectIdSchema } from '../../shared/middlewares/validate.js';
import { TASK_LIMITS, TASK_PRIORITIES, TASK_STATUSES } from './task.model.js';

const tagSchema = z.string().trim().toLowerCase().min(1).max(TASK_LIMITS.tagMax);
const tagsSchema = z
  .array(tagSchema)
  .max(TASK_LIMITS.tagsMax)
  .transform((tags) => [...new Set(tags)]);
const dateTimeSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const title = z.string().trim().min(1).max(TASK_LIMITS.titleMax);
const description = z.string().trim().max(TASK_LIMITS.descriptionMax);

export const createTaskSchema = z.strictObject({
  title,
  description: description.optional(),
  status: z.enum(TASK_STATUSES).default('pending'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  dueDate: dateTimeSchema.optional(),
  tags: tagsSchema.default([]),
});

export const updateTaskSchema = z
  .strictObject({
    title: title.optional(),
    description: description.nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueDate: dateTimeSchema.nullable().optional(),
    tags: tagsSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export const TASK_SORT_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'title', 'priority'] as const;

export const listTasksQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    sortBy: z.enum(TASK_SORT_FIELDS).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().trim().min(1).max(100).optional(),
    tags: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      )
      .pipe(z.array(tagSchema).min(1).max(10))
      .optional(),
    dueBefore: dateTimeSchema.optional(),
    dueAfter: dateTimeSchema.optional(),
  })
  .refine((q) => !q.dueBefore || !q.dueAfter || q.dueAfter <= q.dueBefore, {
    message: 'dueAfter deve ser anterior ou igual a dueBefore.',
    path: ['dueAfter'],
  });

export const taskParamsSchema = z.strictObject({ taskId: objectIdSchema });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
