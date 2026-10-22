import { describe, expect, it } from 'vitest';
import { buildRevisedAgenda, checkAgenda, initialDecisions, parseAgenda } from './agenda-checker';
import { SAMPLE_AGENDA, SAMPLE_PROFILES } from './fixtures';
import { buildLearnerPreview } from './learner-preview';

const result = checkAgenda(parseAgenda(SAMPLE_AGENDA), SAMPLE_PROFILES);
const decisions = initialDecisions(result);
for (const decision of Object.values(decisions)) decision.status = 'accepted';
const cards = buildLearnerPreview(buildRevisedAgenda(result, decisions));
const allText = cards.map((card) => card.text).join('\n');

describe('learner preview', () => {
  it('shows the revised agenda, including the whole-class changes', () => {
    expect(allText).toContain('Walk by a step-free route to the pond');
    expect(allText).toContain('Class collects water samples at the pond edge, all together at a step-free spot');
    expect(cards.find((card) => card.text.startsWith('Restroom stop'))?.icon).toBe('🚻');
  });

  it('marks unconfirmed details as still being checked, never as settled', () => {
    const bus = cards.find((card) => card.time === '8:30')!;
    expect(bus.stillBeingChecked).toBe(true);
    expect(bus.text).toBe('School bus leaves from the front loop (lift-equipped bus for the whole class)');
    expect(cards.find((card) => card.text.startsWith('Lunch'))?.stillBeingChecked).toBe(false);
    expect(allText).not.toMatch(/to be confirmed|\(\s*\)/);
  });

  it('leaves out adult-only lines and never names or describes a student', () => {
    expect(allText).not.toMatch(/picture schedule|website|mostly accessible/i);
    for (const profile of SAMPLE_PROFILES) expect(allText).not.toContain(profile.name);
    expect(allText).not.toMatch(/wheelchair|crutches|aide/i);
  });
});
