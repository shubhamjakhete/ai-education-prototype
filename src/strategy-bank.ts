// Fictional strategy bank. The helper only picks from this list; it never writes new strategies itself.
// Each strategy has teacher wording and a plain-language version for the student.

export type NeedId = 'tired' | 'writing' | 'askingHelp' | 'makeupWork' | 'appointments' | 'overwhelmed';

export interface Need {
  id: NeedId;
  label: string; // general wording only; no medical details
}

export interface BankStrategy {
  id: string;
  need: NeedId;
  teacherText: string;
  studentText: string;
}

export const NEEDS: Need[] = [
  { id: 'tired', label: 'Gets tired, especially later in the day' },
  { id: 'writing', label: 'Writing by hand is slow or uncomfortable' },
  { id: 'askingHelp', label: 'Finds it hard to ask for help in class' },
  { id: 'makeupWork', label: 'Has makeup work from time away' },
  { id: 'appointments', label: 'Has regular appointments and will miss some days' },
  { id: 'overwhelmed', label: 'Can feel overwhelmed by a lot of new information at once' },
];

export const STRATEGY_BANK: BankStrategy[] = [
  { id: 'rest-break', need: 'tired', teacherText: 'Allow a short rest break when the student asks, with no need to explain why.', studentText: 'You can ask for a short break. You do not have to say why.' },
  { id: 'hard-work-early', need: 'tired', teacherText: 'Where possible, schedule tests and heavy tasks earlier in the day.', studentText: 'Big tasks will be earlier in the day when possible.' },
  { id: 'typing', need: 'writing', teacherText: 'Accept typed or spoken answers instead of handwriting.', studentText: 'You can type or say your answers instead of writing by hand.' },
  { id: 'notes-copy', need: 'writing', teacherText: 'Share a copy of class notes or slides.', studentText: 'You can get a copy of the class notes.' },
  { id: 'private-signal', need: 'askingHelp', teacherText: 'Agree on a private signal the student can use to ask for help.', studentText: 'You and your teacher can agree on a private sign for "I need help".' },
  { id: 'check-in', need: 'askingHelp', teacherText: 'Check in briefly and privately with the student once per class.', studentText: 'Your teacher will check in with you quietly once per class.' },
  { id: 'priority-list', need: 'makeupWork', teacherText: 'Give a short, prioritized list of makeup work: what is essential and what can be skipped.', studentText: 'You will get a short list of the makeup work that matters most.' },
  { id: 'extended-time', need: 'makeupWork', teacherText: 'Agree on flexible due dates for makeup work.', studentText: 'Makeup work can have flexible due dates.' },
  { id: 'missed-class-pack', need: 'appointments', teacherText: 'Post materials for missed days in one agreed place.', studentText: 'Work from days you miss will be in one place you can find.' },
  { id: 'one-step', need: 'overwhelmed', teacherText: 'Give instructions one step at a time, with a written checklist.', studentText: 'Instructions will come one step at a time, with a checklist.' },
  { id: 'preview', need: 'overwhelmed', teacherText: 'Share a short preview of what the class will cover that day.', studentText: 'You can see what class is about before it starts.' },
];
