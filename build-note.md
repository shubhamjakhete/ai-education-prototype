# Table build note

> A concise, group-reviewed record of the prototype—not a chat transcript. Use a table alias, not participant names. Keep fictional examples only. Complete and share only with group consent.

## Overview

- **Table alias:** Table 5
- **Helper name:** My operation captain (Group 5, Helper 1)
- **Scenario/moment:** Fictional seventh grader returning to school after a long absence; the weekend before going back on Monday.
- **Note owner:** Not decided
- **Sharing decision:** Not decided

## Build brief

- **Initial build prompt:** The workshop's standard build prompt: read the spec, CLAUDE.md and this template; summarize and confirm before coding; build the smallest local prototype with no login, saved data, message sending or other side effects; editable draft on a separate educator/parent review screen; learner sees it only after explicit release; approval clears on any change; implement stated accessibility needs without claiming they work untested; add focused tests (expected case, missing/uncertain input, a "must never" rule including no learner view before review); keep this note updated; leave sharing as "Not decided".
- **Later instructions worth preserving:**
  - A first prototype (a single "Where can I ask for help?" card) was built, then replaced.
  - The group then asked to build only from their full "My operation captain" card, include everything in it, and also check the student's mood at greeting.
  - Items the workshop rules do not allow as written were built in a safe form (see decisions below).

## Work completed

- **Files created or changed:**
  - `agent-spec.yaml`: the group's card, spelling tidied, blanks filled and marked "ASSUMED", and "PROTOTYPE:" notes where the build differs because of workshop rules.
  - `src/captain.ts`: all rules: check-in, profile checks, plan drafting, two-reviewer approval and release, teacher acknowledgment, student suggestions and "not working", outside requests, concierge handoff.
  - `src/captain.test.ts`: focused tests.
  - `src/strategy-bank.ts`: fictional needs and strategy bank (teacher and plain-language student versions).
  - `src/fixtures.ts`: fictional schedule (six classes, teachers, today's objectives, tutorial titles), school places, example profile.
  - `src/main.ts`, `src/style.css`, `index.html`: the page with four role screens (Student, Caregiver, Case manager, Teacher).
  - `package.json`, `package-lock.json`, `tsconfig.json`: same tools as `example/`. No new dependencies.
  - Removed: the earlier help-card files and `extra-input.md`.
- **Prototype run instructions:** `npm install`, then `npm run dev` and open the local address. `npm test` runs the tests.
- **Tests/checks run and results:**
  - `npm test`: 26 of 26 pass.
  - `npm run build` (type check and build): passes.
  - A scripted run in headless Chrome clicked through the whole flow (check-in → caregiver → case manager → release → teacher → student → "not working" → outside request): 16 of 16 steps pass, no page errors. This checks behavior, not accessibility.

## Decisions and learning

- **Group decisions or assumptions:**
  - Mood check: a learner-directed greeting check-in with yes/no questions. Every question can be skipped, and the student decides whether the caregiver and case manager see it. Answers only highlight possible needs; the caregiver chooses. Withdrawing sharing removes the student's words from the draft. The helper never infers mood.
  - Email to teachers: nothing is sent. After both reviewers approve and one releases, the plan appears in the teacher view.
  - Medication schedule: general rest or nurse times only. Medication, test, and diagnosis words are flagged and block the plan.
  - Strategies come only from a fictional strategy bank, plus ones added by reviewers, accepted student suggestions, or teachers. The helper does not write new strategies.
  - The case manager must keep or decline every strategy; declining needs a reason, which the caregiver sees (the "explanation" the family asked for).
  - Both the caregiver and the case manager must approve. Any edit clears both approvals and withdraws the plan from teachers and the student.
  - Teachers must click "I received this plan" before they can ask for a consult or add a strategy for today's objective.
  - The student's "not working" (confirmed with a second yes/no) withdraws the plan from everyone and flags it for rework.
  - Outside requests (another school's teacher, a private tutoring coach) stay blocked until both reviewers authorize; the prototype sends nothing either way.
  - Speech: browser read aloud and the computer's dictation. No Gemini.
  - The role switcher is for the workshop only; it is not real access control.
  - No images ("picture" of needs): a narrative introduction only.
- **What the learner tried and said/changed:** Not yet tested with a learner.
- **What changed after testing:** Nothing yet.
- **Open questions or risks:**
  - Assumed fields (scenario, learner and moment, missing-input and boundary tests) need group confirmation.
  - The medical-word check uses a word list and can miss things; reviewer checks remain the safeguard.
  - Teacher class strategies are shown to the student without separate caregiver/case manager review; the group should confirm this.
  - The concierge helper handoff is a summary only; nothing is connected.
  - Accessibility still needs learner-directed testing: the check-in wording and yes/no buttons, read aloud, dictation, expand/collapse sections, keyboard-only use, focus after each action, screen reader announcements, contrast, and text size.

## Before sharing

- [ ] Group reviewed this note and explicitly approved sharing it.
- [ ] No real names, identifying details, records, credentials, secrets, or unrelated chat history are included.
- [ ] Prototype files and this note are in the approved export bundle.
