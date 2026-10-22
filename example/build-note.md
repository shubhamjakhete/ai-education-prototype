# Table build note

> A concise record of the example prototype, not a chat transcript. Fictional students and trip only.

## Overview

- **Table alias:** Example (facilitator demo)
- **Helper name:** Field trip agenda checker
- **Scenario/moment:** Malia, age 9, spina bifida: a pond study field trip two weeks out
- **Note owner:** Workshop facilitator
- **Sharing decision:** Not decided

## Build brief

- **Initial build prompt:** "Read agent-spec.yaml, CLAUDE.md, and templates/build-note.md before coding. First, summarize in plain language: who the helper is for and when it is used; its single job; allowed and prohibited inputs; the learner-profile details it may use; its output and who receives it; the educator/parent reviewer required before the learner sees anything; accessibility needs; and every "must never" rule. Point out anything missing or conflicting and ask only questions that block a safe, useful prototype. Do not start building until I confirm your summary.

After I confirm, build the smallest working local prototype for this helper. Do not add a login, saved data, message sending, or other external side effect. If an accessibility need calls for voice to text, text to voice, or images, follow the Gemini section of CLAUDE.md. The output must be an editable draft shown first in a separate educator/parent review screen; the learner view shows it only after an explicit release, and approval clears if the draft or its inputs change. Implement the stated accessibility needs, but don't claim they work until the learner has tried them.

Add focused tests for the expected case, missing or uncertain information, and at least one "must never" rule, including that the learner can't see output before adult review. Run the tests. Keep build-note.md up to date from the template, using logs/claude-session-log.jsonl for prompts and changed files: summarize, don't copy the chat, and include no names or identifying details. Leave the sharing decision as "Not decided". When done, tell us which files changed, how to run the prototype, the test results, your assumptions, and what still needs testing with the learner. Do most of the coding yourself; pause for our decisions about learner needs, content, and boundaries." Built from `example/agent-spec.yaml`.
- **Later instructions worth preserving:**
  - The helper was redesigned before building: instead of drafting questions for the nature center, the teacher uploads the trip agenda, and the helper flags barriers for several students' profiles and proposes changes, so the demo is more useful to educators.
  - "At the very end of step 3, have a button to show the learner preview so that we can demo what the student would see. Their view should be of the revised and approved agenda."

## Work completed

- **Files created or changed:** `example/package.json`, `index.html`, `tsconfig.json`; `src/agenda-checker.ts` (parsing, rules, revised agenda, approval checks), `src/review-gate.ts`, `src/fixtures.ts` (made-up students and agenda), `src/learner-preview.ts` (picture schedule for the learner), `src/main.ts` (page), `src/style.css`; tests in `src/agenda-checker.test.ts`, `src/review-gate.test.ts` and `src/learner-preview.test.ts`.
- **Prototype run instructions:** In `example/`, run `npm install`, then `npm run dev` and open the address it prints. Press "Load example agenda", then "Check agenda".
- **Tests/checks run and results:** `npm test`: 25 passed (expected case, missing or uncertain information, must-never rules, review gate, learner preview). `npm run build` (type-check and production build): passed. The dev server serves the page; the full flow has not been tried in a browser by a person yet.

## Decisions and learning

- **Group decisions or assumptions:**
  - Checks are rule-based (pattern rules matched against profile needs), not AI-generated: predictable, offline, and within the current `CLAUDE.md` rules.
  - The agenda is pasted or uploaded as a `.txt` file; PDF and Word uploads are not supported.
  - Three other made-up students (Theo, Sam, Jordan) were added alongside Malia; Jordan's family has not agreed, so that profile is never used.
  - Every change applies to the whole class. Rejecting the fix for the "waits at the bench" line blocks approval, because keeping it would break a must-never rule.
  - The approve button stays focusable when blocked and explains why, rather than being silently disabled.
  - The learner preview appears only after approval and an explicit "Show learner preview" click, and hides again if any decision, the agenda or a profile changes. It leaves out adult-only lines (the picture-schedule reminder and website notes) and shows "Still being checked" for anything unconfirmed.
- **What the learner tried and said/changed:** Not tried yet.
- **What changed after testing:** Notes were reworded to avoid doubled brackets in the revised agenda.
- **Open questions or risks:**
  - Keyboard flow, focus movement and screen reader announcements have been built for but not tested by hand.
  - Rules only catch the wording they know (e.g. "steps", "bus", "mostly accessible"); an agenda written differently may get fewer flags. The teacher still needs to read the agenda themselves.
  - Rewritten lines are mechanical and sometimes awkward; the teacher can edit them before accepting.

## Before sharing

- [ ] Group reviewed this note and explicitly approved sharing it.
- [ ] No real names, identifying details, records, credentials, secrets, or unrelated chat history are included.
- [ ] Prototype files and this note are in the approved export bundle.
