// Turns the approved, revised agenda into the learner's picture schedule.
// Only ever built from the clean revised agenda, which has no student names or needs.
import type { RevisedLine } from './agenda-checker';

export interface LearnerCard {
  key: string;
  icon: string;
  time: string;
  text: string;
  stillBeingChecked: boolean;
}

const UNCONFIRMED_RE = /[,;]?\s*(?:\(\s*to be confirmed\s*\)|to be confirmed|still being checked)/gi;

const ICONS: Array<[RegExp, string]> = [
  [/\b(?:bus|van|ride|rides)\b/i, '🚌'],
  [/\b(?:restroom|bathroom|toilet)\b/i, '🚻'],
  [/\b(?:lunch|snack|eat)\b/i, '🥪'],
  [/\b(?:samples?|pond study|experiment)\b/i, '🧪'],
  [/\b(?:talk|welcome|presentation)\b/i, '🎤'],
  [/\b(?:walk|route|trail|path|hike|boardwalk)\b/i, '🌿'],
];

function iconFor(text: string): string {
  return ICONS.find(([pattern]) => pattern.test(text))?.[1] ?? '📍';
}

function tidy(text: string): string {
  return text
    .replace(UNCONFIRMED_RE, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.)])/g, '$1')
    .replace(/,\s*$/, '')
    .trim();
}

// Lines meant for adults, not the learner: the "share as a picture schedule" reminder
// (this preview is that schedule) and notes such as what a website says.
function isForAdultsOnly(line: RevisedLine): boolean {
  return line.key === 'added-visual' || /^note:/i.test(line.text);
}

export function buildLearnerPreview(revised: RevisedLine[]): LearnerCard[] {
  return revised
    .filter((line) => !isForAdultsOnly(line))
    .map((line) => {
      UNCONFIRMED_RE.lastIndex = 0;
      const stillBeingChecked = UNCONFIRMED_RE.test(line.text);
      return {
        key: line.key,
        icon: iconFor(line.text),
        time: line.time,
        text: tidy(line.text),
        stillBeingChecked,
      };
    });
}
