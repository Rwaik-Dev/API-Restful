import { describe, expect, it } from 'vitest';
import { applyStatusChange, initialStatusState } from '../../src/modules/tasks/task.rules.js';

const now = new Date('2026-10-15T12:00:00.000Z');
const earlier = new Date('2026-10-01T12:00:00.000Z');

describe('task status rules', () => {
  it('sets completedAt on creation only when created as completed', () => {
    expect(initialStatusState('pending', now)).toEqual({ status: 'pending', completedAt: null });
    expect(initialStatusState('completed', now)).toEqual({ status: 'completed', completedAt: now });
  });

  it.each(['pending', 'in_progress'] as const)(
    'fills completedAt when moving from %s to completed',
    (from) => {
      expect(applyStatusChange({ status: from, completedAt: null }, 'completed', now)).toEqual({
        status: 'completed',
        completedAt: now,
      });
    },
  );

  it.each(['pending', 'in_progress'] as const)('clears completedAt when reopening to %s', (to) => {
    expect(applyStatusChange({ status: 'completed', completedAt: earlier }, to, now)).toEqual({
      status: to,
      completedAt: null,
    });
  });

  it('keeps the original completedAt when status does not change', () => {
    const state = { status: 'completed' as const, completedAt: earlier };
    expect(applyStatusChange(state, 'completed', now)).toBe(state);
  });

  it('moves between pending and in_progress without completedAt', () => {
    expect(applyStatusChange({ status: 'pending', completedAt: null }, 'in_progress', now)).toEqual(
      {
        status: 'in_progress',
        completedAt: null,
      },
    );
  });
});
