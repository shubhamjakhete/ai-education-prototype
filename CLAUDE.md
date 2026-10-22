# Claude Code instructions

This repository is a workshop prototype starter. Participants define the helper; Claude Code should do most implementation work. Keep the app small enough to build and test during a workshop.

## Before implementing

1. Read the selected `agent-spec.yaml` (or showcase `agent.md`) and relevant scenario. Do not expand the task beyond its single job.
2. Summarize the intended user, moment, allowed inputs, expected output, human reviewer, accessibility needs, and "must never" rules. Ask only blocking questions; otherwise make reversible, minimal assumptions and state them.
3. Treat missing or "No" learner-profile permissions as unavailable. Use fabricated data only. Do not request or copy real student records, names, grades, or credentials.

## Build requirements

- Prefer the smallest working flow and the existing stack. Do not add a framework, dependency, backend, analytics, login, network call, learner-data persistence, or external side effect unless the spec explicitly requires it and the group approves it. The one standing exception is Gemini for accessibility features, as described under "Gemini for accessibility features" below.
- Implement accessibility for the stated learner needs: semantic HTML, keyboard operation, visible focus, clear labels/instructions, appropriate text sizing/contrast, and any requested screen-reader, switch, caption, audio, or other support. Do not claim support that has not been tested. Keep communication modes learner-directed; do not infer or speak on a learner's behalf.
- Make output editable and label it as a draft. An educator or parent must review the generated output before it is shown to the learner. Keep the adult review stage separate from the learner view; require an explicit release action, and clear approval whenever the draft or its source inputs change. Never send, publish, persist, or make a decision about learner data automatically. This restriction does not prohibit the separate, local build note, which must contain no identifying learner information and stays unshared unless the group consents.
- Do not invent learner facts, evidence, diagnoses, intentions, grades, or conclusions. If required information is missing or uncertain, surface a question/flag rather than guessing.
- Keep data in local fixtures unless specifically approved otherwise. Never expose API keys in browser code, prompts, logs, or source control.
- If `templates/build-note.md` is provided, maintain a concise `build-note.md` in the table's workspace. Record only the agreed task prompt, material later instructions, changed files, tests/results, group decisions, learner feedback explicitly provided for recording, and open risks. Do not capture the chat transcript, identifying details, or secrets; leave sharing undecided until the group reviews and consents.
- Project hooks append every prompt and every Edit/Write file change to `logs/claude-session-log.jsonl`. Use it as the source when filling in the build note's prompts and changed files, but summarize; do not paste the raw log into `build-note.md`. Do not edit or delete the log.

## Gemini for accessibility features

- Use Gemini only when the spec's accessibility needs call for voice to text, text to voice, or images, and a built-in option (e.g. the browser's `speechSynthesis`, the operating system's dictation) does not meet the need. Explain the choice in the summary before building.
- The key is `GEMINI_API_KEY` in `.env` at the repo root, which the table creates from `.env.example`. Never read, print, edit, log, or ask for the key. If it is missing, stop and ask the group to add it to `.env` themselves.
- Call Gemini only from a small local server using `@google/genai`, loading the key from `.env`. The browser calls that local server, never Gemini directly, and the key never appears in browser code.
- Models: `gemini-3.8-flash` for transcription (prompt: "Generate a transcript of the speech."), `gemini-3.8-flash-tts` for speech, `gemini-3.1-flash-image` for images. If a call fails, check the current docs at https://ai.google.dev/gemini-api/docs rather than guessing.
- Send only fictional data. Generated images and speech go through the adult review stage like any other output. Show transcripts to the learner to check and edit; never act on them automatically.
- Provide a fallback when the key is missing or the network is down (a built-in option or a clear message), and mock Gemini in tests rather than calling the real API.

## Verify and report

- Add or update focused tests for expected behavior, missing inputs, and at least one "must never" boundary.
- Run available tests and build checks; fix issues caused by the change.
- Review keyboard flow and accessible names; describe what still requires hands-on learner testing.
- Summarize files changed, behavior, tests run, assumptions, and any unverified accessibility or safety risks. Do not claim an accessibility audit based only on code inspection.
