// Teacher review gate: nothing is shareable until the teacher approves, and any change clears approval.
export type ReviewState = 'not-checked' | 'in-review' | 'approved';

export function startReview(): ReviewState {
  return 'in-review';
}

export function approve(state: ReviewState, blockers: string[]): ReviewState {
  return state === 'in-review' && blockers.length === 0 ? 'approved' : state;
}

// A decision or wording changed: the teacher must approve again.
export function onDecisionChange(state: ReviewState): ReviewState {
  return state === 'approved' ? 'in-review' : state;
}

// The agenda or profiles changed: the old flags no longer apply.
export function onSourceChange(): ReviewState {
  return 'not-checked';
}

export function canShare(state: ReviewState): boolean {
  return state === 'approved';
}
