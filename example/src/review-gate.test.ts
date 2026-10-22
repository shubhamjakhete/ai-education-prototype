import { describe, expect, it } from 'vitest';
import { approve, canShare, onDecisionChange, onSourceChange, startReview } from './review-gate';

describe('teacher review gate', () => {
  it('shares nothing until the teacher approves with no blockers left', () => {
    const state = startReview();
    expect(canShare(state)).toBe(false);
    expect(canShare(approve(state, ['Accept or reject every flag']))).toBe(false);
    expect(canShare(approve(state, []))).toBe(true);
  });

  it('cannot approve before the agenda has been checked', () => {
    expect(approve('not-checked', [])).toBe('not-checked');
  });

  it('clears approval when a decision or wording changes', () => {
    const approved = approve(startReview(), []);
    expect(onDecisionChange(approved)).toBe('in-review');
    expect(canShare(onDecisionChange(approved))).toBe(false);
  });

  it('starts over when the agenda or profiles change', () => {
    expect(onSourceChange()).toBe('not-checked');
    expect(canShare(onSourceChange())).toBe(false);
  });
});
