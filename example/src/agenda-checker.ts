// Checks a made-up field trip agenda against made-up student profiles.
// Rule-based on purpose: predictable, offline, and every flag can be traced to a rule.
// Nothing here changes the agenda on its own; changes only apply once the teacher accepts them.

export type NeedTag = 'step-free' | 'lift-transport' | 'noise' | 'transition-time' | 'visual-info';

export const NEED_LABELS: Record<NeedTag, string> = {
  'step-free': 'step-free access',
  'lift-transport': 'transport with a lift',
  noise: 'quieter spaces',
  'transition-time': 'extra time between activities',
  'visual-info': 'pictures and maps',
};

export interface ProfileLine {
  need: NeedTag | null;
  text: string;
  shared: 'Yes' | 'No';
}

export interface StudentProfile {
  id: string;
  name: string;
  familyAgreed: boolean;
  lines: ProfileLine[];
}

export interface AgendaItem {
  id: string;
  time: string;
  minutes: number | null;
  text: string;
}

export interface Agenda {
  title: string;
  items: AgendaItem[];
}

export type FlagKind = 'likely-barrier' | 'needs-checking';

export type ChangePosition = 'start' | 'end' | { after: string };

export type Change =
  | { type: 'replace'; text: string }
  | { type: 'note'; text: string }
  | { type: 'add-item'; text: string; position: ChangePosition };

export interface AffectedNeed {
  studentId: string;
  studentName: string;
  need: NeedTag;
}

export interface Flag {
  id: string;
  itemId: string | null;
  kind: FlagKind;
  affects: AffectedNeed[];
  reason: string;
  change: Change;
  question: string | null;
}

export interface LanguageFlag {
  itemId: string | null;
  word: string;
}

export interface CheckResult {
  agenda: Agenda;
  flags: Flag[];
  languageFlags: LanguageFlag[];
  studentsChecked: number;
}

export type DecisionStatus = 'pending' | 'accepted' | 'rejected';

export interface Decision {
  status: DecisionStatus;
  text: string;
}

export type Decisions = Record<string, Decision>;

export interface RevisedLine {
  key: string;
  time: string;
  text: string;
  status: 'unchanged' | 'changed' | 'added';
  originalText?: string;
}

export const TO_CONFIRM = '(to be confirmed)';

const TIME_RE = /^(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)(?:\s*[-–—:]\s*|\s+)(.+)$/i;
const SEPARATION_RE = /\b(?:wait(?:s|ing)?\s+(?:here|at|by|on|in|with)|sit(?:s|ting)?\s+out|stay(?:s|ing)?\s+behind|separate\s+(?:van|bus|car|activity|room)|instead\s+of\s+joining)\b/i;
const STEPS_RE = /(?:\b(?:down|up|via|by|using|over|with)\s+)?(?:the\s+)?\b(?:steps|stairs|staircase|stairway)\b/i;
const ROUGH_RE = /\b(?:hike|hiking|steep|rocky|uneven|muddy|gravel)\b/i;
const TRANSPORT_RE = /\b(?:bus|coach|shuttle)\b/i;
const NO_LIFT_RE = /\b(?:no\s+lift|without\s+(?:a\s+)?lift|no\s+wheelchair\s+lift)\b/i;
const HAS_LIFT_RE = /\b(?:lift|ramp)\b/i;
const VAGUE_RE = /\b(?:mostly|partly|partially|somewhat)\s+(?:wheelchair[-\s])?accessible\b|\blimited\s+access\b|\baccessible\s+in\s+(?:most|some)\s+areas\b/i;
const NOISE_RE = /\b(?:assembly|loud|amphitheat(?:er|re)|auditorium|whistles?|music|crowd(?:ed|s)?|other\s+school\s+groups)\b/i;
const RUSH_RE = /\b(?:quick(?:ly)?|rush|hurry|immediately)\b/i;
const RESTROOM_RE = /\b(?:restrooms?|bathrooms?|toilets?|washrooms?)\b/i;
const VISUAL_RE = /\b(?:picture|visual|map)s?\b/i;
const ARRIVAL_RE = /\b(?:arriv\w*|welcome)\b/i;

export const FLAGGED_WORDS = ['confined', 'wheelchair-bound', "can't", 'sit out', 'wait here'];

function wordPattern(word: string): RegExp {
  const escaped = word
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace("'", "['’]")
    .replace(/[-\s]/g, '[-\\s]');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

export function findFlaggedWords(text: string): string[] {
  return FLAGGED_WORDS.filter((word) => wordPattern(word).test(text));
}

function toMinutes(time: string): number | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*([ap])?/i.exec(time);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'p' && hours < 12) hours += 12;
  if (meridiem === 'a' && hours === 12) hours = 0;
  // Without am/pm, treat 1-6 as afternoon: school trips don't start before 7.
  if (!meridiem && hours >= 1 && hours <= 6) hours += 12;
  return hours * 60 + minutes;
}

export function parseAgenda(text: string): Agenda {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('Paste or upload an agenda before checking it.');
  }

  let title = '';
  if (!TIME_RE.test(lines[0]) && lines.length > 1) {
    title = lines.shift()!;
  }

  const items = lines.map((line, index): AgendaItem => {
    const match = TIME_RE.exec(line);
    const time = match ? match[1].trim() : '';
    return {
      id: `item-${index + 1}`,
      time,
      minutes: time ? toMinutes(time) : null,
      text: match ? match[2].trim() : line,
    };
  });

  return { title, items };
}

function studentsWithNeed(profiles: StudentProfile[], need: NeedTag): AffectedNeed[] {
  return profiles
    .filter((profile) => profile.familyAgreed)
    .filter((profile) => profile.lines.some((line) => line.shared === 'Yes' && line.need === need))
    .map((profile) => ({ studentId: profile.id, studentName: profile.name, need }));
}

function mentionsName(text: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`, 'i').test(text);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Rewrites a line that separates a student so the whole class stays together.
// Drops any clause that names a student or describes the separation.
export function keepClassTogether(text: string, names: string[]): string {
  if (/\bseparate\s+(?:van|bus|car)\b/i.test(text)) {
    return `Whole class rides together on one lift-equipped bus ${TO_CONFIRM}`;
  }
  const kept = text
    .split(/\s*(?:;|,|\bwhile\b)\s*/i)
    .filter(Boolean)
    .filter((clause) => !SEPARATION_RE.test(clause) && !names.some((name) => mentionsName(clause, name)));
  if (kept.length === 0) {
    return `Whole class does this activity together at a spot everyone can reach ${TO_CONFIRM}`;
  }
  return `${capitalize(kept.join(', '))}, all together at a step-free spot ${TO_CONFIRM}`;
}

function stepFreeRoute(text: string): string {
  return text.replace(STEPS_RE, `by a step-free route ${TO_CONFIRM}`);
}

function describeItem(item: AgendaItem): string {
  return item.time ? `${item.time} ${item.text}` : item.text;
}

export function checkAgenda(agenda: Agenda, profiles: StudentProfile[]): CheckResult {
  const flags: Flag[] = [];
  const languageFlags: LanguageFlag[] = [];
  const allNames = profiles.map((profile) => profile.name);
  const stepFree = studentsWithNeed(profiles, 'step-free');
  const lift = studentsWithNeed(profiles, 'lift-transport');
  const noise = studentsWithNeed(profiles, 'noise');
  const transition = studentsWithNeed(profiles, 'transition-time');
  const visual = studentsWithNeed(profiles, 'visual-info');

  for (const word of findFlaggedWords(agenda.title)) {
    languageFlags.push({ itemId: null, word });
  }

  agenda.items.forEach((item, index) => {
    const text = item.text;
    let separated = false;

    for (const word of findFlaggedWords(text)) {
      languageFlags.push({ itemId: item.id, word });
    }

    if (SEPARATION_RE.test(text)) {
      separated = true;
      const named = profiles.filter((profile) => profile.familyAgreed && mentionsName(text, profile.name));
      const affects = named.length > 0
        ? named.flatMap((profile) => stepFree.concat(lift).filter((entry) => entry.studentId === profile.id).slice(0, 1))
        : stepFree;
      flags.push({
        id: `together-${item.id}`,
        itemId: item.id,
        kind: 'likely-barrier',
        affects,
        reason: 'This plan separates a student from the class. Change it so everyone does the activity together.',
        change: { type: 'replace', text: keepClassTogether(text, allNames) },
        question: `Where can the whole class do this together, with a step-free way in? ("${describeItem(item)}")`,
      });
    }

    if (!separated && stepFree.length > 0 && STEPS_RE.test(text)) {
      flags.push({
        id: `steps-${item.id}`,
        itemId: item.id,
        kind: 'likely-barrier',
        affects: stepFree,
        reason: 'Steps on this route block anyone who needs step-free access.',
        change: { type: 'replace', text: stepFreeRoute(text) },
        question: `Is there a step-free route for "${describeItem(item)}"? What is the surface and how far is it?`,
      });
    } else if (stepFree.length > 0 && ROUGH_RE.test(text)) {
      flags.push({
        id: `route-${item.id}`,
        itemId: item.id,
        kind: 'needs-checking',
        affects: stepFree,
        reason: "The agenda doesn't say whether this route is step-free or firm enough for wheels.",
        change: { type: 'note', text: '(step-free, firm route to be confirmed)' },
        question: `Is the route for "${describeItem(item)}" step-free, and what is the surface like?`,
      });
    }

    if (!separated && lift.length > 0 && TRANSPORT_RE.test(text)) {
      if (NO_LIFT_RE.test(text)) {
        flags.push({
          id: `bus-${item.id}`,
          itemId: item.id,
          kind: 'likely-barrier',
          affects: lift,
          reason: 'A bus without a lift means some students would have to travel separately.',
          change: { type: 'note', text: '(book a lift-equipped bus so the whole class rides together; to be confirmed)' },
          question: 'Can transportation provide a lift-equipped bus for the whole class?',
        });
      } else if (!HAS_LIFT_RE.test(text)) {
        flags.push({
          id: `bus-${item.id}`,
          itemId: item.id,
          kind: 'needs-checking',
          affects: lift,
          reason: "The agenda doesn't say whether the bus has a working lift.",
          change: { type: 'note', text: '(lift-equipped bus for the whole class, to be confirmed)' },
          question: `Does the bus for "${describeItem(item)}" have a working wheelchair lift?`,
        });
      }
    }

    const vague = VAGUE_RE.exec(text);
    if (vague && stepFree.length > 0) {
      flags.push({
        id: `vague-${item.id}`,
        itemId: item.id,
        kind: 'needs-checking',
        affects: stepFree,
        reason: `"${vague[0]}" doesn't say which paths, buildings or restrooms are step-free.`,
        change: { type: 'note', text: '(which areas are step-free is still being checked)' },
        question: `The site says "${vague[0]}". Which paths, buildings and restrooms are step-free?`,
      });
    }

    if (noise.length > 0 && NOISE_RE.test(text)) {
      flags.push({
        id: `noise-${item.id}`,
        itemId: item.id,
        kind: 'needs-checking',
        affects: noise,
        reason: 'This activity may be loud or crowded.',
        change: { type: 'note', text: '(ear defenders available for anyone who wants them; class sits at the edge of the group)' },
        question: `How many people will be at "${describeItem(item)}", and is there a quieter spot nearby?`,
      });
    }

    const next = agenda.items[index + 1];
    const tightGap = item.minutes !== null && next?.minutes != null && next.minutes - item.minutes <= 10;
    if (transition.length > 0 && (tightGap || RUSH_RE.test(text))) {
      flags.push({
        id: `transition-${item.id}`,
        itemId: item.id,
        kind: 'needs-checking',
        affects: transition,
        reason: tightGap
          ? `Only ${next!.minutes! - item.minutes!} minutes before the next activity.`
          : 'This step sounds rushed.',
        change: { type: 'note', text: '(allow 10 extra minutes for the class to move to the next stop)' },
        question: null,
      });
    }
  });

  const hasRestroom = agenda.items.some((item) => RESTROOM_RE.test(item.text));
  if (stepFree.length > 0 && !hasRestroom) {
    const arrival = agenda.items.find((item) => ARRIVAL_RE.test(item.text));
    flags.push({
      id: 'restroom',
      itemId: null,
      kind: 'needs-checking',
      affects: stepFree,
      reason: 'The agenda has no restroom stop, so nobody knows where the accessible restroom is.',
      change: {
        type: 'add-item',
        text: `Restroom stop at an accessible restroom ${TO_CONFIRM}`,
        position: arrival ? { after: arrival.id } : 'end',
      },
      question: 'Where is the nearest accessible restroom, and is it on a step-free route?',
    });
  }

  const allText = [agenda.title, ...agenda.items.map((item) => item.text)].join(' ');
  if (visual.length > 0 && !VISUAL_RE.test(allText)) {
    flags.push({
      id: 'visual',
      itemId: null,
      kind: 'likely-barrier',
      affects: visual,
      reason: 'The agenda is text only, which is harder to follow for students who use pictures and maps.',
      change: {
        type: 'add-item',
        text: 'Before the trip: share this agenda with the whole class as a picture schedule with a map of the route',
        position: 'start',
      },
      question: null,
    });
  }

  return {
    agenda,
    flags,
    languageFlags,
    studentsChecked: profiles.filter((profile) => profile.familyAgreed).length,
  };
}

export function initialDecisions(result: CheckResult): Decisions {
  return Object.fromEntries(
    result.flags.map((flag) => [flag.id, { status: 'pending', text: flag.change.text } satisfies Decision]),
  );
}

export function buildRevisedAgenda(result: CheckResult, decisions: Decisions): RevisedLine[] {
  const accepted = result.flags.filter((flag) => decisions[flag.id]?.status === 'accepted');
  const textFor = (flag: Flag) => decisions[flag.id].text.trim();
  const added = (position: (p: ChangePosition) => boolean): RevisedLine[] =>
    accepted
      .filter((flag) => flag.change.type === 'add-item' && position(flag.change.position))
      .map((flag) => ({ key: `added-${flag.id}`, time: '', text: textFor(flag), status: 'added' }));

  const lines: RevisedLine[] = [...added((p) => p === 'start')];

  for (const item of result.agenda.items) {
    const itemFlags = accepted.filter((flag) => flag.itemId === item.id);
    const replacement = itemFlags.filter((flag) => flag.change.type === 'replace').at(-1);
    const notes = itemFlags.filter((flag) => flag.change.type === 'note').map(textFor);
    const text = [replacement ? textFor(replacement) : item.text, ...notes].join(' ');
    const changed = itemFlags.length > 0;
    lines.push({
      key: item.id,
      time: item.time,
      text,
      status: changed ? 'changed' : 'unchanged',
      ...(changed ? { originalText: item.text } : {}),
    });
    lines.push(...added((p) => typeof p === 'object' && p.after === item.id));
  }

  lines.push(...added((p) => p === 'end'));
  return lines;
}

export function approvalBlockers(
  result: CheckResult,
  decisions: Decisions,
  profiles: StudentProfile[],
): string[] {
  const blockers: string[] = [];
  const pending = result.flags.filter((flag) => decisions[flag.id]?.status !== 'accepted' && decisions[flag.id]?.status !== 'rejected');
  if (pending.length > 0) {
    blockers.push(`Accept or reject every flag (${pending.length} still to decide).`);
  }
  if (result.flags.some((flag) => decisions[flag.id]?.status === 'accepted' && !decisions[flag.id].text.trim())) {
    blockers.push('An accepted change has no wording. Add wording or reject it.');
  }

  const revised = buildRevisedAgenda(result, decisions);
  const revisedText = [result.agenda.title, ...revised.map((line) => line.text)].join('\n');
  const names = profiles.map((profile) => profile.name).filter((name) => mentionsName(revisedText, name));
  if (names.length > 0) {
    blockers.push(`The revised agenda names a student (${names.join(', ')}). Remove names before sharing.`);
  }
  const words = findFlaggedWords(revisedText);
  if (words.length > 0) {
    blockers.push(`The revised agenda uses flagged wording: ${words.map((word) => `"${word}"`).join(', ')}.`);
  }
  if (SEPARATION_RE.test(revisedText)) {
    blockers.push('The revised agenda still separates a student from the class.');
  }
  return blockers;
}

export function cleanAgendaText(title: string, revised: RevisedLine[]): string {
  const body = revised.map((line) => (line.time ? `${line.time}  ${line.text}` : line.text));
  const footer = revised.some((line) => /to be confirmed|still being checked/.test(line.text))
    ? ['', 'Anything marked "to be confirmed" or "still being checked" has not been confirmed yet.']
    : [];
  return [...(title ? [title, ''] : []), ...body, ...footer].join('\n');
}
