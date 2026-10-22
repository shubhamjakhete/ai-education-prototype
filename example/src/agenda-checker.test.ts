import { describe, expect, it } from 'vitest';
import {
  approvalBlockers,
  buildRevisedAgenda,
  checkAgenda,
  cleanAgendaText,
  initialDecisions,
  parseAgenda,
  type CheckResult,
  type Decisions,
  type StudentProfile,
} from './agenda-checker';
import { SAMPLE_AGENDA, SAMPLE_PROFILES } from './fixtures';

const profiles: StudentProfile[] = structuredClone(SAMPLE_PROFILES);

function acceptAll(result: CheckResult): Decisions {
  const decisions = initialDecisions(result);
  for (const decision of Object.values(decisions)) decision.status = 'accepted';
  return decisions;
}

function flagFor(result: CheckResult, ruleId: string, itemText: string) {
  const item = result.agenda.items.find((entry) => entry.text.includes(itemText));
  return result.flags.find((flag) => flag.id === `${ruleId}-${item?.id}`);
}

describe('parseAgenda', () => {
  it('reads the title, times and activities', () => {
    const agenda = parseAgenda(SAMPLE_AGENDA);
    expect(agenda.title).toContain('Pond study');
    expect(agenda.items[0]).toMatchObject({ time: '8:30', minutes: 510, text: 'School bus leaves from the front loop' });
    expect(agenda.items.at(-2)).toMatchObject({ time: '1:45', minutes: 13 * 60 + 45 });
    expect(agenda.items.at(-1)?.time).toBe('');
  });

  it('asks for an agenda when the input is empty', () => {
    expect(() => parseAgenda('   \n  ')).toThrow('Paste or upload an agenda');
  });
});

describe('expected case: the example pond study agenda', () => {
  const result = checkAgenda(parseAgenda(SAMPLE_AGENDA), profiles);

  it('flags the steps as a likely barrier for Malia and proposes a step-free route for everyone', () => {
    const steps = flagFor(result, 'steps', 'steps to the pond');
    expect(steps?.kind).toBe('likely-barrier');
    expect(steps?.affects).toEqual([{ studentId: 'malia', studentName: 'Malia', need: 'step-free' }]);
    expect(steps?.change.text).toBe('Walk by a step-free route (to be confirmed) to the pond');
  });

  it('asks whether the bus has a lift instead of assuming it does', () => {
    const bus = flagFor(result, 'bus', 'School bus leaves');
    expect(bus?.kind).toBe('needs-checking');
    expect(bus?.question).toContain('working wheelchair lift');
  });

  it("flags noise for Theo and the tight transition for Sam", () => {
    expect(flagFor(result, 'noise', 'amphitheater')?.affects[0].studentName).toBe('Theo');
    expect(flagFor(result, 'transition', 'steps to the pond')?.affects[0].studentName).toBe('Sam');
  });

  it('changes nothing until the teacher accepts a flag', () => {
    const revised = buildRevisedAgenda(result, initialDecisions(result));
    expect(revised.map((line) => line.text)).toEqual(result.agenda.items.map((item) => item.text));
    expect(revised.every((line) => line.status === 'unchanged')).toBe(true);
  });

  it('applies only the changes the teacher accepted', () => {
    const decisions = initialDecisions(result);
    const steps = flagFor(result, 'steps', 'steps to the pond')!;
    decisions[steps.id].status = 'accepted';
    const revised = buildRevisedAgenda(result, decisions);
    const changed = revised.filter((line) => line.status !== 'unchanged');
    expect(changed).toHaveLength(1);
    expect(changed[0].text).toContain('step-free route');
  });

  it('uses the wording the teacher edited', () => {
    const decisions = initialDecisions(result);
    const steps = flagFor(result, 'steps', 'steps to the pond')!;
    decisions[steps.id] = { status: 'accepted', text: 'Take the boardwalk to the pond together' };
    const revised = buildRevisedAgenda(result, decisions);
    expect(revised.some((line) => line.text === 'Take the boardwalk to the pond together')).toBe(true);
  });
});

describe('missing or uncertain information', () => {
  const result = checkAgenda(parseAgenda(SAMPLE_AGENDA), profiles);

  it('adds a restroom stop to check when the agenda has none', () => {
    const restroom = result.flags.find((flag) => flag.id === 'restroom');
    expect(restroom?.kind).toBe('needs-checking');
    expect(restroom?.change).toMatchObject({ type: 'add-item', text: expect.stringContaining('(to be confirmed)') });
    expect(restroom?.question).toContain('accessible restroom');
  });

  it('treats "mostly accessible" as something to check, never as confirmed', () => {
    const vague = flagFor(result, 'vague', 'mostly accessible');
    expect(vague?.kind).toBe('needs-checking');
    const revised = buildRevisedAgenda(result, acceptAll(result));
    const text = revised.map((line) => line.text).join('\n');
    expect(text).toContain('still being checked');
    expect(text).not.toMatch(/\bis (fully )?accessible\b/i);
  });

  it('says nothing was checked when no family has agreed to share a profile', () => {
    const none = profiles.map((profile) => ({ ...profile, familyAgreed: false }));
    const empty = checkAgenda(parseAgenda(SAMPLE_AGENDA), none);
    expect(empty.studentsChecked).toBe(0);
    expect(empty.flags.every((flag) => flag.id.startsWith('together-'))).toBe(true);
  });
});

describe('must never', () => {
  const result = checkAgenda(parseAgenda(SAMPLE_AGENDA), profiles);

  it('never proposes separating a student, and rewrites the bench line for the whole class', () => {
    const together = flagFor(result, 'together', 'waits at the bench')!;
    expect(together.kind).toBe('likely-barrier');
    expect(together.change.text).toBe('Class collects water samples at the pond edge, all together at a step-free spot (to be confirmed)');
    for (const flag of result.flags) {
      expect(flag.change.text).not.toMatch(/\bwait|sit out|stay behind|separate\b/i);
    }
  });

  it('rewrites a separate van as one lift-equipped bus for the whole class', () => {
    const van = checkAgenda(parseAgenda('8:30 Malia rides in a separate van with her aide'), profiles);
    expect(van.flags[0].change.text).toBe('Whole class rides together on one lift-equipped bus (to be confirmed)');
  });

  it('keeps student names and needs out of the clean revised agenda', () => {
    const decisions = acceptAll(result);
    const clean = cleanAgendaText(result.agenda.title, buildRevisedAgenda(result, decisions));
    for (const profile of profiles) expect(clean).not.toContain(profile.name);
    expect(clean).not.toMatch(/wheelchair|ear defenders for theo|crutches/i);
    expect(approvalBlockers(result, decisions, profiles)).toEqual([]);
  });

  it('blocks approval if the teacher keeps the separating line or types a student name', () => {
    const decisions = acceptAll(result);
    const together = flagFor(result, 'together', 'waits at the bench')!;
    decisions[together.id].status = 'rejected';
    const blockers = approvalBlockers(result, decisions, profiles);
    expect(blockers.join(' ')).toContain('names a student (Malia)');
    expect(blockers.join(' ')).toContain('still separates a student');

    const edited = acceptAll(result);
    edited[flagFor(result, 'steps', 'steps to the pond')!.id].text = 'Walk to the pond; Jordan can sit out';
    const editedBlockers = approvalBlockers(result, edited, profiles).join(' ');
    expect(editedBlockers).toContain('Jordan');
    expect(editedBlockers).toContain('"sit out"');
  });

  it('blocks approval while any flag is undecided', () => {
    expect(approvalBlockers(result, initialDecisions(result), profiles)[0]).toMatch(/still to decide/);
  });

  it('never uses a line marked "No" or a profile the family did not agree to share', () => {
    const custom: StudentProfile[] = [
      { id: 'a', name: 'Ari', familyAgreed: true, lines: [{ need: 'step-free', shared: 'No', text: 'Uses a walker' }] },
      { id: 'b', name: 'Bea', familyAgreed: false, lines: [{ need: 'step-free', shared: 'Yes', text: 'Uses a wheelchair' }] },
    ];
    const check = checkAgenda(parseAgenda('9:45 Walk down the steps to the pond'), custom);
    expect(check.flags).toEqual([]);
  });

  it('flags hurtful wording in the agenda', () => {
    const check = checkAgenda(parseAgenda('10:00 Pond study\n10:30 Students who can’t walk the trail stay at the center'), profiles);
    expect(check.languageFlags.map((flag) => flag.word)).toContain("can't");
  });
});
