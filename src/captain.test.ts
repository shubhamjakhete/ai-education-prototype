import { describe, expect, it } from 'vitest';
import {
  acceptSuggestion,
  acknowledge,
  addClassStrategy,
  answerCheckIn,
  approvalBlockers,
  approve,
  authorizeRequest,
  checkProfile,
  conciergeHandoff,
  editIntro,
  initialState,
  makePlan,
  receiveOutsideRequest,
  release,
  releasedPlan,
  requestDecision,
  setCheckInSharing,
  setCheckInWords,
  setNeedsConsult,
  setProfile,
  studentNotWorking,
  studentSuggest,
  suggestedNeeds,
  vetStrategy,
  type State,
} from './captain';
import { EXAMPLE } from './fixtures';

// Fictional setup: caregiver enters the profile, makes the plan.
function drafted(): State {
  let s = setProfile(initialState(), { preferredName: EXAMPLE.preferredName, needs: ['tired', 'writing'], restTimes: EXAMPLE.restTimes });
  s = makePlan(s);
  return s;
}

// Case manager keeps every strategy.
function vetted(s = drafted()): State {
  for (const st of s.plan!.strategies) s = vetStrategy(s, 'caseManager', st.id, 'kept');
  return s;
}

function releasedState(): State {
  let s = vetted();
  s = approve(s, 'caregiver');
  s = approve(s, 'caseManager');
  return release(s, 'caseManager');
}

describe('student greeting check-in (learner-directed)', () => {
  it('adults see nothing from the check-in unless the student says yes to sharing', () => {
    let s = answerCheckIn(initialState(), 'tired', 'yes');
    s = setCheckInWords(s, 'I like math.');
    expect(suggestedNeeds(s)).toEqual([]);
    s = setCheckInSharing(s, 'no');
    expect(suggestedNeeds(s)).toEqual([]);
    s = setCheckInSharing(s, 'yes');
    expect(suggestedNeeds(s)).toEqual(['tired']);
  });

  it('check-in answers only suggest needs; they are never added to the profile automatically', () => {
    let s = answerCheckIn(initialState(), 'askHelp', 'yes');
    s = setCheckInSharing(s, 'yes');
    expect(suggestedNeeds(s)).toEqual(['askingHelp']);
    expect(s.profile.needs).toEqual([]);
  });

  it('skipping a question removes the answer', () => {
    let s = answerCheckIn(initialState(), 'tired', 'yes');
    s = answerCheckIn(s, 'tired', 'skip');
    expect(s.checkIn.answers).toEqual({});
  });

  it('shared own words appear in the intro; withdrawing sharing removes them and clears approval', () => {
    let s = setCheckInWords(initialState(), 'I like strategy games.');
    s = setCheckInSharing(s, 'yes');
    s = setProfile(s, { preferredName: 'Sam', needs: ['tired'] });
    s = makePlan(s);
    expect(s.plan!.intro).toContain('I like strategy games.');
    s = approve(vetted(s), 'caregiver');
    s = setCheckInSharing(s, 'no');
    expect(s.plan!.intro).not.toContain('I like strategy games.');
    expect(s.approvals.caregiver).toBe(false);
  });
});

describe('expected case: plan made, reviewed by caregiver and case manager, then shared', () => {
  it('builds an intro and strategies only from what the adults chose', () => {
    const s = drafted();
    expect(s.plan!.intro).toContain('Sam is coming back to school');
    expect(s.plan!.intro).toContain('Gets tired');
    expect(s.plan!.intro).not.toContain('overwhelmed');
    expect(s.plan!.strategies.map((x) => x.id)).toEqual(['rest-break', 'hard-work-early', 'typing', 'notes-copy']);
  });

  it('teachers and the student see the plan only after both approve and it is released', () => {
    let s = vetted();
    expect(releasedPlan(s)).toBeNull();
    s = approve(s, 'caregiver');
    expect(releasedPlan(release(s, 'caregiver'))).toBeNull();
    s = approve(s, 'caseManager');
    expect(releasedPlan(s)).toBeNull(); // approval is not release
    s = release(s, 'caseManager');
    expect(releasedPlan(s)!.strategies).toHaveLength(4);
  });

  it('declined strategies are not shared, and the family sees the reason', () => {
    let s = drafted();
    s = vetStrategy(s, 'caseManager', 'hard-work-early', 'declined', 'Test times are set school-wide.');
    for (const st of s.plan!.strategies.filter((x) => x.status === 'proposed')) s = vetStrategy(s, 'caseManager', st.id, 'kept');
    expect(s.plan!.strategies.find((x) => x.id === 'hard-work-early')!.declineReason).toBe('Test times are set school-wide.');
    s = release(approve(approve(s, 'caregiver'), 'caseManager'), 'caregiver');
    expect(releasedPlan(s)!.strategies.map((x) => x.id)).not.toContain('hard-work-early');
  });

  it('the case manager cannot decline without giving a reason', () => {
    const s = vetStrategy(drafted(), 'caseManager', 'typing', 'declined', '  ');
    expect(s.plan!.strategies.find((x) => x.id === 'typing')!.status).toBe('proposed');
  });

  it('outside requests (another school, a private tutoring coach) stay blocked until both authorize', () => {
    let s = receiveOutsideRequest(initialState(), 'Teacher from another school');
    s = receiveOutsideRequest(s, 'Private tutoring coach');
    expect(s.outsideRequests.map(requestDecision)).toEqual(['blocked', 'blocked']);
    s = authorizeRequest(s, 'caregiver', 'req-1');
    expect(requestDecision(s.outsideRequests[0])).toBe('blocked');
    s = authorizeRequest(s, 'teacher', 'req-1');
    expect(requestDecision(s.outsideRequests[0])).toBe('blocked');
    s = authorizeRequest(s, 'caseManager', 'req-1');
    expect(requestDecision(s.outsideRequests[0])).toBe('authorized');
    expect(requestDecision(s.outsideRequests[1])).toBe('blocked');
  });

  it('prepares a concierge handoff only after release', () => {
    expect(conciergeHandoff(vetted())).toBeNull();
    expect(conciergeHandoff(releasedState())).toContain('Modified assignments go to the teacher first.');
  });
});

describe('missing or uncertain information', () => {
  it('asks for a name and needs instead of guessing, and makes no plan', () => {
    const s = makePlan(initialState());
    expect(s.plan).toBeNull();
    expect(checkProfile(s.profile).map((f) => f.where)).toEqual(['name', 'needs']);
  });

  it('flags medication or test names in rest times and blocks the plan', () => {
    const s = setProfile(initialState(), { preferredName: 'Sam', needs: ['tired'], restTimes: 'Takes 5 mg medication at noon' });
    expect(checkProfile(s.profile).map((f) => f.where)).toContain('restTimes');
    expect(makePlan(s).plan).toBeNull();
  });

  it('flags unconfirmed rest times', () => {
    const s = setProfile(initialState(), { preferredName: 'Sam', needs: ['tired'], restTimes: 'Nurse at 11:30?' });
    expect(checkProfile(s.profile).map((f) => f.where)).toEqual(['restTimes']);
  });

  it('blocks approval if a reviewer adds medical details to the intro', () => {
    let s = vetted();
    s = editIntro(s, 'caregiver', `${s.plan!.intro}\nHad a blood test on Friday.`);
    expect(approvalBlockers(s, 'caregiver').join(' ')).toMatch(/medication, tests, or a diagnosis/);
    expect(approve(s, 'caregiver').approvals.caregiver).toBe(false);
  });

  it('the case manager cannot approve until every strategy is kept or declined', () => {
    expect(approve(drafted(), 'caseManager').approvals.caseManager).toBe(false);
  });
});

describe('must never: share without caregiver AND case manager authorization', () => {
  it('nothing is visible to teachers or the student before release', () => {
    expect(releasedPlan(initialState())).toBeNull();
    expect(releasedPlan(drafted())).toBeNull();
    expect(releasedPlan(release(vetted(), 'caregiver'))).toBeNull();
  });

  it('teachers and the student cannot approve or release', () => {
    let s = vetted();
    s = approve(approve(s, 'teacher'), 'student');
    expect(s.approvals).toEqual({ caregiver: false, caseManager: false });
    s = release(approve(approve(s, 'caregiver'), 'caseManager'), 'teacher');
    expect(releasedPlan(s)).toBeNull();
  });

  it('any edit after release clears both approvals and hides the plan again', () => {
    let s = releasedState();
    s = editIntro(s, 'caregiver', `${s.plan!.intro}\nLikes strategy games.`);
    expect(s.approvals).toEqual({ caregiver: false, caseManager: false });
    expect(releasedPlan(s)).toBeNull();
  });

  it('changing the profile after release also withdraws the plan', () => {
    const s = setProfile(releasedState(), { needs: ['tired'] });
    expect(releasedPlan(s)).toBeNull();
  });
});

describe('must never: extra teacher interventions without the teacher acknowledging', () => {
  it('a teacher cannot add class strategies before acknowledging', () => {
    let s = releasedState();
    s = addClassStrategy(s, 'teacher', 'math', 'Use fraction tiles today.');
    expect(s.teachers.math.classStrategies).toEqual([]);
    s = acknowledge(s, 'teacher', 'math');
    s = addClassStrategy(s, 'teacher', 'math', 'Use fraction tiles today.');
    expect(s.teachers.math.classStrategies).toEqual(['Use fraction tiles today.']);
    expect(s.teachers.english.classStrategies).toEqual([]);
  });

  it('a teacher cannot acknowledge an unreleased plan', () => {
    expect(acknowledge(vetted(), 'teacher', 'math').teachers.math.acknowledged).toBe(false);
  });

  it('a teacher can say whether they need a consult, only after acknowledging', () => {
    let s = releasedState();
    expect(setNeedsConsult(s, 'teacher', 'math', 'yes').teachers.math.needsConsult).toBeNull();
    s = setNeedsConsult(acknowledge(s, 'teacher', 'math'), 'teacher', 'math', 'yes');
    expect(s.teachers.math.needsConsult).toBe('yes');
  });

  it('teacher class strategies with medical details are refused', () => {
    const s = addClassStrategy(acknowledge(releasedState(), 'teacher', 'math'), 'teacher', 'math', 'Check dosage before class');
    expect(s.teachers.math.classStrategies).toEqual([]);
  });
});

describe('student: add to the plan, and go back to the drawing board if it is not working', () => {
  it('student suggestions go to the reviewers and change nothing until accepted', () => {
    let s = studentSuggest(releasedState(), 'strategy', 'Let me sit near the door.');
    expect(releasedPlan(s)!.strategies.map((x) => x.teacherText)).not.toContain('Let me sit near the door.');
    s = acceptSuggestion(s, 'caregiver', 0);
    expect(s.plan!.strategies.at(-1)).toMatchObject({ teacherText: 'Let me sit near the door.', source: 'student', status: 'proposed' });
    expect(releasedPlan(s)).toBeNull(); // accepting is an edit, so it needs review again
  });

  it('a teacher cannot accept student suggestions', () => {
    const s = studentSuggest(releasedState(), 'intro', 'I like math.');
    expect(acceptSuggestion(s, 'teacher', 0).suggestions).toHaveLength(1);
  });

  it('"This is not working" withdraws the plan from everyone and flags it for rework', () => {
    let s = acknowledge(releasedState(), 'teacher', 'math');
    s = studentNotWorking(s);
    expect(s.reworkRequested).toBe(true);
    expect(releasedPlan(s)).toBeNull();
    expect(s.teachers.math.acknowledged).toBe(false);
    expect(s.plan).not.toBeNull(); // the draft stays for the adults to rework with the student
  });
});
