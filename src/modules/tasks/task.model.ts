import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_LIMITS = {
  titleMax: 200,
  descriptionMax: 2000,
  tagsMax: 20,
  tagMax: 30,
} as const;

const priorityRank: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3 };

const taskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: TASK_LIMITS.titleMax },
    description: { type: String, trim: true, maxlength: TASK_LIMITS.descriptionMax, default: null },
    status: { type: String, enum: TASK_STATUSES, default: 'pending', required: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium', required: true },
    // Permite ordenar por prioridade semântica (low < medium < high) em vez de alfabética.
    priorityRank: { type: Number, required: true, select: false },
    dueDate: { type: Date, default: null },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: TASK_LIMITS.tagMax }],
      default: [],
      validate: {
        validator: (tags: string[]) => tags.length <= TASK_LIMITS.tagsMax,
        message: `Máximo de ${TASK_LIMITS.tagsMax} tags.`,
      },
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.pre('validate', function () {
  this.priorityRank = priorityRank[this.priority];
});

taskSchema.index({ userId: 1, createdAt: -1 });
taskSchema.index({ userId: 1, status: 1, createdAt: -1 });
taskSchema.index({ userId: 1, dueDate: 1 });

export type Task = InferSchemaType<typeof taskSchema>;
export type TaskDocument = HydratedDocument<Task>;

export const TaskModel = model('Task', taskSchema);

export interface PublicTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  tags: string[];
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicTask(task: TaskDocument): PublicTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    tags: [...task.tags],
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
