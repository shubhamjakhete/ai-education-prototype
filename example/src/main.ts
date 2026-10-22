import './style.css';
import {
  NEED_LABELS,
  approvalBlockers,
  buildRevisedAgenda,
  checkAgenda,
  cleanAgendaText,
  initialDecisions,
  parseAgenda,
  type CheckResult,
  type Decisions,
  type Flag,
  type StudentProfile,
} from './agenda-checker';
import { SAMPLE_AGENDA, SAMPLE_PROFILES } from './fixtures';
import { buildLearnerPreview } from './learner-preview';
import { approve, canShare, onDecisionChange, onSourceChange, startReview, type ReviewState } from './review-gate';

const MAX_UPLOAD_BYTES = 100_000;

let profiles: StudentProfile[] = structuredClone(SAMPLE_PROFILES);
let result: CheckResult | null = null;
let decisions: Decisions = {};
let reviewState: ReviewState = 'not-checked';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <a class="skip-link" href="#main">Skip to the checker</a>
  <header class="topbar">
    <p class="brand"><span class="brand-mark" aria-hidden="true">✿</span> Field trip agenda checker <span class="brand-divider" aria-hidden="true">/</span> Workshop example</p>
    <p class="demo-pill">Made-up students and trip</p>
  </header>

  <main id="main" class="layout">
    <section class="panel" aria-labelledby="step1-title">
      <p class="kicker">Step 1</p>
      <h1 id="step1-title">Add the trip agenda</h1>
      <p class="hint">One activity per line, starting with the time if there is one. The first line can be the trip name.</p>

      <label for="agenda">Trip agenda</label>
      <textarea id="agenda" rows="11" spellcheck="true" aria-describedby="agenda-help"></textarea>
      <p id="agenda-help" class="hint">Use made-up details only. Nothing is sent or saved.</p>

      <div class="row">
        <div>
          <label for="agenda-file">Or upload a text file (.txt)</label>
          <input id="agenda-file" type="file" accept=".txt,.md,text/plain" />
        </div>
        <button type="button" id="load-example" class="secondary-button">Load example agenda</button>
      </div>

      <h2 class="section-title">Student profiles <span class="tag">teacher only</span></h2>
      <p class="hint">Only lines the family marked "Yes" are used, and only if the family agreed to use the profile.</p>
      <div id="profiles" class="profiles"></div>

      <div class="actions">
        <button type="button" id="check-button" class="primary-button">Check agenda</button>
      </div>
      <p id="check-status" class="status" role="status" aria-live="polite"></p>
    </section>

    <section id="review" class="panel" aria-labelledby="review-title" hidden>
      <p class="kicker">Step 2 · teacher only</p>
      <h2 id="review-title" tabindex="-1">Review each flag</h2>
      <p id="review-summary" class="hint"></p>
      <div id="language-flags"></div>
      <ol id="flag-list" class="flag-list"></ol>

      <h2 class="section-title">Original and revised agenda</h2>
      <p class="hint">The revised agenda only includes changes you accept.</p>
      <div class="compare">
        <section aria-labelledby="original-title">
          <h3 id="original-title">Original</h3>
          <ol id="original-list" class="agenda-list"></ol>
        </section>
        <section aria-labelledby="revised-title">
          <h3 id="revised-title">Revised</h3>
          <ol id="revised-list" class="agenda-list"></ol>
        </section>
      </div>

      <div class="approve-area">
        <h3>Before you approve</h3>
        <ul id="blocker-list" class="blockers"></ul>
        <button type="button" id="approve-button" class="primary-button">Approve revised agenda</button>
        <p id="approve-status" class="status" role="status" aria-live="polite"></p>
      </div>
    </section>

    <section id="clean" class="panel" aria-labelledby="clean-title" hidden>
      <p class="kicker">Step 3 · approved</p>
      <h2 id="clean-title" tabindex="-1">Revised agenda to share</h2>
      <p class="hint">No student names or needs. Safe to share with chaperones, the class and the nature center. Sharing is up to you; this page does not send anything.</p>
      <label for="clean-text">Revised agenda</label>
      <textarea id="clean-text" rows="14" readonly></textarea>
      <div class="actions">
        <button type="button" id="copy-button" class="secondary-button">Copy agenda text</button>
      </div>
      <h3 class="section-title">Still to check <span class="tag">teacher only</span></h3>
      <ul id="question-list" class="questions"></ul>
      <p id="copy-status" class="status" role="status" aria-live="polite"></p>

      <div class="release-area">
        <h3>Learner preview</h3>
        <p class="hint">Shows the student the approved agenda as a picture schedule. Nothing is shown to them until you choose to.</p>
        <button type="button" id="release-button" class="primary-button">Show learner preview</button>
      </div>
    </section>

    <section id="learner" class="panel learner" aria-labelledby="learner-title" hidden>
      <p class="kicker">Learner view</p>
      <h2 id="learner-title" tabindex="-1">Your trip</h2>
      <p id="learner-trip" class="learner-trip"></p>
      <p class="learner-intro">Here is the plan for the day. If something says <strong>Still being checked</strong>, the adults aren't sure yet. You can ask your teacher or family about anything.</p>
      <ol id="learner-cards" class="learner-cards"></ol>
      <div class="actions">
        <button type="button" id="hide-learner-button" class="secondary-button">Back to teacher view</button>
      </div>
    </section>
  </main>

  <footer class="page-footer">Workshop example · fictional students and trip · nothing is sent or saved</footer>
`;

const agendaInput = document.querySelector<HTMLTextAreaElement>('#agenda')!;
const fileInput = document.querySelector<HTMLInputElement>('#agenda-file')!;
const profilesBox = document.querySelector<HTMLDivElement>('#profiles')!;
const checkStatus = document.querySelector<HTMLParagraphElement>('#check-status')!;
const reviewSection = document.querySelector<HTMLElement>('#review')!;
const reviewTitle = document.querySelector<HTMLHeadingElement>('#review-title')!;
const reviewSummary = document.querySelector<HTMLParagraphElement>('#review-summary')!;
const languageBox = document.querySelector<HTMLDivElement>('#language-flags')!;
const flagList = document.querySelector<HTMLOListElement>('#flag-list')!;
const originalList = document.querySelector<HTMLOListElement>('#original-list')!;
const revisedList = document.querySelector<HTMLOListElement>('#revised-list')!;
const blockerList = document.querySelector<HTMLUListElement>('#blocker-list')!;
const approveButton = document.querySelector<HTMLButtonElement>('#approve-button')!;
const approveStatus = document.querySelector<HTMLParagraphElement>('#approve-status')!;
const cleanSection = document.querySelector<HTMLElement>('#clean')!;
const cleanTitle = document.querySelector<HTMLHeadingElement>('#clean-title')!;
const cleanText = document.querySelector<HTMLTextAreaElement>('#clean-text')!;
const questionList = document.querySelector<HTMLUListElement>('#question-list')!;
const copyStatus = document.querySelector<HTMLParagraphElement>('#copy-status')!;
const releaseButton = document.querySelector<HTMLButtonElement>('#release-button')!;
const learnerSection = document.querySelector<HTMLElement>('#learner')!;
const learnerTitle = document.querySelector<HTMLHeadingElement>('#learner-title')!;
const learnerTrip = document.querySelector<HTMLParagraphElement>('#learner-trip')!;
const learnerCards = document.querySelector<HTMLOListElement>('#learner-cards')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderProfiles(): void {
  profilesBox.replaceChildren();
  for (const profile of profiles) {
    const fieldset = el('fieldset', 'profile');
    fieldset.append(el('legend', undefined, profile.name));

    const consentId = `consent-${profile.id}`;
    const consent = el('div', 'checkbox-row');
    const box = el('input');
    box.type = 'checkbox';
    box.id = consentId;
    box.checked = profile.familyAgreed;
    box.addEventListener('change', () => {
      profile.familyAgreed = box.checked;
      sourceChanged('Profiles changed. Check the agenda again.');
    });
    const label = el('label', undefined, 'Family agreed to use this profile');
    label.htmlFor = consentId;
    consent.append(box, label);
    fieldset.append(consent);

    const list = el('ul', 'profile-lines');
    for (const line of profile.lines) {
      const used = line.shared === 'Yes' && profile.familyAgreed;
      const li = el('li', used ? 'used' : 'unused');
      li.append(
        el('span', 'tag', line.shared === 'Yes' ? 'Yes' : 'No'),
        document.createTextNode(` ${line.text}`),
        el('span', 'line-state', used ? ' (used in the check)' : ' (not used)'),
      );
      list.append(li);
    }
    fieldset.append(list);
    profilesBox.append(fieldset);
  }
}

function sourceChanged(message: string): void {
  if (reviewState === 'not-checked' && reviewSection.hidden) return;
  reviewState = onSourceChange();
  result = null;
  decisions = {};
  reviewSection.hidden = true;
  cleanSection.hidden = true;
  hideLearnerPreview();
  checkStatus.textContent = message;
}

function hideLearnerPreview(): void {
  learnerSection.hidden = true;
  learnerCards.replaceChildren();
}

function showLearnerPreview(): void {
  if (!result || !canShare(reviewState)) {
    approveStatus.textContent = 'Approve the revised agenda before showing the learner preview.';
    return;
  }
  learnerTrip.textContent = result.agenda.title;
  learnerTrip.hidden = !result.agenda.title;
  learnerCards.replaceChildren();
  for (const card of buildLearnerPreview(buildRevisedAgenda(result, decisions))) {
    const li = el('li', `learner-card${card.stillBeingChecked ? ' unconfirmed' : ''}`);
    li.append(el('span', 'learner-icon', card.icon));
    li.lastElementChild!.setAttribute('aria-hidden', 'true');
    const body = el('div');
    if (card.time) body.append(el('p', 'learner-time', card.time));
    body.append(el('p', 'learner-text', card.text));
    if (card.stillBeingChecked) body.append(el('p', 'learner-check', 'Still being checked'));
    li.append(body);
    learnerCards.append(li);
  }
  learnerSection.hidden = false;
  learnerTitle.focus();
}

function itemLabel(flag: Flag): string {
  if (!result || flag.itemId === null) return 'Whole agenda';
  const item = result.agenda.items.find((entry) => entry.id === flag.itemId);
  return item ? `${item.time ? `${item.time} ` : ''}${item.text}` : 'Whole agenda';
}

function changeLabel(flag: Flag): string {
  if (flag.change.type === 'replace') return 'Proposed new wording for this line';
  if (flag.change.type === 'note') return 'Proposed note to add to this line';
  return 'Proposed new line to add';
}

function renderFlags(): void {
  if (!result) return;
  flagList.replaceChildren();

  result.flags.forEach((flag, index) => {
    const li = el('li', `flag ${flag.kind}`);
    const headingId = `flag-${flag.id}-title`;
    li.setAttribute('aria-labelledby', headingId);

    const heading = el('h3', 'flag-title');
    heading.id = headingId;
    heading.append(
      el('span', `badge ${flag.kind}`, flag.kind === 'likely-barrier' ? 'Likely barrier' : 'Needs checking'),
      document.createTextNode(` Flag ${index + 1}: ${itemLabel(flag)}`),
    );
    li.append(heading);

    const affects = flag.affects.length > 0
      ? flag.affects.map((entry) => `${entry.studentName} (${NEED_LABELS[entry.need]})`).join(', ')
      : 'The whole class plan';
    const affectsLine = el('p', 'flag-meta');
    affectsLine.append(el('strong', undefined, 'Affects: '), document.createTextNode(affects));
    li.append(affectsLine, el('p', undefined, flag.reason));

    const textId = `change-${flag.id}`;
    const textLabel = el('label', undefined, `${changeLabel(flag)} (you can edit)`);
    textLabel.htmlFor = textId;
    const textArea = el('textarea');
    textArea.id = textId;
    textArea.rows = 2;
    textArea.value = decisions[flag.id].text;
    textArea.addEventListener('input', () => {
      decisions[flag.id].text = textArea.value;
      decisionChanged();
    });
    li.append(textLabel, textArea);

    const fieldset = el('fieldset', 'decision');
    fieldset.append(el('legend', undefined, 'Your decision'));
    for (const [value, text] of [['accepted', 'Accept'], ['rejected', 'Reject']] as const) {
      const optionId = `${flag.id}-${value}`;
      const row = el('div', 'radio-row');
      const radio = el('input');
      radio.type = 'radio';
      radio.name = `decision-${flag.id}`;
      radio.id = optionId;
      radio.value = value;
      radio.checked = decisions[flag.id].status === value;
      radio.addEventListener('change', () => {
        decisions[flag.id].status = value;
        decisionChanged();
      });
      const radioLabel = el('label', undefined, text);
      radioLabel.htmlFor = optionId;
      row.append(radio, radioLabel);
      fieldset.append(row);
    }
    li.append(fieldset);

    if (flag.question) {
      const question = el('p', 'question');
      question.append(el('strong', undefined, 'To check: '), document.createTextNode(flag.question));
      li.append(question);
    }
    flagList.append(li);
  });
}

function renderLanguageFlags(): void {
  languageBox.replaceChildren();
  if (!result || result.languageFlags.length === 0) return;
  const box = el('div', 'notice');
  box.append(el('h3', undefined, 'Wording to reconsider'));
  const list = el('ul');
  for (const flag of result.languageFlags) {
    const item = flag.itemId ? result.agenda.items.find((entry) => entry.id === flag.itemId) : null;
    list.append(el('li', undefined, `"${flag.word}" in: ${item ? item.text : result.agenda.title}`));
  }
  box.append(list);
  languageBox.append(box);
}

function renderComparison(): void {
  if (!result) return;
  originalList.replaceChildren();
  for (const item of result.agenda.items) {
    originalList.append(el('li', undefined, `${item.time ? `${item.time}  ` : ''}${item.text}`));
  }

  revisedList.replaceChildren();
  for (const line of buildRevisedAgenda(result, decisions)) {
    const li = el('li', line.status);
    if (line.status !== 'unchanged') {
      li.append(el('span', `badge ${line.status}`, line.status === 'added' ? 'Added' : 'Changed'), document.createTextNode(' '));
    }
    li.append(document.createTextNode(`${line.time ? `${line.time}  ` : ''}${line.text}`));
    revisedList.append(li);
  }
}

function renderBlockers(): string[] {
  if (!result) return [];
  const blockers = approvalBlockers(result, decisions, profiles);
  blockerList.replaceChildren();
  if (blockers.length === 0) {
    blockerList.append(el('li', 'ready', 'Every flag has a decision. Ready to approve.'));
  } else {
    for (const blocker of blockers) blockerList.append(el('li', undefined, blocker));
  }
  approveButton.setAttribute('aria-disabled', String(blockers.length > 0));
  return blockers;
}

function decisionChanged(): void {
  const wasApproved = canShare(reviewState);
  reviewState = onDecisionChange(reviewState);
  renderComparison();
  renderBlockers();
  if (wasApproved) {
    cleanSection.hidden = true;
    hideLearnerPreview();
    approveStatus.textContent = 'You changed a decision, so approval was cleared. Approve again when ready.';
  }
}

function runCheck(): void {
  try {
    const agenda = parseAgenda(agendaInput.value);
    result = checkAgenda(agenda, profiles);
    decisions = initialDecisions(result);
    reviewState = startReview();
  } catch (error) {
    checkStatus.textContent = error instanceof Error ? error.message : 'Check the agenda and try again.';
    agendaInput.focus();
    return;
  }

  const barriers = result.flags.filter((flag) => flag.kind === 'likely-barrier').length;
  const checks = result.flags.length - barriers;
  reviewSummary.textContent = result.studentsChecked === 0
    ? 'No profiles are in use, so the agenda was not checked against any student needs.'
    : `Checked ${result.agenda.items.length} agenda lines against ${result.studentsChecked} student profiles: ${barriers} likely barriers, ${checks} to check. Nothing changes until you accept it.`;

  renderLanguageFlags();
  renderFlags();
  renderComparison();
  renderBlockers();
  approveStatus.textContent = '';
  cleanSection.hidden = true;
  hideLearnerPreview();
  reviewSection.hidden = false;
  checkStatus.textContent = `Found ${result.flags.length} flags. Review them in step 2.`;
  reviewTitle.focus();
}

function approveAgenda(): void {
  if (!result) return;
  const blockers = renderBlockers();
  reviewState = approve(reviewState, blockers);
  if (!canShare(reviewState)) {
    approveStatus.textContent = 'Not approved yet. Resolve the items under "Before you approve".';
    blockerList.querySelector('li')?.scrollIntoView({ block: 'nearest' });
    return;
  }

  cleanText.value = cleanAgendaText(result.agenda.title, buildRevisedAgenda(result, decisions));
  questionList.replaceChildren();
  const questions = result.flags
    .filter((flag) => decisions[flag.id].status === 'accepted' && flag.question)
    .map((flag) => flag.question!);
  if (questions.length === 0) {
    questionList.append(el('li', undefined, 'Nothing left to check.'));
  } else {
    for (const question of questions) questionList.append(el('li', undefined, question));
  }
  approveStatus.textContent = 'Approved. The revised agenda is in step 3.';
  copyStatus.textContent = '';
  cleanSection.hidden = false;
  cleanTitle.focus();
}

agendaInput.addEventListener('input', () => sourceChanged('The agenda changed. Check it again.'));

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (file.size > MAX_UPLOAD_BYTES) {
    checkStatus.textContent = 'That file is too large. Upload a short plain-text agenda.';
    return;
  }
  agendaInput.value = await file.text();
  sourceChanged('New agenda uploaded. Check it again.');
  checkStatus.textContent = `Loaded "${file.name}". Review the text, then check the agenda.`;
});

document.querySelector<HTMLButtonElement>('#load-example')!.addEventListener('click', () => {
  agendaInput.value = SAMPLE_AGENDA;
  profiles = structuredClone(SAMPLE_PROFILES);
  renderProfiles();
  sourceChanged('Example agenda loaded.');
  checkStatus.textContent = 'Example agenda and profiles loaded. Press "Check agenda".';
});

document.querySelector<HTMLButtonElement>('#check-button')!.addEventListener('click', runCheck);
approveButton.addEventListener('click', approveAgenda);
releaseButton.addEventListener('click', showLearnerPreview);
document.querySelector<HTMLButtonElement>('#hide-learner-button')!.addEventListener('click', () => {
  hideLearnerPreview();
  releaseButton.focus();
});

document.querySelector<HTMLButtonElement>('#copy-button')!.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(cleanText.value);
    copyStatus.textContent = 'Copied. Paste it wherever you share trip plans.';
  } catch {
    cleanText.select();
    copyStatus.textContent = 'Could not copy automatically. The text is selected; press Ctrl+C or Command+C.';
  }
});

renderProfiles();
