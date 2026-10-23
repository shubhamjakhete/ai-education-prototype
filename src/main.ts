import './style.css';
import {
  CHECK_IN_QUESTIONS,
  acceptSuggestion,
  acknowledge,
  addClassStrategy,
  addStrategy,
  answerCheckIn,
  approvalBlockers,
  approve,
  authorizeRequest,
  checkProfile,
  conciergeHandoff,
  editIntro,
  editStrategy,
  fullyApproved,
  initialState,
  makePlan,
  receiveOutsideRequest,
  release,
  releasedPlan,
  requestDecision,
  setCheckInSharing,
  setCheckInWords,
  setNeedsConsult,
  setProfile,
  sharedCheckIn,
  studentNotWorking,
  studentSuggest,
  suggestedNeeds,
  vetStrategy,
  type Reviewer,
  type Role,
  type State,
} from './captain';
import { NEEDS, type NeedId } from './strategy-bank';
import { EXAMPLE, SCHEDULE, SCHOOL_PLACES } from './fixtures';

// Everything lives in memory only. Nothing is saved or sent.
let state: State = initialState();
let role: Role = 'student';
let teacherClass = SCHEDULE[0].id;
let confirmingNotWorking = false;
const canSpeak = 'speechSynthesis' in window;

const ROLE_NAMES: Record<Role, string> = { student: 'Student', caregiver: 'Caregiver', caseManager: 'Case manager', teacher: 'Teacher' };
const REVIEWER_NAMES: Record<Reviewer, string> = { caregiver: 'Caregiver', caseManager: 'Case manager' };

// ---------- small DOM helpers ----------

type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false) continue;
    if (k === 'class') node.className = String(v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}
function button(label: string, onClick: () => void, attrs: Record<string, string | boolean> = {}): HTMLButtonElement {
  const b = h('button', { type: 'button', class: 'secondary', ...attrs }, label);
  b.addEventListener('click', onClick);
  return b;
}
function yesNo(current: string | null | undefined, onPick: (v: 'yes' | 'no') => void, labels = ['Yes', 'No']): HTMLElement {
  return h(
    'div',
    { class: 'actions yes-no-row' },
    button(labels[0], () => onPick('yes'), { 'aria-pressed': String(current === 'yes') }),
    button(labels[1], () => onPick('no'), { 'aria-pressed': String(current === 'no') }),
  );
}
function readAloud(getText: () => string, label = 'Read aloud'): HTMLElement {
  if (!canSpeak) return h('p', { class: 'hint' }, 'Read aloud is not available in this browser.');
  const stop = button('Stop', () => window.speechSynthesis.cancel());
  const start = button(label, () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(getText());
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  });
  return h('div', { class: 'actions read-row' }, start, stop);
}
function textField(id: string, label: string, value: string, onChange: (v: string) => void, opts: { rows?: number; help?: string; live?: boolean } = {}): HTMLElement {
  const field = opts.rows ? h('textarea', { id, rows: String(opts.rows) }) : h('input', { id, type: 'text', autocomplete: 'off' });
  field.value = value;
  if (opts.help) field.setAttribute('aria-describedby', `${id}-help`);
  field.addEventListener(opts.live ? 'input' : 'change', () => onChange(field.value));
  return h('div', { class: 'field' }, h('label', { for: id }, label), field, opts.help ? h('p', { id: `${id}-help`, class: 'hint' }, opts.help) : null);
}
function flagList(messages: string[], title = 'Please fix first'): HTMLElement | null {
  if (!messages.length) return null;
  return h('div', { class: 'flags', role: 'region', 'aria-label': title }, h('h3', {}, title), h('ul', {}, ...messages.map((m) => h('li', {}, m))));
}
function panel(title: string, kicker: string, ...children: Child[]): HTMLElement {
  const id = `p-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return h('section', { class: 'panel', 'aria-labelledby': id }, h('p', { class: 'kicker' }, kicker), h('h2', { id }, title), ...children);
}

// ---------- page frame ----------

const app = document.querySelector<HTMLDivElement>('#app')!;
const status = h('p', { class: 'toast', role: 'status', 'aria-live': 'polite' });
const view = h('main', { id: 'main', class: 'layout', tabindex: '-1' });
const nav = h('nav', { 'aria-label': 'Choose who is using the prototype' });
app.append(
  h('a', { class: 'skip-link', href: '#main' }, 'Skip to main content'),
  h(
    'header',
    { class: 'topbar' },
    h('p', { class: 'brand' }, 'My operation captain', h('span', { class: 'pill' }, 'Fictional data only · nothing is saved or sent')),
    nav,
    h('p', { class: 'hint role-note' }, 'Role switcher for the workshop only. It is not real access control.'),
  ),
  view,
  status,
);

function announce(message: string): void {
  status.textContent = '';
  window.setTimeout(() => (status.textContent = message), 30);
}

function update(next: State, message?: string): void {
  state = next;
  render();
  if (message) announce(message);
}

function renderNav(): void {
  nav.replaceChildren(
    ...(Object.keys(ROLE_NAMES) as Role[]).map((r) =>
      button(ROLE_NAMES[r], () => {
        role = r;
        confirmingNotWorking = false;
        if (canSpeak) window.speechSynthesis.cancel();
        render();
        view.focus();
      }, { class: 'tab', 'aria-pressed': String(role === r) }),
    ),
  );
}

// ---------- Student ----------

function studentView(): HTMLElement[] {
  const greeting = 'Hi! Want to do a quick check-in? Every question is optional. You can skip any of them.';
  const checkIn = panel(
    'Check-in',
    'Just for you',
    h('p', {}, greeting),
    readAloud(() => greeting + ' ' + CHECK_IN_QUESTIONS.map((q) => q.text).join(' ')),
    h(
      'ol',
      { class: 'questions' },
      ...CHECK_IN_QUESTIONS.map((q) =>
        h(
          'li',
          {},
          h('fieldset', {}, h('legend', {}, q.text),
            h('div', { class: 'actions yes-no-row' },
              ...(['yes', 'no', 'skip'] as const).map((a) =>
                button(a === 'skip' ? 'Skip' : a === 'yes' ? 'Yes' : 'No', () => update(answerCheckIn(state, q.id, a), `${q.text} ${a === 'skip' ? 'Skipped' : a}.`), {
                  'aria-pressed': String(a === 'skip' ? !state.checkIn.answers[q.id] : state.checkIn.answers[q.id] === a),
                }),
              ),
            ),
          ),
        ),
      ),
    ),
    textField('own-words', 'Anything you want to say in your own words? (optional)', state.checkIn.ownWords, (v) => update(setCheckInWords(state, v)), {
      rows: 2,
      live: true,
      help: "You can type, or use your computer's dictation to speak.",
    }),
    h('fieldset', { class: 'share' }, h('legend', {}, 'Share your check-in with your caregiver and case manager?'),
      yesNo(state.checkIn.shareWithAdults, (v) => update(setCheckInSharing(state, v), v === 'yes' ? 'Your check-in will be shared with your caregiver and case manager.' : 'Your check-in stays private.')),
      h('p', { class: 'hint' }, state.checkIn.shareWithAdults === 'yes' ? 'Shared. Only your caregiver and case manager see it.' : 'Not shared. Nobody else sees it.'),
    ),
  );

  const plan = releasedPlan(state);
  if (!plan) {
    return [checkIn, panel('My plan', 'Your plan', h('p', {}, state.reworkRequested ? 'Thanks for telling us. Your adults are working on your plan again with you.' : 'Your plan is not ready yet. You can come back any time.'))];
  }

  const strategiesText = plan.strategies.map((s) => s.studentText).join(' ');
  const myPlan = panel(
    'My plan',
    'Your plan',
    h('h3', {}, 'About me'),
    h('p', { class: 'pre' }, plan.intro),
    readAloud(() => plan.intro, 'Read "About me" aloud'),
    h('h3', {}, 'Things that can help me'),
    h('ul', {}, ...plan.strategies.map((s) => h('li', {}, s.studentText))),
    readAloud(() => strategiesText, 'Read these aloud'),
    h('details', {}, h('summary', {}, 'Today in each class'),
      h('ul', { class: 'classes' }, ...SCHEDULE.map((c) => h('li', {},
        h('strong', {}, `${c.period}: ${c.subject}`), ` with ${c.teacher}. Today: ${c.todayObjective} Practice: ${c.tutorial}.`,
        state.teachers[c.id].classStrategies.length ? h('ul', {}, ...state.teachers[c.id].classStrategies.map((t) => h('li', {}, `Your teacher's idea: ${t}`))) : null,
      ))),
    ),
    h('details', {}, h('summary', {}, 'Useful places'), h('ul', {}, ...SCHOOL_PLACES.map((p) => h('li', {}, p)))),
    h('fieldset', { class: 'share' }, h('legend', {}, 'Is your plan working for you?'),
      yesNo(null, (v) => {
        if (v === 'yes') {
          confirmingNotWorking = false;
          render();
          announce('Great. Thanks for telling us.');
        } else {
          confirmingNotWorking = true;
          render();
          document.querySelector<HTMLElement>('#confirm-rework button')?.focus();
        }
      }),
      confirmingNotWorking
        ? h('div', { id: 'confirm-rework' }, h('p', {}, 'Send your plan back to your adults to work on again with you?'),
            yesNo(null, (v) => {
              confirmingNotWorking = false;
              if (v === 'yes') update(studentNotWorking(state), 'Your plan was sent back to your adults to work on with you.');
              else render();
            }, ['Yes, send it back', 'Not now']))
        : null,
    ),
    h('details', {}, h('summary', {}, 'Add something to my plan (optional)'),
      suggestionBox('add-intro', 'Something about me', 'intro'),
      suggestionBox('add-strategy', 'Something that helps me', 'strategy'),
    ),
  );
  return [checkIn, myPlan];
}

function suggestionBox(id: string, label: string, target: 'intro' | 'strategy'): HTMLElement {
  const area = h('textarea', { id, rows: '2', 'aria-describedby': `${id}-help` });
  return h('div', { class: 'field' },
    h('label', { for: id }, label), area,
    h('p', { id: `${id}-help`, class: 'hint' }, 'Your caregiver and case manager will look at it with you.'),
    button('Give to my adults', () => {
      if (!area.value.trim()) return announce('Type something first, or leave it empty. Both are okay.');
      update(studentSuggest(state, target, area.value), 'Thanks. Your adults will see this.');
    }),
  );
}

// ---------- Caregiver and case manager ----------

function reviewerView(me: Reviewer): HTMLElement[] {
  const sections: HTMLElement[] = [];
  if (state.reworkRequested) sections.push(h('div', { class: 'panel alert' }, h('h2', {}, 'The student said the plan is not working'), h('p', {}, 'Back to the drawing board: please rework the plan together with the student, then approve and release again.')));

  // Student check-in (only if the student chose to share)
  const shared = sharedCheckIn(state);
  sections.push(panel('Student check-in', 'From the student',
    !shared
      ? h('p', {}, 'The student has not shared a check-in. Ask them if they would like to.')
      : h('div', {},
          h('ul', {}, ...CHECK_IN_QUESTIONS.map((q) => h('li', {}, `${q.text} ${shared.answers[q.id] ? (shared.answers[q.id] === 'yes' ? 'Yes' : 'No') : 'Skipped'}`))),
          shared.ownWords.trim() ? h('p', {}, `In their own words: "${shared.ownWords.trim()}"`) : null,
          h('p', { class: 'hint' }, 'These are the student\'s own answers. They are hints only; nothing is added to the plan automatically.'),
        ),
  ));

  if (me === 'caregiver') sections.push(profilePanel());
  sections.push(draftPanel(me));
  sections.push(suggestionsPanel(me));
  if (me === 'caseManager') sections.push(teacherStatusPanel());
  sections.push(outsideRequestsPanel(me));
  return sections;
}

function profilePanel(): HTMLElement {
  const hints = suggestedNeeds(state);
  const p = state.profile;
  const flags = checkProfile(p).map((f) => f.message);
  return panel('About the student', 'Caregiver only',
    h('p', { class: 'hint' }, 'Use general wording only. No medication names, test names, diagnoses, or other students\' names.'),
    textField('pref-name', 'Name the student wants teachers to use', p.preferredName, (v) => update(setProfile(state, { preferredName: v })), { live: true }),
    h('fieldset', { class: 'needs' }, h('legend', {}, 'Needs to share (choose with the student)'),
      ...NEEDS.map((n) => {
        const box = h('input', { type: 'checkbox', id: `need-${n.id}` });
        box.checked = p.needs.includes(n.id);
        box.addEventListener('change', () => {
          const needs: NeedId[] = box.checked ? [...p.needs, n.id] : p.needs.filter((x) => x !== n.id);
          update(setProfile(state, { needs }));
        });
        return h('div', { class: 'check-row' }, box, h('label', { for: `need-${n.id}` }, n.label, hints.includes(n.id) ? h('span', { class: 'tag' }, 'student\'s check-in points to this') : null));
      }),
    ),
    textField('rest-times', 'Rest or nurse times (optional, general only)', p.restTimes, (v) => update(setProfile(state, { restTimes: v })), {
      help: 'For example "Goes to the nurse at 11:30" or "May need rest after lunch". No medication or test names.',
      live: true,
    }),
    sourceNotesBox(),
    flagList(flags, 'Needed before making the plan'),
    h('div', { class: 'actions' },
      button('Make draft plan', () => {
        const next = makePlan(state);
        if (next === state) return announce('Please fix the items listed first.');
        update(next, 'Draft plan made. Review it below.');
      }, { class: 'primary', disabled: flags.length > 0 }),
      button('Load fictional example', () => update(setProfile(state, { preferredName: EXAMPLE.preferredName, needs: ['tired', 'writing', 'askingHelp'], restTimes: EXAMPLE.restTimes, sourceNotes: [EXAMPLE.sourceNote] }), 'Fictional example loaded.')),
    ),
    state.plan && state.status === 'draft' ? h('p', { class: 'hint' }, 'If you change these details, click "Make draft plan" again to update the draft. Approvals are cleared.') : null,
  );
}

function sourceNotesBox(): HTMLElement {
  const notes = state.profile.sourceNotes;
  const src = h('input', { id: 'note-source', type: 'text', autocomplete: 'off' });
  const txt = h('textarea', { id: 'note-text', rows: '2' });
  return h('details', { class: 'source-notes' }, h('summary', {}, `Notes from other sources (${notes.length})`),
    h('p', { class: 'hint' }, 'For your reference only, for example from the greeter helper. Never copied into the plan automatically. No medical details.'),
    notes.length ? h('ul', {}, ...notes.map((n) => h('li', {}, h('strong', {}, `${n.source}: `), n.text))) : null,
    h('label', { for: 'note-source' }, 'Where is this from?'), src,
    h('label', { for: 'note-text' }, 'Note'), txt,
    button('Add note', () => {
      if (!src.value.trim() || !txt.value.trim()) return announce('Add both where it is from and the note.');
      update(setProfile(state, { sourceNotes: [...notes, { source: src.value.trim(), text: txt.value.trim() }] }), 'Note added.');
    }),
  );
}

function draftPanel(me: Reviewer): HTMLElement {
  if (!state.plan) return panel('Draft plan', 'Caregiver and case manager', h('p', {}, me === 'caregiver' ? 'Fill in "About the student" and make the draft plan.' : 'The caregiver has not made a draft plan yet.'));
  const plan = state.plan;
  const blockers = approvalBlockers(state, me);
  const intro = h('textarea', { id: `intro-${me}`, rows: '8' });
  intro.value = plan.intro;
  intro.addEventListener('input', () => update(editIntro(state, me, intro.value)));

  const strategies = h('ol', { class: 'strategies' }, ...plan.strategies.map((s, i) => {
    const reasonId = `reason-${me}-${s.id}`;
    const reason = h('input', { id: reasonId, type: 'text', autocomplete: 'off' });
    reason.value = s.declineReason;
    const wording = h('input', { id: `wording-${me}-${s.id}`, type: 'text', autocomplete: 'off' });
    wording.value = s.teacherText;
    wording.addEventListener('input', () => update(editStrategy(state, me, s.id, wording.value, s.source === 'bank' ? s.studentText : wording.value)));
    return h('li', { class: `strategy ${s.status}` },
      h('p', { class: 'strategy-head' }, h('span', { class: `tag ${s.status}` }, s.status === 'proposed' ? 'Not vetted yet' : s.status === 'kept' ? 'Kept' : 'Declined'), h('span', { class: 'tag' }, `from ${s.source === 'bank' ? 'strategy bank' : ROLE_NAMES[s.source]}`)),
      h('label', { for: `wording-${me}-${s.id}` }, `Strategy ${i + 1} (teacher wording)`), wording,
      h('p', { class: 'hint' }, `Student sees: ${s.studentText}`),
      s.status === 'declined' ? h('p', { class: 'explain' }, `Why it was declined: ${s.declineReason}`) : null,
      me === 'caseManager'
        ? h('div', {},
            h('div', { class: 'actions' },
              button('Keep', () => update(vetStrategy(state, 'caseManager', s.id, 'kept'), 'Strategy kept. Approvals were cleared.'), { 'aria-pressed': String(s.status === 'kept') }),
              button('Decline', () => {
                if (!reason.value.trim()) {
                  reason.focus();
                  return announce('Add a short reason the family can read before declining.');
                }
                update(vetStrategy(state, 'caseManager', s.id, 'declined', reason.value), 'Strategy declined. Approvals were cleared.');
              }, { 'aria-pressed': String(s.status === 'declined') }),
            ),
            h('label', { for: reasonId }, 'Reason if declined (the family will see this)'), reason,
          )
        : null,
    );
  }));

  const newStrategy = h('input', { id: `new-strategy-${me}`, type: 'text', autocomplete: 'off' });
  return panel('Draft plan', me === 'caregiver' ? 'Caregiver: check that it is true and accurate' : 'Case manager: vet what is doable in school',
    h('p', {}, h('span', { class: 'draft-badge' }, 'DRAFT'), ' Teachers and the student see nothing until both of you approve and one of you releases it. Any edit clears both approvals.'),
    me === 'caregiver' ? h('p', { class: 'explain' }, 'The school sets the curriculum, so families cannot say no to it. You can give input on strategies, and the case manager will explain any strategy that is not possible.') : null,
    h('label', { for: `intro-${me}` }, 'Introduction for teachers'), intro,
    h('h3', {}, 'Strategies'), strategies,
    h('label', { for: `new-strategy-${me}` }, 'Add a strategy'), newStrategy,
    button('Add strategy', () => update(addStrategy(state, me, newStrategy.value), 'Strategy added. Approvals were cleared.')),
    reviewStatus(me, blockers),
  );
}

function reviewStatus(me: Reviewer, blockers: string[]): HTMLElement {
  const released = state.status === 'released';
  const lines = (Object.keys(REVIEWER_NAMES) as Reviewer[]).map((r) => `${REVIEWER_NAMES[r]}: ${state.approvals[r] ? 'approved' : 'not approved yet'}`);
  return h('div', { class: 'approve-area' },
    h('p', { class: `review-status ${released ? 'released' : ''}` }, released ? 'Released. Teachers and the student can see the plan.' : lines.join(' · ')),
    released ? null : flagList(blockers, `Before you can approve as ${REVIEWER_NAMES[me].toLowerCase()}`),
    h('div', { class: 'actions' },
      button(state.approvals[me] ? 'You approved ✓' : `Approve as ${REVIEWER_NAMES[me].toLowerCase()}`, () => update(approve(state, me), 'Approved.'), { class: 'primary', disabled: released || state.approvals[me] || blockers.length > 0 }),
      button('Release to teachers and student', () => update(release(state, me), 'Released to teachers and the student.'), { class: 'primary', disabled: released || !fullyApproved(state) }),
    ),
  );
}

function suggestionsPanel(me: Reviewer): HTMLElement {
  return panel('Suggestions from the student', 'Caregiver and case manager',
    state.suggestions.length === 0
      ? h('p', {}, 'No suggestions yet.')
      : h('ul', { class: 'suggestions' }, ...state.suggestions.map((s, i) => h('li', {},
          `${s.target === 'intro' ? 'About me' : 'Something that helps'}: "${s.text}" `,
          button('Add to draft', () => update(acceptSuggestion(state, me, i), 'Added to the draft. Approvals were cleared.'), { disabled: !state.plan }),
        ))),
  );
}

function teacherStatusPanel(): HTMLElement {
  const handoff = conciergeHandoff(state);
  return panel('Teachers', 'Case manager',
    !releasedPlan(state)
      ? h('p', {}, 'The plan has not been released to teachers.')
      : h('table', {}, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Class'), h('th', { scope: 'col' }, 'Received'), h('th', { scope: 'col' }, 'Needs a consult'), h('th', { scope: 'col' }, 'Class strategies'))),
          h('tbody', {}, ...SCHEDULE.map((c) => {
            const t = state.teachers[c.id];
            return h('tr', {}, h('th', { scope: 'row' }, `${c.subject} (${c.teacher})`), h('td', {}, t.acknowledged ? 'Yes' : 'Not yet'), h('td', {}, t.needsConsult === 'yes' ? 'Yes' : t.needsConsult === 'no' ? 'No' : '—'), h('td', {}, t.classStrategies.join('; ') || '—'));
          }))),
    handoff ? h('details', {}, h('summary', {}, 'Handoff for the learner concierge helper'), h('p', { class: 'pre' }, handoff)) : null,
  );
}

function outsideRequestsPanel(me: Reviewer): HTMLElement {
  return panel('Requests from outside the school team', 'Caregiver and case manager',
    h('p', { class: 'hint' }, 'Nothing is shared without both caregiver and case manager authorization. Even then, this prototype sends nothing.'),
    me === 'caseManager'
      ? h('div', { class: 'actions' },
          button('Simulate: teacher from another school asks', () => update(receiveOutsideRequest(state, 'Teacher from another school'), 'Request received. It is blocked.')),
          button('Simulate: private tutoring coach asks', () => update(receiveOutsideRequest(state, 'Private tutoring coach'), 'Request received. It is blocked.')),
        )
      : null,
    state.outsideRequests.length === 0
      ? h('p', {}, 'No requests.')
      : h('ul', {}, ...state.outsideRequests.map((r) => {
          const decision = requestDecision(r);
          return h('li', { class: 'request' },
            h('strong', {}, r.requester), ': ',
            decision === 'blocked'
              ? `Blocked. Waiting for ${(Object.keys(REVIEWER_NAMES) as Reviewer[]).filter((x) => !r.authorizedBy[x]).map((x) => REVIEWER_NAMES[x].toLowerCase()).join(' and ')}.`
              : 'Authorized by both. This prototype does not send anything; share by hand only if appropriate.',
            decision === 'blocked' && !r.authorizedBy[me] ? button(`Authorize as ${REVIEWER_NAMES[me].toLowerCase()}`, () => update(authorizeRequest(state, me, r.id), 'Authorized.')) : null,
          );
        })),
  );
}

// ---------- Teacher ----------

function teacherView(): HTMLElement[] {
  const select = h('select', { id: 'teacher-class' }, ...SCHEDULE.map((c) => h('option', { value: c.id, selected: c.id === teacherClass }, `${c.subject} (${c.teacher})`)));
  select.addEventListener('change', () => {
    teacherClass = select.value;
    render();
  });
  const picker = h('div', { class: 'panel' }, h('label', { for: 'teacher-class' }, 'Which class are you?'), select);
  const plan = releasedPlan(state);
  const c = SCHEDULE.find((x) => x.id === teacherClass)!;
  const t = state.teachers[c.id];
  if (!plan) return [picker, panel('Student support plan', `${c.subject} teacher`, h('p', {}, 'Nothing has been shared with you yet.'))];

  const strategyInput = h('input', { id: 'class-strategy', type: 'text', autocomplete: 'off' });
  return [
    picker,
    panel('Student support plan', `${c.subject} teacher`,
      h('p', { class: 'hint' }, 'Shared after the caregiver and case manager approved it. Please do not share it further.'),
      h('h3', {}, 'Introduction'), h('p', { class: 'pre' }, plan.intro),
      h('h3', {}, 'Agreed strategies'), h('ul', {}, ...plan.strategies.map((s) => h('li', {}, s.teacherText))),
      t.acknowledged
        ? h('p', { class: 'review-status released' }, 'You acknowledged receiving this plan.')
        : h('div', { class: 'actions' }, button('I received this plan', () => update(acknowledge(state, 'teacher', c.id), 'Thanks. Receipt acknowledged.'), { class: 'primary' })),
    ),
    panel("Today's lesson", `${c.subject} teacher`,
      h('p', {}, `Objective: ${c.todayObjective}`),
      !t.acknowledged
        ? h('p', { class: 'explain' }, 'Acknowledge the plan first. Then you can ask for a consult and add a strategy for today\'s lesson.')
        : h('div', {},
            h('fieldset', {}, h('legend', {}, 'Do you need a consult or support from the case manager?'), yesNo(t.needsConsult, (v) => update(setNeedsConsult(state, 'teacher', c.id, v), 'Answer saved for this session.'))),
            h('label', { for: 'class-strategy' }, "Add a strategy for today's objective"), strategyInput,
            button('Add', () => update(addClassStrategy(state, 'teacher', c.id, strategyInput.value), 'Strategy added for today.')),
            t.classStrategies.length ? h('ul', {}, ...t.classStrategies.map((s) => h('li', {}, s))) : null,
          ),
    ),
  ];
}

// ---------- render ----------

function render(): void {
  renderNav();
  // Remember where keyboard focus and the text cursor were, so a redraw does not move them.
  const active = document.activeElement as HTMLElement | null;
  const focusables = () => Array.from(view.querySelectorAll<HTMLElement>('button, input, textarea, select, summary'));
  const activeId = active?.id;
  const activeIndex = active ? focusables().indexOf(active) : -1;
  const caret = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? [active.selectionStart, active.selectionEnd] : null;
  const openDetails = Array.from(view.querySelectorAll('details')).map((d) => d.open);

  const sections = role === 'student' ? studentView() : role === 'teacher' ? teacherView() : reviewerView(role);
  view.replaceChildren(h('h1', { class: 'sr-only' }, `${ROLE_NAMES[role]} screen`), ...sections);

  view.querySelectorAll('details').forEach((d, i) => {
    if (openDetails[i]) d.open = true;
  });
  const target = (activeId && document.getElementById(activeId)) || (activeIndex >= 0 ? focusables()[activeIndex] : null);
  if (target && view.contains(active ?? null) === false && active !== document.body) {
    target.focus();
    if (caret && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) target.setSelectionRange(caret[0], caret[1]);
  }
}

render();
