// My operation captain: student check-in, needs introduction, and strategy plan with review gates.
// Pure logic only (no DOM), so every rule here is tested. Nothing is saved or sent.
import { NEEDS, STRATEGY_BANK, type NeedId } from './strategy-bank';
import { SCHEDULE } from './fixtures';

export type Role = 'caregiver' | 'caseManager' | 'teacher' | 'student';
export type Reviewer = 'caregiver' | 'caseManager';
export type YesNo = 'yes' | 'no';

// ---------- Student greeting check-in (learner-directed, every question optional) ----------

export interface CheckInQuestion {
  id: string;
  text: string;
  suggestsNeed?: { need: NeedId; when: YesNo }; // a hint for the caregiver, never applied automatically
}

export const CHECK_IN_QUESTIONS: CheckInQuestion[] = [
  { id: 'ready', text: 'Do you feel ready for school tomorrow?', suggestsNeed: { need: 'overwhelmed', when: 'no' } },
  { id: 'tired', text: 'Do you feel tired today?', suggestsNeed: { need: 'tired', when: 'yes' } },
  { id: 'makeup', text: 'Would you like help with makeup work?', suggestsNeed: { need: 'makeupWork', when: 'yes' } },
  { id: 'askHelp', text: 'Is it hard to ask for help in class?', suggestsNeed: { need: 'askingHelp', when: 'yes' } },
  { id: 'writing', text: 'Is writing by hand hard right now?', suggestsNeed: { need: 'writing', when: 'yes' } },
];

export interface CheckIn {
  answers: Record<string, YesNo>; // missing = skipped
  ownWords: string; // optional, typed or dictated
  shareWithAdults: YesNo | null; // the student decides; null = not decided yet
}

// ---------- Inputs entered by adults ----------

export interface SourceNote {
  source: string;
  text: string;
}

export interface Profile {
  preferredName: string;
  needs: NeedId[];
  restTimes: string; // general only: no medication or test names
  sourceNotes: SourceNote[]; // reviewer-only; never copied into the plan automatically
}

// ---------- Draft plan ----------

export type StrategyStatus = 'proposed' | 'kept' | 'declined';
export type StrategySource = 'bank' | 'caregiver' | 'caseManager' | 'student';

export interface Strategy {
  id: string;
  teacherText: string;
  studentText: string;
  source: StrategySource;
  status: StrategyStatus;
  declineReason: string; // explanation shown to the family when the case manager declines
}

export interface Plan {
  intro: string;
  strategies: Strategy[];
}

export interface TeacherClassState {
  acknowledged: boolean;
  needsConsult: YesNo | null;
  classStrategies: string[]; // teacher's own, for today's objective; only after acknowledgment
}

export interface OutsideRequest {
  id: string;
  requester: string;
  authorizedBy: Record<Reviewer, boolean>;
}

export interface Suggestion {
  target: 'intro' | 'strategy';
  text: string;
  from: 'student';
}

export type Status = 'no-plan' | 'draft' | 'released';

export interface State {
  checkIn: CheckIn;
  profile: Profile;
  status: Status;
  plan: Plan | null;
  approvals: Record<Reviewer, boolean>;
  released: Plan | null; // exact copy teachers and the student may see
  teachers: Record<string, TeacherClassState>;
  suggestions: Suggestion[];
  reworkRequested: boolean; // the student said "this is not working"
  outsideRequests: OutsideRequest[];
}

export interface Flag {
  where: 'name' | 'needs' | 'restTimes' | 'intro' | 'strategies' | 'checkIn';
  message: string;
}

const NO_APPROVALS: Record<Reviewer, boolean> = { caregiver: false, caseManager: false };

// Words that point to medication, tests, or diagnoses. These must stay out of the plan.
const MEDICAL = /\b(mg|mcg|ml|dose|dosage|medication|medicine|meds|pill|pills|tablet|chemo\w*|radiation|diagnos\w*|scan|mri|ct scan|blood test|biopsy|test results?|lab results?|prescri\w*)\b/i;
const UNCERTAIN = /\?|\btbd\b|\bnot sure\b|\bunknown\b|\bmaybe\b/i;

export function containsMedicalDetail(text: string): boolean {
  return MEDICAL.test(text);
}

export function initialState(): State {
  return {
    checkIn: { answers: {}, ownWords: '', shareWithAdults: null },
    profile: { preferredName: '', needs: [], restTimes: '', sourceNotes: [] },
    status: 'no-plan',
    plan: null,
    approvals: { ...NO_APPROVALS },
    released: null,
    teachers: Object.fromEntries(SCHEDULE.map((c) => [c.id, freshTeacher()])),
    suggestions: [],
    reworkRequested: false,
    outsideRequests: [],
  };
}

function freshTeacher(): TeacherClassState {
  return { acknowledged: false, needsConsult: null, classStrategies: [] };
}

// ---------- Check-in ----------

export function answerCheckIn(state: State, questionId: string, answer: YesNo | 'skip'): State {
  const answers = { ...state.checkIn.answers };
  if (answer === 'skip') delete answers[questionId];
  else answers[questionId] = answer;
  return { ...state, checkIn: { ...state.checkIn, answers } };
}

export function setCheckInWords(state: State, words: string): State {
  return { ...state, checkIn: { ...state.checkIn, ownWords: words } };
}

export function setCheckInSharing(state: State, share: YesNo): State {
  const next = { ...state, checkIn: { ...state.checkIn, shareWithAdults: share } };
  // If the student stops sharing, their own words come out of the draft and approvals clear.
  const words = state.checkIn.ownWords.trim();
  if (share === 'no' && state.plan && words && state.plan.intro.includes(words)) {
    const intro = state.plan.intro
      .split('\n')
      .filter((line) => !line.includes(words))
      .join('\n')
      .trimEnd();
    return backToDraft(next, { ...state.plan, intro });
  }
  return next;
}

// What adults may see from the check-in. Nothing unless the student said "yes" to sharing.
export function sharedCheckIn(state: State): CheckIn | null {
  return state.checkIn.shareWithAdults === 'yes' ? state.checkIn : null;
}

// Needs the student's own answers point to. Only hints for the caregiver to accept or ignore.
export function suggestedNeeds(state: State): NeedId[] {
  const shared = sharedCheckIn(state);
  if (!shared) return [];
  const needs: NeedId[] = [];
  for (const q of CHECK_IN_QUESTIONS) {
    if (q.suggestsNeed && shared.answers[q.id] === q.suggestsNeed.when && !needs.includes(q.suggestsNeed.need)) needs.push(q.suggestsNeed.need);
  }
  return needs;
}

// ---------- Profile and checks ----------

export function setProfile(state: State, profile: Partial<Profile>): State {
  const next = { ...state, profile: { ...state.profile, ...profile } };
  return state.status === 'no-plan' ? next : backToDraft(next, next.plan);
}

export function checkProfile(profile: Profile): Flag[] {
  const flags: Flag[] = [];
  if (!profile.preferredName.trim()) flags.push({ where: 'name', message: 'Add the name the student wants teachers to use.' });
  if (profile.needs.length === 0) flags.push({ where: 'needs', message: 'Choose at least one need, or ask the student and family first. The helper will not guess.' });
  if (containsMedicalDetail(profile.restTimes)) flags.push({ where: 'restTimes', message: 'Rest or nurse times mention medication, tests, or a diagnosis. Keep it general, for example "may need rest after lunch".' });
  if (UNCERTAIN.test(profile.restTimes)) flags.push({ where: 'restTimes', message: 'Rest or nurse times look unconfirmed. Please confirm them or leave them out.' });
  return flags;
}

export function checkPlan(plan: Plan): Flag[] {
  const flags: Flag[] = [];
  if (!plan.intro.trim()) flags.push({ where: 'intro', message: 'The introduction is empty.' });
  if (containsMedicalDetail(plan.intro)) flags.push({ where: 'intro', message: 'The introduction mentions medication, tests, or a diagnosis. Remove those details.' });
  for (const s of plan.strategies) {
    if (containsMedicalDetail(s.teacherText) || containsMedicalDetail(s.studentText)) {
      flags.push({ where: 'strategies', message: `A strategy mentions medical details: "${s.teacherText}". Remove those details.` });
    }
  }
  if (plan.strategies.filter((s) => s.status !== 'declined').length === 0) flags.push({ where: 'strategies', message: 'There are no strategies to share.' });
  return flags;
}

// ---------- Drafting ----------

// The introduction uses only what the adults entered and what the student chose to share in their own words.
export function buildIntro(state: State): string {
  const { preferredName, needs, restTimes } = state.profile;
  const name = preferredName.trim();
  const lines = [
    `Hello! This is a short introduction to ${name}, written with ${name} and their family.`,
    `${name} is coming back to school after time away. Things that help to know:`,
    ...NEEDS.filter((n) => needs.includes(n.id)).map((n) => `- ${n.label}.`),
  ];
  if (restTimes.trim()) lines.push(`- Daily routine: ${restTimes.trim()}`);
  const shared = sharedCheckIn(state);
  if (shared?.ownWords.trim()) lines.push('', `In ${name}'s own words: "${shared.ownWords.trim()}"`);
  return lines.join('\n');
}

export function buildStrategies(needs: NeedId[]): Strategy[] {
  return STRATEGY_BANK.filter((b) => needs.includes(b.need)).map((b) => ({
    id: b.id,
    teacherText: b.teacherText,
    studentText: b.studentText,
    source: 'bank',
    status: 'proposed',
    declineReason: '',
  }));
}

export function makePlan(state: State): State {
  if (checkProfile(state.profile).length > 0) return state;
  return backToDraft(state, { intro: buildIntro(state), strategies: buildStrategies(state.profile.needs) });
}

// Any change to the plan or its inputs clears both approvals, withdraws the release, and resets teacher acknowledgments.
function backToDraft(state: State, plan: Plan | null): State {
  return {
    ...state,
    status: plan ? 'draft' : 'no-plan',
    plan: plan ? clonePlan(plan) : null,
    approvals: { ...NO_APPROVALS },
    released: null,
    teachers: Object.fromEntries(SCHEDULE.map((c) => [c.id, freshTeacher()])),
  };
}

function clonePlan(plan: Plan): Plan {
  return { intro: plan.intro, strategies: plan.strategies.map((s) => ({ ...s })) };
}

export function editIntro(state: State, role: Role, intro: string): State {
  if (!state.plan || (role !== 'caregiver' && role !== 'caseManager')) return state;
  return backToDraft(state, { ...state.plan, intro });
}

export function addStrategy(state: State, role: Role, teacherText: string, source: StrategySource = role as StrategySource): State {
  const text = teacherText.trim();
  if (!state.plan || !text || (role !== 'caregiver' && role !== 'caseManager')) return state;
  const strategy: Strategy = { id: `custom-${state.plan.strategies.length + 1}`, teacherText: text, studentText: text, source, status: 'proposed', declineReason: '' };
  return backToDraft(state, { ...state.plan, strategies: [...state.plan.strategies, strategy] });
}

export function editStrategy(state: State, role: Role, id: string, teacherText: string, studentText: string): State {
  if (!state.plan || (role !== 'caregiver' && role !== 'caseManager')) return state;
  const strategies = state.plan.strategies.map((s) => (s.id === id ? { ...s, teacherText, studentText } : s));
  return backToDraft(state, { ...state.plan, strategies });
}

// Only the case manager vets strategies: keep it, or decline it with a reason the family can read.
export function vetStrategy(state: State, role: Role, id: string, decision: 'kept' | 'declined', reason = ''): State {
  if (!state.plan || role !== 'caseManager') return state;
  if (decision === 'declined' && !reason.trim()) return state;
  const strategies = state.plan.strategies.map((s) => (s.id === id ? { ...s, status: decision, declineReason: decision === 'declined' ? reason.trim() : '' } : s));
  return backToDraft(state, { ...state.plan, strategies });
}

// ---------- Approval and release ----------

export function approvalBlockers(state: State, reviewer: Reviewer): string[] {
  if (state.status !== 'draft' || !state.plan) return ['There is no draft to approve.'];
  const blockers = [...checkProfile(state.profile), ...checkPlan(state.plan)].map((f) => f.message);
  if (reviewer === 'caseManager' && state.plan.strategies.some((s) => s.status === 'proposed')) {
    blockers.push('Keep or decline every strategy first.');
  }
  return blockers;
}

export function approve(state: State, role: Role): State {
  if (role !== 'caregiver' && role !== 'caseManager') return state; // teachers and the student cannot approve
  if (approvalBlockers(state, role).length > 0) return state;
  return { ...state, approvals: { ...state.approvals, [role]: true } };
}

export function fullyApproved(state: State): boolean {
  return state.approvals.caregiver && state.approvals.caseManager;
}

// Sharing with teachers and the student needs BOTH the caregiver and the case manager.
export function release(state: State, role: Role): State {
  if (role !== 'caregiver' && role !== 'caseManager') return state;
  if (state.status !== 'draft' || !state.plan || !fullyApproved(state)) return state;
  const released = clonePlan(state.plan);
  released.strategies = released.strategies.filter((s) => s.status === 'kept');
  return { ...state, status: 'released', released, reworkRequested: false };
}

// What teachers and the student may see. Null means show nothing.
export function releasedPlan(state: State): Plan | null {
  if (state.status !== 'released' || !state.released) return null;
  return clonePlan(state.released);
}

// ---------- Teachers ----------

export function acknowledge(state: State, role: Role, classId: string): State {
  if (role !== 'teacher' || !releasedPlan(state) || !state.teachers[classId]) return state;
  return { ...state, teachers: { ...state.teachers, [classId]: { ...state.teachers[classId], acknowledged: true } } };
}

export function setNeedsConsult(state: State, role: Role, classId: string, answer: YesNo): State {
  const t = state.teachers[classId];
  if (role !== 'teacher' || !t?.acknowledged) return state;
  return { ...state, teachers: { ...state.teachers, [classId]: { ...t, needsConsult: answer } } };
}

// No extra teacher interventions until that teacher has acknowledged the plan.
export function addClassStrategy(state: State, role: Role, classId: string, text: string): State {
  const t = state.teachers[classId];
  const clean = text.trim();
  if (role !== 'teacher' || !t?.acknowledged || !clean || containsMedicalDetail(clean)) return state;
  return { ...state, teachers: { ...state.teachers, [classId]: { ...t, classStrategies: [...t.classStrategies, clean] } } };
}

// ---------- Student ----------

export function studentSuggest(state: State, target: 'intro' | 'strategy', text: string): State {
  const clean = text.trim();
  if (!clean) return state;
  return { ...state, suggestions: [...state.suggestions, { target, text: clean, from: 'student' }] };
}

// A reviewer accepts a student suggestion into the draft. This counts as an edit.
export function acceptSuggestion(state: State, role: Role, index: number): State {
  const s = state.suggestions[index];
  if (!s || !state.plan || (role !== 'caregiver' && role !== 'caseManager')) return state;
  const rest = state.suggestions.filter((_, i) => i !== index);
  const next = { ...state, suggestions: rest };
  if (s.target === 'intro') return editIntro(next, role, `${state.plan.intro}\n${state.profile.preferredName || 'The student'} adds: "${s.text}"`);
  return addStrategy(next, role, s.text, 'student');
}

// "This is not working": back to the drawing board. Teachers and the student stop seeing the old plan.
export function studentNotWorking(state: State): State {
  if (state.status !== 'released') return state;
  return { ...backToDraft(state, state.plan), reworkRequested: true };
}

// ---------- Requests from outside (another school, private tutoring) ----------

export function receiveOutsideRequest(state: State, requester: string): State {
  const id = `req-${state.outsideRequests.length + 1}`;
  return { ...state, outsideRequests: [...state.outsideRequests, { id, requester, authorizedBy: { ...NO_APPROVALS } }] };
}

export function authorizeRequest(state: State, role: Role, id: string): State {
  if (role !== 'caregiver' && role !== 'caseManager') return state;
  return {
    ...state,
    outsideRequests: state.outsideRequests.map((r) => (r.id === id ? { ...r, authorizedBy: { ...r.authorizedBy, [role]: true } } : r)),
  };
}

export function requestDecision(request: OutsideRequest): 'blocked' | 'authorized' {
  return request.authorizedBy.caregiver && request.authorizedBy.caseManager ? 'authorized' : 'blocked';
}

// ---------- Handoff (not connected) ----------

// Summary a person could give the learner concierge helper. The prototype does not send it anywhere.
export function conciergeHandoff(state: State): string | null {
  const plan = releasedPlan(state);
  if (!plan) return null;
  const lines = ['For the learner concierge helper (not connected in this prototype):', 'Approved strategies to keep in mind when modifying assignments:'];
  for (const s of plan.strategies) lines.push(`- ${s.teacherText}`);
  lines.push('Modified assignments go to the teacher first.');
  return lines.join('\n');
}
