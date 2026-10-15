import type { TaskStatus } from './task.model.js';

export interface StatusState {
  status: TaskStatus;
  completedAt: Date | null;
}

/**
 * `completedAt` é preenchido ao concluir e limpo ao sair de "completed".
 * Manter o status atual preserva a data original de conclusão.
 */
export function applyStatusChange(current: StatusState, next: TaskStatus, now: Date): StatusState {
  if (next === current.status) return current;
  return { status: next, completedAt: next === 'completed' ? now : null };
}

export function initialStatusState(status: TaskStatus, now: Date): StatusState {
  return { status, completedAt: status === 'completed' ? now : null };
}
