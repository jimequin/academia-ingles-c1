/* ==========================================================
   Academia C1 · lógica principal
   Todo se guarda en el navegador (localStorage), en una sola
   clave: 'academia.v1'. No hay servidor.
   ========================================================== */

import { PLACEMENT, LESSONS, UOE, DICTATIONS, LISTENINGS, WRITING_TASKS, SPEAKING_PARTS, VOCAB } from './data.js';
import { dateKey, parseDate, addDays, daysBetween, buildPlan as buildPlanFor, weekForDate, CHAT_SESSIONS, DEFAULT_SCHEDULE, weeklyMinutes, grammarFocus } from './plan.js';
import { MODELS, DEFAULT_MODEL, chat, askJson, tutorSystem, writingSystem, WRITING_SCHEMA, EXERCISES_SCHEMA, READING_SCHEMA } from './ai.js';

/* ==========================================================
   1. Estado y guardado
   ========================================================== */

const STORAGE_KEY = 'academia.v1';

function freshState() {
  return {
    profile: null, // { name, examDate, startDate, level, schedule }
    settings: { apiKey: '', model: DEFAULT_MODEL, voiceURI: '', rate: 0.95, autoSpeak: true },
    log: [], // actividades hechas: { date, kind, score (0-1 o null), minutes, detail }
    tests: [], // test de nivel, evaluaciones y simulacros
    lessons: {}, // id → mejor % en los ejercicios
    srs: {}, // tarjeta → { box, due }
    manualDone: {}, // 'AAAA-MM-DD:kind' → true (tareas marcadas a mano)
    chats: {}, // modo del tutor → mensajes
    writings: [] // redacciones corregidas
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    const base = freshState();
    return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
  } catch (e) {
    console.error('No se pudo leer el estado guardado', e);
    return freshState();
  }
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('No se ha podido guardar (¿memoria del navegador llena?)');
  }
}

/* ==========================================================
   2. Utilidades
   ========================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(d, opts = { day: 'numeric', month: 'short' }) {
  return d.toLocaleDateString('es-ES', opts);
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr, n) {
  return shuffle(arr).slice(0, n);
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// Normaliza respuestas escritas para comparar sin que importen
// mayúsculas, puntuación o contracciones (don't = do not).
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/can't/g, 'cannot')
    .replace(/won't/g, 'will not')
    .replace(/n't/g, ' not')
    .replace(/'ve/g, ' have')
    .replace(/'m/g, ' am')
    .replace(/'re/g, ' are')
    .replace(/'ll/g, ' will')
    .replace(/'d/g, ' had')
    .replace(/[.,!?;:"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ==========================================================
   3. Niveles y escala Cambridge
   ========================================================== */

const LEVELS = ['A2', 'B1', 'B2', 'C1', 'C2'];
// Horas guiadas aproximadas (acumuladas) que Cambridge estima por nivel
const HOURS_TO_REACH = { A1: 90, A2: 190, B1: 375, B2: 550, C1: 750, C2: 1050 };

// Convierte un % de aciertos en una puntuación aproximada de la
// Cambridge English Scale para el C1 Advanced (180 = aprobado C1).
function pctToScale(pct) {
  const p = Math.max(0, Math.min(1, pct)) * 100;
  if (p < 45) return Math.round(142 + (p / 45) * 18);
  if (p < 60) return Math.round(160 + ((p - 45) / 15) * 20);
  if (p < 80) return Math.round(180 + ((p - 60) / 20) * 20);
  return Math.round(200 + ((p - 80) / 20) * 10);
}
function scaleToLabel(scale) {
  if (scale >= 200) return 'C2 (grado A)';
  if (scale >= 193) return 'C1 (grado B)';
  if (scale >= 180) return 'C1 (grado C)';
  if (scale >= 160) return 'B2';
  return 'Por debajo de B2';
}

function currentLevel() {
  return (state.profile && state.profile.level) || null;
}

/* ==========================================================
   4. Cronograma
   ========================================================== */

// Tu horario (se cambia en ⚙️ Ajustes)
function schedule() {
  return { ...DEFAULT_SCHEDULE, ...((state.profile && state.profile.schedule) || {}) };
}

const KIND_INFO = {
  lesson: { emoji: '📚', label: 'Clase', minutes: 25 },
  lesson2: { emoji: '📚', label: 'Segunda clase de la semana', minutes: 25 },
  tutorlesson: { emoji: '👩‍🏫', label: 'Clase particular con el profesor IA', minutes: 30 },
  vocab: { emoji: '🃏', label: 'Vocabulario (10 tarjetas)', minutes: 10 },
  uoe: { emoji: '🧩', label: 'Use of English', minutes: 15 },
  uoe4: { emoji: '🔁', label: 'Key word transformations', minutes: 15 },
  dictation: { emoji: '🎧', label: 'Dictado', minutes: 10 },
  listening: { emoji: '👂', label: 'Listening', minutes: 15 },
  reading: { emoji: '📖', label: 'Reading', minutes: 20 },
  writing: { emoji: '✍️', label: 'Writing', minutes: 45 },
  writing2: { emoji: '✍️', label: 'Writing extra', minutes: 45 },
  speaking: { emoji: '🗣️', label: 'Speaking con el tutor', minutes: 15 },
  review: { emoji: '🔄', label: 'Repaso de la semana', minutes: 20 },
  eval: { emoji: '📝', label: 'Evaluación mensual', minutes: 40 },
  mock: { emoji: '🏁', label: 'Simulacro de examen', minutes: 90 },
  placement: { emoji: '🎯', label: 'Test de nivel', minutes: 20 },
  drill: { emoji: '💬', label: 'Sesión de gramática en el Chat', minutes: 15 },
  claudeclass: { emoji: '👩‍🏫', label: 'Clase con Claude', minutes: 30 }
};

// Contenido de las dos clases de 1 h 30 entre semana (A = primera, B = segunda)
const CLASS_A = ['lesson', 'uoe', 'dictation', 'listening', 'speaking', 'vocab'];
const CLASS_B = ['writing', 'uoe4', 'reading', 'vocab'];
// Fin de semana: unas 2 h de clase y el resto de ejercicios, hasta tus 4 h
const WEEKEND_CLASS = ['review', 'lesson2', 'claudeclass', 'speaking', 'listening', 'vocab'];
const WEEKEND_EXERCISES = ['uoe', 'uoe', 'uoe', 'uoe4', 'dictation', 'reading', 'writing2', 'vocab'];

function buildPlan() {
  return buildPlanFor(state.profile);
}

const PHASES = {
  1: { name: 'Fase 1 · Consolidación', desc: 'Afianzar la gramática B2+ y crear el hábito diario.' },
  2: { name: 'Fase 2 · Núcleo C1', desc: 'Estructuras y vocabulario propios del C1, y writing con los cuatro géneros.' },
  3: { name: 'Fase 3 · Técnica de examen', desc: 'Simulacros cronometrados, repaso de puntos débiles y estrategia.' }
};

function isWeekend(d) {
  return d.getDay() === 0 || d.getDay() === 6;
}

// Qué toca un día concreto. Devuelve { tasks, from, to, weekend, goal }:
// from/to es el rango de fechas en el que cuentan las actividades
// (un día, o sábado+domingo juntos si es fin de semana).
function dayPlan(d) {
  const plan = buildPlan();
  const key = dateKey(d);
  const empty = { tasks: [], from: key, to: key, weekend: false, goal: 0 };
  if (!plan) return empty;
  if (!state.tests.some((t) => t.type === 'placement')) {
    return { ...empty, tasks: [{ kind: 'placement', label: 'Haz el test de nivel', minutes: 20, emoji: '🎯', action: () => startPlacement(), key: key + ':placement' }] };
  }
  const week = weekForDate(plan, d);
  if (!week) return empty;
  if (key === state.profile.examDate) {
    return { ...empty, tasks: [{ kind: 'exam', label: '¡Día del examen! Descansa, desayuna bien y confía en tu preparación.', action: null, key: key + ':exam' }] };
  }
  const sch = schedule();
  const sections = [];

  if (isWeekend(d)) {
    const sat = addDays(week.start, 5);
    const from = dateKey(sat);
    const to = dateKey(addDays(sat, 1));
    let cls = WEEKEND_CLASS.slice();
    let ex = WEEKEND_EXERCISES.slice();
    if (week.lessons.length < 2) cls = cls.filter((k) => k !== 'lesson2');
    if (week.test) ex = [week.test, ...ex.slice(0, week.test === 'mock' ? 3 : 5)];
    if (week.isLast) { cls = ['review', 'speaking']; ex = ['vocab', 'listening']; }
    const clsMin = cls.reduce((acc, k) => acc + KIND_INFO[k].minutes, 0);
    sections.push({ title: `👩‍🏫 Clase de fin de semana (~${fmtMin(clsMin)})`, kinds: cls });
    sections.push({ title: '🏋️ Ejercicios (hasta completar tus horas)', kinds: ex });
    return { tasks: makeTasks(sections, week, `w${week.index}`), from, to, weekend: true, goal: sch.weekendMinutes };
  }

  const wa = sch.chat && CHAT_SESSIONS[d.getDay()];
  if (wa) sections.push({ title: '💬 Chat', kinds: ['drill'], wa });
  const idx = sch.classDays.slice().sort().indexOf(d.getDay());
  if (idx !== -1) {
    let kinds = idx % 2 === 0 ? CLASS_A : CLASS_B;
    if (week.isLast) kinds = ['vocab', 'speaking'];
    sections.push({ title: `📚 Clase (${sch.classMinutes} min)`, kinds });
  }
  const goal = (wa ? wa.minutes : 0) + (idx !== -1 ? sch.classMinutes : 0);
  return { tasks: makeTasks(sections, week, key), from: key, to: key, weekend: false, goal };
}

function makeTasks(sections, week, keyBase) {
  const tasks = [];
  sections.forEach((sec) => {
    sec.kinds.forEach((kind, i) => {
      const info = KIND_INFO[kind];
      let label = info.label;
      let minutes = info.minutes;
      if ((kind === 'lesson' || kind === 'lesson2') && week.lessons.length) {
        const l = LESSONS.find((x) => x.id === week.lessons[kind === 'lesson' ? 0 : 1]);
        if (l) label = `Clase: ${l.title}`;
      }
      if ((kind === 'tutorlesson' || kind === 'claudeclass') && week.lessons.length) {
        const l = LESSONS.find((x) => x.id === week.lessons[week.lessons.length - 1]);
        label = `Clase con Claude: ${l.title}`;
      }
      if (kind === 'writing' || kind === 'writing2') {
        const t = WRITING_TASKS.find((x) => x.id === (kind === 'writing' ? week.writing : week.writing2));
        label = `Writing: ${t.genre}`;
      }
      if (kind === 'speaking') label = `Speaking · ${SPEAKING_PARTS.find((x) => x.id === week.speaking).name}`;
      if (kind === 'uoe') {
        const nth = sec.kinds.slice(0, i).filter((k) => k === 'uoe').length;
        const part = ((week.uoePart - 1 + nth) % 3) + 1;
        label = `Use of English · Part ${part}`;
        tasks.push({ kind, label, minutes, emoji: info.emoji, section: sec.title, action: () => startUoePart(part), key: `${keyBase}:${kind}:${i}:${sec.title}` });
        return;
      }
      if (kind === 'drill') {
        const mins = sec.wa.minutes;
        label = `Sesión de gramática a las ${sec.wa.time} (${mins} min)`;
        minutes = mins;
        tasks.push({ kind, label, minutes, emoji: info.emoji, section: sec.title, action: () => startDrill(mins), key: `${keyBase}:${kind}:${i}:${sec.title}` });
        return;
      }
      tasks.push({
        kind, label, minutes, emoji: info.emoji, section: sec.title,
        action: () => openKind(kind, week),
        key: `${keyBase}:${kind}:${i}:${sec.title}`
      });
    });
  });
  return tasks;
}

// Marca qué tareas están hechas: a mano, o porque hay actividades
// registradas de ese tipo en el rango de fechas (una por tarea).
function withDone(dp) {
  const counts = {};
  state.log.forEach((e) => {
    if (e.date >= dp.from && e.date <= dp.to) counts[e.kind] = (counts[e.kind] || 0) + 1;
  });
  const alias = { lesson2: 'lesson', writing2: 'writing' };
  return dp.tasks.map((t) => {
    if (t.kind === 'placement') return { ...t, done: state.tests.some((x) => x.type === 'placement') };
    if (state.manualDone[t.key]) return { ...t, done: true };
    const k = alias[t.kind] || t.kind;
    if (counts[k] > 0) { counts[k]--; return { ...t, done: true }; }
    return { ...t, done: false };
  });
}

function openKind(kind, week) {
  switch (kind) {
    case 'lesson': return openLesson(week.lessons[0] || LESSONS[0].id);
    case 'lesson2': return openLesson(week.lessons[1] || week.lessons[0] || LESSONS[0].id);
    case 'tutorlesson':
    case 'claudeclass': {
      const l = LESSONS.find((x) => x.id === week.lessons[week.lessons.length - 1]) || LESSONS[0];
      return state.settings.apiKey ? openTutor('lesson', l.title) : openInClaude(claudePromptFor(kind, week));
    }
    case 'drill': return startDrill(15);
    case 'writing2': return startWriting(week.writing2);
    case 'review': return startReview(week);
    case 'vocab': return startVocab();
    case 'uoe': return startUoePart(week.uoePart);
    case 'uoe4': return startUoePart(4);
    case 'dictation': return startDictation();
    case 'listening': return startListening();
    case 'reading': return startReading();
    case 'writing': return startWriting(week.writing);
    case 'speaking': return state.settings.apiKey ? openTutor('examiner', week.speaking) : openInClaude(claudePromptFor('speaking', week));
    case 'eval': return startEvaluation();
    case 'mock': return startMock();
    case 'placement': return startPlacement();
  }
}

// Registra una actividad terminada (cuenta para el plan y el progreso)
function logActivity(kind, score, detail) {
  state.log.push({
    date: dateKey(),
    ts: Date.now(),
    kind,
    score: score == null ? null : Math.round(score * 1000) / 1000,
    minutes: (KIND_INFO[kind] || { minutes: 10 }).minutes,
    detail: detail || ''
  });
  save();
}

/* ==========================================================
   5. Navegación entre pantallas
   ========================================================== */

let currentView = 'hoy';
let cleanupActivity = null; // para parar temporizadores o la voz al salir

function show(view) {
  if (cleanupActivity) { cleanupActivity(); cleanupActivity = null; }
  currentView = view;
  $$('.view').forEach((v) => v.classList.add('hidden'));
  $(`#view-${view}`).classList.remove('hidden');
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === (view === 'tutor' ? 'chat' : view)));
  const renderers = { hoy: renderHoy, plan: renderPlan, clases: renderClases, practica: renderPractica, chat: renderChat, tutor: renderTutor, progreso: renderProgreso };
  if (renderers[view]) renderers[view]();
  window.scrollTo(0, 0);
  renderCountdown();
}

// Abre la pantalla de "actividad" con un botón para volver
function activity(title, backTo = currentView === 'actividad' ? 'hoy' : currentView) {
  if (cleanupActivity) { cleanupActivity(); cleanupActivity = null; }
  const el = $('#view-actividad');
  $$('.view').forEach((v) => v.classList.add('hidden'));
  el.classList.remove('hidden');
  currentView = 'actividad';
  el.innerHTML = `<button class="btn ghost small back">← Volver</button><h2>${title}</h2><div class="activity-body"></div>`;
  $('.back', el).onclick = () => show(backTo);
  window.scrollTo(0, 0);
  return $('.activity-body', el);
}

function renderCountdown() {
  const chip = $('#countdownChip');
  if (!state.profile) { chip.textContent = ''; return; }
  const days = daysBetween(new Date(), parseDate(state.profile.examDate));
  chip.textContent = days > 0 ? `⏳ ${days} días` : days === 0 ? '🎓 ¡Hoy!' : '🎓 Examen hecho';
}

/* ==========================================================
   6. Motor de ejercicios (sirve para clases, tests y práctica)
   ========================================================== */

function gapHtml(text) {
  return esc(text).replace(/___/g, '<span class="gapmark">&nbsp;</span>');
}

function renderQuestion(item, i) {
  const n = `<div class="q-num">${i + 1}</div>`;
  if (item.type === 'mc') {
    return `<div class="q" data-i="${i}">${n}<div class="q-text">${gapHtml(item.q)}</div>
      <div class="opts">${item.options.map((o, k) => `<button type="button" class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div></div>`;
  }
  if (item.type === 'kwt') {
    return `<div class="q" data-i="${i}">${n}<div class="q-text">${esc(item.q)}</div>
      <div class="keyword">${esc(item.key)}</div>
      <div class="kwt-line">${item.start ? `<span>${esc(item.start)}</span>` : ''}<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="2–5 palabras, incluida ${esc(item.key)}"><span>${esc(item.end)}</span></div></div>`;
  }
  // gap y wf
  return `<div class="q" data-i="${i}">${n}<div class="q-text">${gapHtml(item.q)}${item.base ? ` <span class="tag warn">${esc(item.base)}</span>` : ''}</div>
    <input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Tu respuesta"></div>`;
}

function checkItem(item, answer) {
  if (item.type === 'mc') return answer === item.answer;
  let a = norm(answer);
  if (item.type === 'kwt') {
    const s = norm(item.start);
    const e = norm(item.end);
    if (s && a.startsWith(s + ' ')) a = a.slice(s.length + 1);
    if (e && a.endsWith(' ' + e)) a = a.slice(0, -e.length - 1);
  }
  return item.answers.some((x) => norm(x) === a);
}

function correctText(item) {
  if (item.type === 'mc') return item.options[item.answer];
  return item.answers[0];
}

// Pinta una lista de ejercicios con botón "Corregir".
// onDone(correctas, total, detalle) se llama al corregir.
function renderQuiz(container, items, { onDone, submitLabel = 'Corregir', showExplain = true } = {}) {
  container.innerHTML = `<div class="card quiz">${items.map(renderQuestion).join('')}</div>
    <button class="btn primary block submit">${submitLabel}</button><div class="quiz-result"></div>`;
  const answers = {};
  $$('.q', container).forEach((qEl) => {
    const i = Number(qEl.dataset.i);
    $$('.opt', qEl).forEach((b) => {
      b.onclick = () => {
        if (container.dataset.done) return;
        $$('.opt', qEl).forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
        answers[i] = Number(b.dataset.k);
      };
    });
  });
  $('.submit', container).onclick = () => {
    if (container.dataset.done) return;
    container.dataset.done = '1';
    let correct = 0;
    const detail = [];
    items.forEach((item, i) => {
      const qEl = $(`.q[data-i="${i}"]`, container);
      const input = $('input', qEl);
      const given = item.type === 'mc' ? answers[i] : input.value;
      const ok = given !== undefined && given !== '' && checkItem(item, given);
      if (ok) correct++;
      detail.push({ ok, item });
      if (item.type === 'mc') {
        $$('.opt', qEl).forEach((b) => {
          const k = Number(b.dataset.k);
          if (k === item.answer) b.classList.add('right');
          else if (k === given) b.classList.add('wrong');
        });
      } else {
        input.classList.add(ok ? 'right' : 'wrong');
        input.readOnly = true;
      }
      const fb = document.createElement('div');
      fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = (ok ? '✔ Correcto' : `✘ Respuesta: <b>${esc(correctText(item))}</b>`) +
        (showExplain && item.explain ? `<span class="explain">${esc(item.explain)}</span>` : '');
      qEl.appendChild(fb);
    });
    $('.submit', container).classList.add('hidden');
    if (onDone) onDone(correct, items.length, detail);
  };
}

function resultCard(correct, total, extraHtml = '') {
  const pct = total ? correct / total : 0;
  const msg = pct >= 0.8 ? '¡Excelente! Nivel de examen.' : pct >= 0.6 ? 'Bien: estás en zona de aprobado.' : 'Hay que repasar este punto. ¡Es normal al principio!';
  return `<div class="card"><div class="spread"><div><div class="score-big">${correct}/${total}</div>
    <p class="muted">${Math.round(pct * 100)}% · ${msg}</p></div></div>${extraHtml}</div>`;
}

/* ---------- Textos de examen con huecos (Use of English Parts 1-3) ---------- */

function renderExamText(container, part, data, { onDone } = {}) {
  let html = esc(data.text);
  html = html.replace(/\[(\d+)\]/g, (_, num) => {
    const i = Number(num) - 1;
    if (part === 1) {
      const g = data.gaps[i];
      return `<span class="num">${num}</span><select data-i="${i}"><option value="">—</option>${g.options.map((o, k) => `<option value="${k}">${esc(o)}</option>`).join('')}</select>`;
    }
    const base = part === 3 ? `<span class="base">${esc(data.gaps[i].base)}</span>` : '';
    return `<span class="num">${num}</span><input type="text" data-i="${i}" autocomplete="off" autocapitalize="off" spellcheck="false">${base}`;
  });
  container.innerHTML = `<div class="card"><h3>${esc(data.title)}</h3><div class="exam-text">${html}</div></div>
    <button class="btn primary block submit">Corregir</button><div class="quiz-result"></div>`;
  $('.submit', container).onclick = () => {
    let correct = 0;
    const n = part === 2 ? data.answers.length : data.gaps.length;
    const solutions = [];
    for (let i = 0; i < n; i++) {
      const el = $(`[data-i="${i}"]`, container);
      let ok;
      let sol;
      if (part === 1) {
        ok = el.value !== '' && Number(el.value) === data.gaps[i].answer;
        sol = data.gaps[i].options[data.gaps[i].answer];
      } else {
        const accepted = part === 2 ? data.answers[i] : data.gaps[i].answers;
        ok = accepted.some((x) => norm(x) === norm(el.value));
        sol = accepted.join(' / ');
      }
      if (ok) correct++;
      el.classList.add(ok ? 'right' : 'wrong');
      el.disabled = true;
      solutions.push(`<li>${ok ? '✔' : '✘'} <b>${i + 1}.</b> ${esc(sol)}</li>`);
    }
    $('.submit', container).classList.add('hidden');
    $('.quiz-result', container).innerHTML = resultCard(correct, n, `<h3>Soluciones</h3><ul>${solutions.join('')}</ul>`);
    if (onDone) onDone(correct, n);
  };
}

// Convierte un hueco de un texto de examen en una pregunta suelta
// (la frase que lo contiene, con los otros huecos ya resueltos).
function examTextToItems(part, data) {
  const fill = (txt) => txt.replace(/\[(\d+)\]/g, (_, num) => {
    const i = Number(num) - 1;
    if (part === 1) return data.gaps[i].options[data.gaps[i].answer];
    if (part === 2) return data.answers[i][0];
    return data.gaps[i].answers[0];
  });
  const sentences = data.text.match(/[^.!?]+[.!?]+["”]?/g) || [data.text];
  const items = [];
  sentences.forEach((s) => {
    const nums = [...s.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    nums.forEach((num) => {
      const i = num - 1;
      const q = fill(s.replace(`[${num}]`, '___')).trim();
      if (part === 1) items.push({ type: 'mc', q, options: data.gaps[i].options, answer: data.gaps[i].answer });
      else if (part === 2) items.push({ type: 'gap', q, answers: data.answers[i] });
      else items.push({ type: 'wf', q, base: data.gaps[i].base, answers: data.gaps[i].answers });
    });
  });
  return items;
}

/* ==========================================================
   7. Voz: leer en inglés (TTS) y escuchar (reconocimiento)
   ========================================================== */

const synth = window.speechSynthesis;
let voices = [];
function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
}
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}
function pickVoice() {
  if (!voices.length) loadVoices();
  return voices.find((v) => v.voiceURI === state.settings.voiceURI) ||
    voices.find((v) => v.lang === 'en-GB') || voices[0] || null;
}
function speak(text, rate) {
  return new Promise((resolve) => {
    if (!synth) { toast('Tu navegador no puede leer en voz alta'); resolve(); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'en-GB';
    u.rate = rate || state.settings.rate || 0.95;
    u.onend = resolve;
    u.onerror = resolve;
    synth.speak(u);
  });
}
function stopSpeaking() {
  if (synth) synth.cancel();
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/* ==========================================================
   8. Pantalla HOY
   ========================================================== */

function streak() {
  const days = new Set(state.log.map((e) => e.date));
  let n = 0;
  let d = new Date();
  if (!days.has(dateKey(d))) d = addDays(d, -1); // si hoy aún no, cuenta hasta ayer
  while (days.has(dateKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

function totalHours() {
  return studiedMinutes('0000-00-00', '9999-12-31') / 60;
}

/* ---------- Tiempo de estudio real ----------
   Cuenta el tiempo que pasas dentro de una actividad o con el tutor,
   con la app abierta y sin estar más de 8 minutos sin tocar nada.
   Lo que hagas en Claude (fuera de la app) no se puede medir. */

const TIME_KEY = 'academia.time';
let studyTime = {};
try { studyTime = JSON.parse(localStorage.getItem(TIME_KEY) || '{}'); } catch (e) { studyTime = {}; }
let lastInput = Date.now();
['click', 'keydown', 'touchstart', 'input', 'scroll'].forEach((ev) =>
  document.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));

setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  if (currentView !== 'actividad' && currentView !== 'tutor') return;
  const speaking = synth && synth.speaking;
  if (Date.now() - lastInput > 8 * 60 * 1000 && !speaking) return;
  const k = dateKey();
  studyTime[k] = (studyTime[k] || 0) + 15;
  try { localStorage.setItem(TIME_KEY, JSON.stringify(studyTime)); } catch (e) { /* sin espacio */ }
}, 15000);

function studiedMinutes(from, to) {
  let secs = 0;
  Object.entries(studyTime).forEach(([k, v]) => { if (k >= from && k <= to) secs += v; });
  return Math.round(secs / 60);
}

function fmtMin(m) {
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}

function renderHoy() {
  const el = $('#view-hoy');
  if (!state.profile) { el.innerHTML = ''; return; }
  const today = new Date();
  const plan = buildPlan();
  const week = weekForDate(plan, today);
  const dp = dayPlan(today);
  const tasks = withDone(dp);
  const doneCount = tasks.filter((t) => t.done).length;
  const lastTest = state.tests[state.tests.length - 1];
  const studied = studiedMinutes(dp.from, dp.to);
  const pct = dp.goal ? Math.min(100, Math.round((studied / dp.goal) * 100)) : 0;

  let lastSection = null;
  const rows = tasks.map((t, i) => {
    let head = '';
    if (t.section && t.section !== lastSection) {
      head = `<p class="eyebrow" style="margin:14px 0 2px">${esc(t.section)}</p>`;
      lastSection = t.section;
    }
    return `${head}<div class="task ${t.done ? 'done' : ''}" data-i="${i}">
      <button class="check" aria-label="Marcar como hecha">${t.done ? '✓' : ''}</button>
      <div class="task-body"><div class="task-label">${t.emoji || ''} ${esc(t.label)}</div>${t.minutes ? `<div class="muted small">~${t.minutes} min${CLAUDE_KINDS.includes(t.kind) && !state.settings.apiKey ? ' · en Claude: márcala al terminar' : ''}</div>` : ''}</div>
      ${t.action ? '<button class="btn small dark go">Empezar</button>' : ''}
    </div>`;
  }).join('');

  const title = dp.weekend ? 'Tu fin de semana' : dp.goal ? 'Tu clase de hoy' : 'Hoy';
  const goalHtml = dp.goal ? `<div style="margin:6px 0 4px"><div class="spread small"><span>${dp.weekend ? 'Llevas este fin de semana' : 'Llevas hoy'}: <b>${fmtMin(studied)}</b></span><span class="muted">objetivo ${fmtMin(dp.goal)}</span></div><div class="bar"><div style="width:${pct}%"></div></div></div>
    ${dp.weekend ? '<p class="muted small" style="margin:6px 0 0">Elige tú cuándo: haz la clase y los ejercicios a la hora que mejor te venga, el sábado o el domingo. Cuando acabes la lista, sigue con los ejercicios extra de abajo hasta llegar a tu objetivo.</p>' : ''}` : '<p class="muted small" style="margin:6px 0 0">Hoy no tienes clase. Si te apetece, escribe <b>hello there</b> en tu proyecto de Claude para conversar un rato (mira la pestaña Chat).</p>';

  const hello = today.getHours() < 14 ? 'Good morning' : today.getHours() < 21 ? 'Good afternoon' : 'Good evening';
  el.innerHTML = `
    <div class="card accent">
      <p class="muted">${esc(fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      <h2 style="margin:4px 0 6px">${hello}, ${esc(state.profile.name)}!</h2>
      <p class="muted" style="margin:0">${week ? `${PHASES[week.phase].name} · semana ${week.index + 1} de ${plan.totalWeeks}` : 'Fuera del periodo del plan'}</p>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${streak()}🔥</b><span>días seguidos</span></div>
      <div class="kpi"><b>${totalHours().toFixed(1)}h</b><span>estudiadas</span></div>
      <div class="kpi"><b>${lastTest ? lastTest.scale : '—'}</b><span>${lastTest ? esc(scaleToLabel(lastTest.scale)) : 'sin evaluar'}</span></div>
    </div>
    <div class="card">
      <div class="spread"><h3>${title}</h3>${tasks.length ? `<span class="tag ${doneCount === tasks.length ? 'ok' : ''}">${doneCount}/${tasks.length}</span>` : ''}</div>
      ${goalHtml}
      <div class="tasks">${rows || '<p class="muted">No hay tareas para hoy.</p>'}</div>
    </div>
    ${dp.weekend ? extraExercisesCard() : ''}
    ${hoursNotice(plan)}
    <div class="card">
      <h3>¿Te sobra tiempo?</h3>
      <div class="grid2">
        <button class="tile" data-go="tutor"><span class="emoji">💬</span><b>Conversar</b><span class="muted">Tema de hoy en Claude (gratis)</span></button>
        <button class="tile" data-go="vocab"><span class="emoji">🃏</span><b>Tarjetas</b><span class="muted">${dueCards().length} pendientes de repaso</span></button>
      </div>
    </div>`;

  $$('.task', el).forEach((row) => {
    const t = tasks[Number(row.dataset.i)];
    $('.check', row).onclick = () => {
      if (t.kind === 'placement' || t.kind === 'exam') return;
      state.manualDone[t.key] = !t.done;
      save();
      renderHoy();
    };
    const go = $('.go', row);
    if (go) go.onclick = t.action;
  });
  $$('[data-extra]', el).forEach((b) => (b.onclick = EXTRA_ACTIONS[b.dataset.extra]));
  $('[data-go="tutor"]', el).onclick = () => show('chat');
  $('[data-go="vocab"]', el).onclick = () => startVocab();
}

// Ejercicios ilimitados para seguir estudiando el fin de semana
const EXTRA_ACTIONS = {
  drill: () => startDrill(20),
  uoe: () => startUoePart(Math.floor(Math.random() * 4) + 1),
  listening: () => startListening(),
  dictation: () => startDictation(),
  writing: () => startWriting(),
  vocab: () => startVocab(),
  free: () => openInClaude('hello there'),
  exam: () => openInClaude(`Speaking Part ${Math.floor(Math.random() * 4) + 1}. Let's start.`)
};
function extraExercisesCard() {
  const items = [
    ['drill', '🧠', 'Sesión de gramática (20 preguntas)'], ['uoe', '🧩', 'Use of English (parte al azar)'],
    ['listening', '👂', 'Listening'], ['dictation', '🎧', 'Otro dictado'],
    ['writing', '✍️', 'Otro writing (corrígelo en Claude)'], ['vocab', '🃏', 'Tarjetas de vocabulario'],
    ['free', '💬', 'Conversación en Claude'], ['exam', '🎓', 'Speaking en Claude (usa el modo voz)']
  ];
  return `<div class="card"><h3>🔁 Ejercicios extra (ilimitados)</h3><p class="muted small">Para seguir hasta completar tus horas del fin de semana. Las preguntas se mezclan cada vez y priorizan las que no has visto.</p>
    <div class="grid2">${items.map(([id, e, t]) => `<button class="tile" data-extra="${id}"><span class="emoji">${e}</span><b>${t}</b></button>`).join('')}</div></div>`;
}

// Aviso honesto: ¿da tiempo con las horas que tienes?
function hoursNotice(plan) {
  if (!plan || !state.profile.level) return '';
  const lvl = state.profile.level;
  const needed = Math.max(0, HOURS_TO_REACH.C1 - (HOURS_TO_REACH[lvl] || HOURS_TO_REACH.B1));
  const daysLeft = Math.max(0, daysBetween(new Date(), plan.exam));
  const perWeek = weeklyMinutes(schedule());
  const available = Math.round((daysLeft / 7) * (perWeek / 60));
  if (lvl === 'C1' || lvl === 'C2') {
    return `<div class="notice">✅ Tu nivel ya está en C1. El plan se centra en técnica de examen para que llegues con margen (objetivo: 190+).</div>`;
  }
  const ok = available >= needed;
  return `<div class="notice ${ok ? '' : 'warn'}">${ok ? '✅' : '⚠️'} Para pasar de <b>${lvl}</b> a <b>C1</b> se suelen necesitar unas <b>${needed} horas</b> de estudio guiado. Con tu horario (${fmtMin(perWeek)} a la semana) te quedan unas <b>${available} horas</b> hasta el examen.${ok ? ' ¡Vas bien!' : ' Considera añadir horas en ⚙️ Ajustes o elegir una convocatoria posterior.'}</div>`;
}

/* ==========================================================
   9. Pantalla PLAN (cronograma)
   ========================================================== */

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function scheduleSummary(sch) {
  const days = sch.classDays.slice().sort().map((d) => DAY_NAMES[d]);
  const parts = [`Clases de ${fmtMin(sch.classMinutes)} los ${days.join(' y ')}`, `fin de semana ${fmtMin(sch.weekendMinutes)} entre clase y ejercicios, cuando te venga bien`];
  if (sch.chat) parts.push('sesiones de gramática en el Chat lunes, martes y jueves a las 7:40 (15 min) y miércoles y viernes a las 8:00 (20 min)');
  return parts.join(' · ') + '.';
}

function renderPlan() {
  const el = $('#view-plan');
  const plan = buildPlan();
  if (!plan) { el.innerHTML = ''; return; }
  const today = new Date();
  const cur = weekForDate(plan, today);
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const weekday = [1, 2, 3, 4, 5, 6, 0];
  const sch = schedule();

  let html = `<h2>Tu cronograma</h2>
    <div class="card"><p>Del <b>${fmtDate(plan.start, { day: 'numeric', month: 'long' })}</b> al examen el <b>${fmtDate(plan.exam, { day: 'numeric', month: 'long', year: 'numeric' })}</b>: ${plan.totalWeeks} semanas, unas ${fmtMin(weeklyMinutes(sch))} de estudio a la semana.</p>
    <p class="muted small" style="margin:0">${scheduleSummary(sch)}</p></div>`;

  [1, 2, 3].forEach((ph) => {
    const ws = plan.weeks.filter((w) => w.phase === ph);
    if (!ws.length) return;
    html += `<div class="phase"><h3>${PHASES[ph].name}</h3><p class="muted">${PHASES[ph].desc} (${ws.length} semanas)</p></div>`;
    ws.forEach((w) => {
      const isCur = cur && cur.index === w.index;
      const past = w.end < parseDate(dateKey(today));
      const lessonsTxt = w.lessons.map((id) => LESSONS.find((l) => l.id === id).title).join(', ');
      const wt = WRITING_TASKS.find((t) => t.id === w.writing);
      const sp = SPEAKING_PARTS.find((s) => s.id === w.speaking);
      const days = weekday.map((wd) => {
        const d = addDays(w.start, (wd + 6) % 7);
        const t = withDone(dayPlan(d));
        const done = t.length && t.every((x) => x.done);
        return `<span title="${esc(t.map((x) => x.label).join(' · '))}">${dayNames[wd]}${done ? '✓' : ''}</span>`;
      }).join(' ');
      html += `<details class="week ${isCur ? 'current' : ''} ${past ? 'past' : ''}" ${isCur ? 'open' : ''}>
        <summary><span>Semana ${w.index + 1} · ${fmtDate(w.start)}–${fmtDate(w.end)}</span>
        <span>${w.test === 'eval' ? '<span class="tag warn">Evaluación</span>' : w.test === 'mock' ? '<span class="tag bad">Simulacro</span>' : ''}${w.isLast ? '<span class="tag ok">Examen</span>' : ''}${isCur ? ' <span class="tag ok">Ahora</span>' : ''}</span></summary>
        <ul>
          ${lessonsTxt ? `<li>📚 Clases: ${esc(lessonsTxt)}</li>` : '<li>🔄 Repaso de tus puntos débiles (mira Progreso)</li>'}
          <li>🧩 Use of English: Part ${w.uoePart} y Part 4</li>
          <li>✍️ Writing: ${esc(wt.genre)}</li>
          <li>🗣️ Speaking: ${esc(sp.name)}</li>
          ${w.test === 'eval' ? '<li>📝 Fin de semana: evaluación mensual</li>' : ''}
          ${w.test === 'mock' ? '<li>🏁 Fin de semana: simulacro cronometrado</li>' : ''}
          ${w.isLast ? '<li>🎓 Semana del examen: solo repaso ligero, vocabulario y conversación</li>' : ''}
        </ul>
        <p class="muted small" style="margin:8px 0 0">${days}</p>
      </details>`;
    });
  });
  el.innerHTML = html;
}

/* ==========================================================
   10. Pantalla CLASES
   ========================================================== */

function renderClases() {
  const el = $('#view-clases');
  el.innerHTML = `<h2>Clases</h2>
    <p class="muted">Cada clase tiene teoría en español, ejemplos, errores típicos y ejercicios corregidos al momento. Puedes repetirlas las veces que quieras.</p>
    <div class="stack">${LESSONS.map((l) => {
      const best = state.lessons[l.id];
      const tag = best == null ? '<span class="tag">Pendiente</span>' : `<span class="tag ${best >= 0.8 ? 'ok' : best >= 0.6 ? 'warn' : 'bad'}">${Math.round(best * 100)}%</span>`;
      return `<button class="tile" data-id="${l.id}"><div class="spread"><span class="muted small">${l.skill === 'grammar' ? 'Gramática' : l.skill === 'vocab' ? 'Vocabulario' : 'Writing'}</span>${tag}</div><b>${esc(l.title)}</b><span class="muted">${esc(l.summary)}</span></button>`;
    }).join('')}</div>`;
  $$('.tile', el).forEach((b) => (b.onclick = () => openLesson(b.dataset.id)));
}

function openLesson(id) {
  const l = LESSONS.find((x) => x.id === id);
  const body = activity(esc(l.title), 'clases');
  body.innerHTML = `
    <div class="card"><p class="muted">${esc(l.summary)}</p>
      <ul class="theory">${l.theory.map((t) => `<li>${t}</li>`).join('')}</ul>
      <h3>Errores típicos</h3><ul class="mistakes">${l.mistakes.map((m) => `<li>${m}</li>`).join('')}</ul>
      <div class="row"><button class="btn small" id="askTutor">💬 Clase con el profesor IA</button><button class="btn small" id="moreAi">✨ Más ejercicios con IA</button></div>
    </div>
    <h3>Practica</h3><div id="lessonQuiz"></div><div id="aiQuiz"></div>`;
  renderQuiz($('#lessonQuiz', body), l.exercises, {
    onDone: (c, t) => {
      const pct = c / t;
      state.lessons[id] = Math.max(state.lessons[id] || 0, pct);
      logActivity('lesson', pct, l.id);
      $('#lessonQuiz .quiz-result', body).innerHTML = resultCard(c, t);
    }
  });
  $('#askTutor', body).onclick = () => openTutor('lesson', l.title);
  $('#moreAi', body).onclick = () => aiExercises($('#aiQuiz', body), `the grammar/vocabulary point "${l.title}" (${l.summary})`, 'lesson');
}

// Genera 6 ejercicios nuevos con la IA sobre un tema
async function aiExercises(container, topic, kind) {
  if (!state.settings.apiKey) { needKey(container); return; }
  container.innerHTML = '<div class="card"><p class="muted">✨ Preparando ejercicios nuevos…</p></div>';
  try {
    const data = await askJson(state.settings, {
      system: 'You write high-quality Cambridge C1 Advanced practice questions. Every question must have exactly one correct option; the three distractors must be clearly wrong for a C1 examiner. Explanations in Spanish, short.',
      prompt: `Write 6 multiple-choice gap-fill questions (4 options each) practising ${topic}. The student is a Spanish speaker at about ${currentLevel() || 'B2'} level aiming for C1. Use ___ for the gap.`,
      schema: EXERCISES_SCHEMA,
      effort: 'low'
    });
    const items = data.exercises.filter((e) => e.options.length === 4 && e.answer >= 0 && e.answer < 4).map((e) => ({ type: 'mc', ...e }));
    const wrap = document.createElement('div');
    container.innerHTML = '<h3>Ejercicios extra (IA)</h3>';
    container.appendChild(wrap);
    renderQuiz(wrap, items, {
      onDone: (c, t) => {
        logActivity(kind, c / t, 'IA: ' + topic.slice(0, 60));
        $('.quiz-result', wrap).innerHTML = resultCard(c, t);
      }
    });
  } catch (e) {
    container.innerHTML = `<div class="notice warn">${esc(e.message)}</div>`;
  }
}

function needKey(container) {
  container.innerHTML = `<div class="notice warn">Esta parte usa la IA (Claude). Añade tu clave de API en <b>⚙️ Ajustes</b> para activarla. <button class="btn small" id="openSettingsInline">Abrir ajustes</button></div>`;
  $('#openSettingsInline', container).onclick = openSettings;
}

/* ==========================================================
   11. Pantalla PRÁCTICA
   ========================================================== */

function renderPractica() {
  const el = $('#view-practica');
  const tiles = [
    ['uoe1', '🧩', 'Use of English · Part 1', 'Multiple-choice cloze: colocaciones y matices de vocabulario'],
    ['uoe2', '🧩', 'Use of English · Part 2', 'Open cloze: preposiciones, conectores, auxiliares'],
    ['uoe3', '🧩', 'Use of English · Part 3', 'Word formation: prefijos y sufijos'],
    ['uoe4', '🔁', 'Use of English · Part 4', 'Key word transformations'],
    ['dictation', '🎧', 'Dictado', 'Escucha y escribe frases de nivel B2–C2'],
    ['listening', '👂', 'Listening', 'Escucha un texto y responde (2 escuchas, como en el examen)'],
    ['reading', '📖', 'Reading (IA)', 'Textos nuevos tipo examen con preguntas'],
    ['writing', '✍️', 'Writing', 'Essay, report, proposal, review, letter… corregido con criterios Cambridge'],
    ['vocab', '🃏', 'Vocabulario', 'Tarjetas con repaso espaciado'],
    ['eval', '📝', 'Evaluación', 'Test mixto que estima tu nota en la escala Cambridge'],
    ['mock', '🏁', 'Simulacro', 'Examen cronometrado: Use of English + Listening + Writing'],
    ['placement', '🎯', 'Test de nivel', 'Vuelve a medir tu nivel MCER']
  ];
  el.innerHTML = `<h2>Práctica</h2><div class="grid2">${tiles.map(([id, e, t, d]) => `<button class="tile" data-id="${id}"><span class="emoji">${e}</span><b>${t}</b><span class="muted">${d}</span></button>`).join('')}</div>`;
  const actions = {
    uoe1: () => startUoePart(1), uoe2: () => startUoePart(2), uoe3: () => startUoePart(3), uoe4: () => startUoePart(4),
    dictation: startDictation, listening: startListening, reading: startReading, writing: () => startWriting(),
    vocab: startVocab, eval: startEvaluation, mock: startMock, placement: startPlacement
  };
  $$('.tile', el).forEach((b) => (b.onclick = actions[b.dataset.id]));
}

/* ---------- Use of English ---------- */

function startUoePart(part) {
  const names = { 1: 'Multiple-choice cloze', 2: 'Open cloze', 3: 'Word formation', 4: 'Key word transformations' };
  const tips = {
    1: 'Lee el texto entero primero. Fíjate en la palabra que va detrás del hueco: muchas respuestas dependen de colocaciones fijas (draw a conclusion, bear in mind…).',
    2: 'Una sola palabra por hueco. Suelen ser preposiciones, artículos, pronombres relativos, auxiliares y conectores.',
    3: 'Decide primero la categoría (sustantivo, adjetivo, verbo, adverbio) y luego si el sentido pide negativo o plural.',
    4: 'Entre 3 y 6 palabras, incluida la palabra clave, que NO puedes cambiar. Cada respuesta vale 2 puntos en el examen.'
  };
  const body = activity(`Part ${part} · ${names[part]}`, 'practica');
  body.innerHTML = `<div class="notice">💡 ${tips[part]}</div><div id="uoeArea"></div><div class="row" style="margin-top:12px"><button class="btn small" id="aiMore">✨ Generar más con IA</button></div><div id="aiArea"></div>`;
  const area = $('#uoeArea', body);
  if (part === 4) {
    const items = pick(UOE.part4, 6);
    renderQuiz(area, items, { onDone: (c, t) => { logActivity('uoe4', c / t, 'Part 4'); $('.quiz-result', area).innerHTML = resultCard(c, t); } });
  } else {
    const list = UOE['part' + part];
    const data = list[Math.floor(Math.random() * list.length)];
    renderExamText(area, part, data, { onDone: (c, t) => logActivity('uoe', c / t, `Part ${part}: ${data.title}`) });
  }
  const topics = {
    1: 'C1 collocations, phrasal verbs and fixed phrases (Use of English Part 1 style)',
    2: 'grammar words for open cloze: prepositions, relative pronouns, auxiliaries, linkers (Use of English Part 2 style)',
    3: 'word formation with prefixes and suffixes (Use of English Part 3 style, give the base word in capitals inside the question)',
    4: 'C1 grammar structures commonly tested in key word transformations (passives, inversion, conditionals, reporting verbs)'
  };
  $('#aiMore', body).onclick = () => aiExercises($('#aiArea', body), topics[part], part === 4 ? 'uoe4' : 'uoe');
}

/* ---------- Dictado ---------- */

function tokens(s) {
  return norm(s).replace(/'/g, '').split(' ').filter(Boolean);
}

// Compara palabra a palabra (subsecuencia común más larga)
function wordDiff(expected, typed) {
  const a = tokens(expected);
  const b = tokens(typed);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push(`<span class="hit">${esc(a[i])}</span>`); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(`<span class="miss">${esc(a[i])}</span>`); i++; }
    else { out.push(`<span class="extra">${esc(b[j])}</span>`); j++; }
  }
  while (i < a.length) out.push(`<span class="miss">${esc(a[i++])}</span>`);
  while (j < b.length) out.push(`<span class="extra">${esc(b[j++])}</span>`);
  return { html: out.join(' '), score: a.length ? dp[0][0] / a.length : 0 };
}

function startDictation() {
  const body = activity('Dictado', 'practica');
  const lvl = currentLevel();
  const pool = DICTATIONS.filter((d) => (lvl === 'C1' || lvl === 'C2' ? d.level !== 'B2' : d.level !== 'C2'));
  const items = pick(pool, 5);
  let idx = 0;
  const scores = [];
  cleanupActivity = stopSpeaking;

  function step() {
    if (idx >= items.length) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      logActivity('dictation', avg, `${items.length} frases`);
      body.innerHTML = resultCard(Math.round(avg * 100), 100, '<p class="muted">Puntuación media por palabras acertadas.</p><button class="btn primary" id="again">Otro dictado</button>');
      $('#again', body).onclick = startDictation;
      return;
    }
    const item = items[idx];
    body.innerHTML = `<div class="card"><div class="spread"><span class="muted">Frase ${idx + 1} de ${items.length}</span><span class="tag">${item.level}</span></div>
      <p>Escucha y escribe exactamente lo que oyes. Puedes repetir el audio.</p>
      <div class="row"><button class="btn dark" id="play">▶ Escuchar</button><button class="btn" id="slow">🐢 Más lento</button></div>
      <label class="field" for="dictIn">Tu transcripción</label><textarea id="dictIn" style="min-height:80px" autocapitalize="sentences" spellcheck="false"></textarea>
      <button class="btn primary block" id="check" style="margin-top:10px">Comprobar</button><div id="dictRes"></div></div>`;
    $('#play', body).onclick = () => speak(item.text);
    $('#slow', body).onclick = () => speak(item.text, 0.7);
    $('#check', body).onclick = () => {
      const r = wordDiff(item.text, $('#dictIn', body).value);
      scores.push(r.score);
      $('#dictRes', body).innerHTML = `<div class="feedback ${r.score >= 0.9 ? 'ok' : 'bad'}">${Math.round(r.score * 100)}% de palabras correctas</div>
        <p class="diff" style="margin-top:10px">${r.html}</p><p class="muted small">Verde: bien · Rojo: faltó o mal escrita · Tachado: sobraba.</p>
        <p><b>Original:</b> ${esc(item.text)}</p><button class="btn primary" id="next">Siguiente →</button>`;
      $('#check', body).classList.add('hidden');
      $('#next', body).onclick = () => { idx++; step(); };
    };
    setTimeout(() => speak(item.text), 300);
  }
  step();
}

/* ---------- Listening ---------- */

function startListening(given) {
  const body = activity('Listening', 'practica');
  cleanupActivity = stopSpeaking;
  const data = given || LISTENINGS[Math.floor(Math.random() * LISTENINGS.length)];
  let plays = 0;
  body.innerHTML = `<div class="card"><h3>${esc(data.title)}</h3>
    <p class="muted">Como en el examen, puedes escucharlo <b>dos veces</b>. Lee antes las preguntas.</p>
    <div class="row"><button class="btn dark" id="play">▶ Escuchar (<span id="left">2</span> restantes)</button><button class="btn ghost small" id="stop">■ Parar</button></div></div>
    <div id="lq"></div><div id="transcript"></div>
    <div class="row" style="margin-top:12px"><button class="btn small" id="aiListen">✨ Nuevo listening con IA</button></div>`;
  $('#play', body).onclick = () => {
    if (plays >= 2) return;
    plays++;
    $('#left', body).textContent = String(2 - plays);
    if (plays >= 2) $('#play', body).disabled = true;
    speak(data.text);
  };
  $('#stop', body).onclick = stopSpeaking;
  const items = data.questions.map((q) => ({ type: 'mc', ...q }));
  renderQuiz($('#lq', body), items, {
    onDone: (c, t) => {
      logActivity('listening', c / t, data.title);
      $('#lq .quiz-result', body).innerHTML = resultCard(c, t);
      $('#transcript', body).innerHTML = `<div class="card"><h3>Transcripción</h3><p>${esc(data.text)}</p><button class="btn small" id="replay">▶ Escuchar leyendo</button></div>`;
      $('#replay', body).onclick = () => speak(data.text);
    }
  });
  $('#aiListen', body).onclick = async () => {
    const btn = $('#aiListen', body);
    if (!state.settings.apiKey) { needKey($('#transcript', body)); return; }
    btn.disabled = true;
    btn.textContent = '✨ Preparando…';
    try {
      const d = await aiPassage('listening');
      startListening(d);
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = '✨ Nuevo listening con IA';
    }
  };
}

async function aiPassage(kind) {
  const topics = ['science', 'work and careers', 'the environment', 'psychology', 'technology', 'travel and culture', 'education', 'health', 'urban life', 'the arts'];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const prompt = kind === 'listening'
    ? `Write a C1 Advanced style listening script about ${topic}: a monologue or interview extract of about 220 words, natural spoken British English. Then 4 multiple-choice questions (4 options, one correct) testing attitude, opinion and detail, like C1 Advanced Listening Part 3.`
    : `Write a C1 Advanced Reading Part 5 style text about ${topic}: about 450 words from a magazine or non-fiction book, with opinion and implication. Then 6 multiple-choice questions (4 options, one correct) testing detail, opinion, attitude, purpose and implication.`;
  const data = await askJson(state.settings, {
    system: 'You write authentic Cambridge C1 Advanced exam materials. Questions must have exactly one defensible answer. Explanations in Spanish.',
    prompt,
    schema: READING_SCHEMA,
    effort: 'low'
  });
  data.questions = data.questions.filter((q) => q.options.length === 4 && q.answer >= 0 && q.answer < 4);
  return data;
}

/* ---------- Reading ---------- */

function startReading() {
  const body = activity('Reading', 'practica');
  if (!state.settings.apiKey) {
    body.innerHTML = `<div class="card"><h3>Reading gratis en Claude</h3>
      <p class="muted">Claude te prepara un texto nuevo tipo examen con sus preguntas y luego te corrige. Pulsa el botón, pega el mensaje en tu proyecto y responde allí.</p>
      <button class="btn primary block" id="readClaude">Abrir reading en Claude</button>
      <button class="btn block ghost" id="readDone" style="margin-top:6px">✓ Ya lo he hecho</button></div>`;
    $('#readClaude', body).onclick = () => openInClaude('Reading: give me a C1 Advanced Reading Part 5 text (about 500 words, from a magazine or non-fiction book) with 6 multiple-choice questions. Wait for my answers before correcting them.');
    $('#readDone', body).onclick = () => { logActivity('reading', null, 'Reading en Claude'); toast('¡Apuntado!'); show('hoy'); };
    return;
  }
  body.innerHTML = '<div class="card"><p class="muted">✨ Preparando un texto nuevo tipo examen (Part 5)… tarda unos segundos.</p></div>';
  aiPassage('reading').then((data) => {
    body.innerHTML = `<div class="notice">⏱️ En el examen tienes unos 15 minutos para esta parte. Lee primero el texto completo y luego las preguntas.</div>
      <div class="card"><h3>${esc(data.title)}</h3>${data.text.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join('')}</div><div id="rq"></div>`;
    const items = data.questions.map((q) => ({ type: 'mc', ...q }));
    renderQuiz($('#rq', body), items, {
      onDone: (c, t) => { logActivity('reading', c / t, data.title); $('#rq .quiz-result', body).innerHTML = resultCard(c, t); }
    });
  }).catch((e) => {
    body.innerHTML = `<div class="notice warn">${esc(e.message)}</div>`;
  });
}

/* ---------- Writing ---------- */

function countWords(t) {
  return (t.trim().match(/\S+/g) || []).length;
}

function startWriting(taskId) {
  const body = activity('Writing', 'practica');
  const task = WRITING_TASKS.find((t) => t.id === taskId);
  if (!task) {
    body.innerHTML = `<p class="muted">En el examen hay 2 tareas de 90 minutos en total: la Part 1 (essay) es obligatoria y en la Part 2 eliges entre email/carta, propuesta, informe o review.</p>
      <div class="stack">${WRITING_TASKS.map((t) => {
        const done = state.writings.filter((w) => w.taskId === t.id).length;
        return `<button class="tile" data-id="${t.id}"><div class="spread"><span class="muted small">Part ${t.part}</span>${done ? `<span class="tag ok">${done} hecho${done > 1 ? 's' : ''}</span>` : ''}</div><b>${esc(t.genre)}</b><span class="muted">${esc(t.prompt.split('\n')[0].slice(0, 120))}…</span></button>`;
      }).join('')}</div>`;
    $$('.tile', body).forEach((b) => (b.onclick = () => startWriting(b.dataset.id)));
    return;
  }
  const draftKey = 'academia.draft.' + task.id;
  let draft = '';
  try { draft = localStorage.getItem(draftKey) || ''; } catch (e) { /* sin borrador */ }
  body.innerHTML = `<div class="card"><div class="spread"><span class="tag">Part ${task.part} · ${esc(task.genre)}</span><span class="muted small">${task.words} palabras</span></div>
      <div class="prompt" style="margin-top:10px">${esc(task.prompt)}</div></div>
    <div class="card">
      <div class="spread"><span>Palabras: <span class="wordcount" id="wc">0</span></span><span class="row"><span class="timer" id="timer">45:00</span><button class="btn small" id="timerBtn">▶ Cronómetro</button></span></div>
      <textarea id="wtext" style="min-height:280px;margin-top:8px" placeholder="Escribe aquí tu texto en inglés…">${esc(draft)}</textarea>
      <p class="muted small">El borrador se guarda solo mientras escribes.</p>
      <button class="btn primary block" id="freeCorrect">Corregir gratis en Claude</button>
      <button class="btn block" id="correct" style="margin-top:6px">Corregir aquí con la API (de pago)</button>
      <button class="btn block ghost" id="self" style="margin-top:6px">Autoevaluarme sin IA</button>
    </div><div id="wres"></div>`;
  const ta = $('#wtext', body);
  const wc = $('#wc', body);
  const upd = () => {
    const n = countWords(ta.value);
    wc.textContent = n;
    wc.style.color = n >= 220 && n <= 260 ? 'var(--ok)' : n > 260 ? 'var(--bad)' : '';
    try { localStorage.setItem(draftKey, ta.value); } catch (e) { /* ignorar */ }
  };
  ta.oninput = upd;
  upd();

  let secs = 45 * 60;
  let iv = null;
  $('#timerBtn', body).onclick = () => {
    if (iv) { clearInterval(iv); iv = null; $('#timerBtn', body).textContent = '▶ Cronómetro'; return; }
    $('#timerBtn', body).textContent = '⏸ Pausar';
    iv = setInterval(() => {
      secs = Math.max(0, secs - 1);
      $('#timer', body).textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
      if (secs === 0) { clearInterval(iv); iv = null; toast('⏰ ¡Tiempo! En el examen tendrías que entregar ya.'); }
    }, 1000);
  };
  cleanupActivity = () => { if (iv) clearInterval(iv); };

  $('#freeCorrect', body).onclick = () => {
    const text = ta.value.trim();
    if (countWords(text) < 80) { toast('Escribe al menos 80 palabras antes de corregir'); return; }
    logActivity('writing', null, task.genre + ' (corregido en Claude)');
    openInClaude(`Please mark my C1 Advanced Writing (Part ${task.part}, ${task.genre}, ${task.words} words).\n\nTASK:\n${task.prompt}\n\nMY ANSWER (${countWords(text)} words):\n${text}`);
  };

  $('#self', body).onclick = () => {
    const checks = ['He respondido a TODOS los puntos de la tarea', 'El registro (formal/informal) es adecuado al lector', 'Hay párrafos claros con una idea principal cada uno', 'He usado conectores variados (however, moreover, whereas…)', 'He usado al menos 2 estructuras C1 (inversión, cleft, condicional mixta…)', 'Vocabulario preciso, sin repetir palabras básicas (good, bad, thing…)', 'Está entre 220 y 260 palabras', 'He revisado tiempos verbales, artículos y preposiciones'];
    $('#wres', body).innerHTML = `<div class="card"><h3>Autoevaluación</h3>${checks.map((c, i) => `<label style="display:flex;gap:8px;margin:6px 0"><input type="checkbox" data-i="${i}"> ${c}</label>`).join('')}<button class="btn primary" id="selfSave">Guardar</button></div>`;
    $('#selfSave', body).onclick = () => {
      const n = $$('#wres input:checked', body).length;
      logActivity('writing', n / checks.length, task.genre + ' (autoevaluado)');
      toast('Guardado. Para una corrección real, usa la IA.');
    };
  };

  $('#correct', body).onclick = async () => {
    const text = ta.value.trim();
    if (countWords(text) < 80) { toast('Escribe al menos 80 palabras antes de corregir'); return; }
    if (!state.settings.apiKey) { needKey($('#wres', body)); return; }
    const btn = $('#correct', body);
    btn.disabled = true;
    btn.textContent = 'Corrigiendo… (30–60 s)';
    try {
      const r = await askJson(state.settings, {
        system: writingSystem(),
        prompt: `TASK (C1 Advanced Writing Part ${task.part}, ${task.genre}, ${task.words} words):\n${task.prompt}\n\nCANDIDATE'S ANSWER (${countWords(text)} words):\n${text}`,
        schema: WRITING_SCHEMA,
        effort: 'medium'
      });
      const clamp = (x) => Math.max(0, Math.min(5, Math.round(x)));
      ['content', 'communicative', 'organisation', 'language'].forEach((k) => (r[k] = clamp(r[k])));
      const total = r.content + r.communicative + r.organisation + r.language;
      state.writings.push({ date: dateKey(), taskId: task.id, genre: task.genre, words: countWords(text), total, level: r.estimated_level, text });
      logActivity('writing', total / 20, task.genre);
      renderWritingResult($('#wres', body), r, total);
    } catch (e) {
      $('#wres', body).innerHTML = `<div class="notice warn">${esc(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Corregir con criterios Cambridge (IA)';
    }
  };
}

function renderWritingResult(el, r, total) {
  el.innerHTML = `<div class="card">
    <div class="spread"><div><div class="score-big">${total}/20</div><p class="muted">Nivel mostrado: <b>${esc(r.estimated_level)}</b> · ≈ ${pctToScale(total / 20)} en la escala Cambridge</p></div></div>
    <div class="criteria"><div><b>${r.content}</b><span>Content</span></div><div><b>${r.communicative}</b><span>Communicative</span></div><div><b>${r.organisation}</b><span>Organisation</span></div><div><b>${r.language}</b><span>Language</span></div></div>
    <p style="margin-top:12px">${esc(r.summary_es)}</p>
    <h3>👍 Puntos fuertes</h3><ul>${r.strengths_es.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    <h3>🎯 Para mejorar</h3><ul>${r.improvements_es.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    <h3>✏️ Errores</h3>${r.mistakes.length ? `<table><tr><th>Escribiste</th><th>Mejor</th><th>Por qué</th></tr>${r.mistakes.map((m) => `<tr><td><s>${esc(m.wrong)}</s></td><td><b>${esc(m.right)}</b></td><td class="muted">${esc(m.why_es)}</td></tr>`).join('')}</table>` : '<p class="muted">Sin errores destacables.</p>'}
    <h3 style="margin-top:12px">⭐ Versión modelo C1</h3><div class="model-text">${esc(r.improved_version)}</div></div>`;
}

/* ---------- Vocabulario con repaso espaciado (sistema Leitner) ---------- */

const BOX_DAYS = [0, 1, 3, 7, 14, 30];

function dueCards() {
  const today = dateKey();
  return VOCAB.filter(([term]) => state.srs[term] && state.srs[term].due <= today);
}

function startVocab() {
  const body = activity('Vocabulario', 'practica');
  const due = dueCards();
  const fresh = VOCAB.filter(([term]) => !state.srs[term]).slice(0, Math.max(0, 10 - due.length));
  const deck = shuffle(due.concat(fresh)).slice(0, 15);
  if (!deck.length) {
    body.innerHTML = '<div class="card"><p>🎉 No tienes tarjetas pendientes hoy. ¡Vuelve mañana!</p></div>';
    return;
  }
  let i = 0;
  let known = 0;
  function card() {
    if (i >= deck.length) {
      logActivity('vocab', known / deck.length, `${deck.length} tarjetas`);
      const learned = Object.values(state.srs).filter((s) => s.box >= 4).length;
      body.innerHTML = resultCard(known, deck.length, `<p class="muted">Tarjetas dominadas en total: ${learned} de ${VOCAB.length}.</p>`);
      return;
    }
    const [term, meaning] = deck[i];
    body.innerHTML = `<div class="card flash"><p class="muted small">${i + 1} / ${deck.length}</p><div class="term">${esc(term)}</div>
      <div class="meaning" id="mean"></div>
      <div class="row" style="justify-content:center;margin-top:16px"><button class="btn" id="say">🔊</button><button class="btn dark" id="reveal">Ver significado</button></div>
      <div class="row hidden" id="rate" style="justify-content:center;margin-top:12px"><button class="btn" id="no">✘ No lo sabía</button><button class="btn primary" id="yes">✔ Lo sabía</button></div>
      <p class="muted small" style="margin-top:12px">Truco: antes de ver la respuesta, inventa una frase en inglés con la expresión.</p></div>`;
    $('#say', body).onclick = () => speak(term);
    $('#reveal', body).onclick = () => {
      $('#mean', body).textContent = meaning;
      $('#reveal', body).classList.add('hidden');
      $('#rate', body).classList.remove('hidden');
    };
    const rate = (ok) => {
      const s = state.srs[term] || { box: 0 };
      s.box = ok ? Math.min(5, s.box + 1) : 1;
      s.due = dateKey(addDays(new Date(), BOX_DAYS[s.box]));
      state.srs[term] = s;
      if (ok) known++;
      save();
      i++;
      card();
    };
    $('#yes', body).onclick = () => rate(true);
    $('#no', body).onclick = () => rate(false);
  }
  card();
}

/* ---------- Repaso semanal ---------- */

function startReview(week) {
  const ids = week && week.lessons.length ? week.lessons : Object.keys(state.lessons);
  // Prioriza las clases con peor nota
  const pool = (ids.length ? ids : LESSONS.map((l) => l.id))
    .map((id) => LESSONS.find((l) => l.id === id))
    .sort((a, b) => (state.lessons[a.id] ?? 0) - (state.lessons[b.id] ?? 0))
    .slice(0, 3);
  const items = shuffle(pool.flatMap((l) => l.exercises)).slice(0, 10);
  const body = activity('Repaso', 'hoy');
  body.innerHTML = `<p class="muted">Mezcla de ejercicios de: ${pool.map((l) => esc(l.title)).join(', ')}.</p><div id="rv"></div>`;
  renderQuiz($('#rv', body), items, { onDone: (c, t) => { logActivity('review', c / t, 'Repaso'); $('#rv .quiz-result', body).innerHTML = resultCard(c, t); } });
}

/* ==========================================================
   12. Tests: nivel, evaluación mensual y simulacro
   ========================================================== */

function startPlacement() {
  const body = activity('Test de nivel', currentView === 'actividad' ? 'hoy' : currentView);
  body.innerHTML = `<div class="notice">25 preguntas de dificultad creciente (A2 → C2). No uses diccionario ni adivines al azar: si no lo sabes, déjala en blanco. Tardarás unos 15 minutos.</div><div id="pq"></div>`;
  const items = PLACEMENT.map((p) => ({ ...p }));
  renderQuiz($('#pq', body), items, {
    showExplain: false,
    submitLabel: 'Terminar test',
    onDone: (c, t, detail) => {
      // Un nivel se "aprueba" con 3 de 5. Tu nivel es el último aprobado
      // sin huecos (si fallas B1 pero aciertas C1 por suerte, no cuenta).
      let level = 'A1';
      const byLevel = {};
      for (const L of LEVELS) {
        const qs = detail.filter((d) => d.item.level === L);
        const ok = qs.filter((d) => d.ok).length;
        byLevel[L] = ok;
        if (ok >= 3 && (level === 'A1' ? L === 'A2' : LEVELS.indexOf(L) === LEVELS.indexOf(level) + 1)) level = L;
      }
      const ranges = { A1: [100, 119], A2: [120, 139], B1: [140, 159], B2: [160, 179], C1: [180, 199], C2: [200, 210] };
      const [lo, hi] = ranges[level];
      const next = LEVELS[LEVELS.indexOf(level) + 1];
      const frac = next ? Math.min(1, (byLevel[next] || 0) / 5) : 0.5;
      const scale = Math.round(lo + (hi - lo) * frac);
      state.tests.push({ date: dateKey(), type: 'placement', pct: c / t, scale, level, breakdown: byLevel });
      state.profile.level = level === 'A1' ? 'A2' : level;
      logActivity('placement', c / t, 'Nivel ' + level);
      $('#pq .quiz-result', body).innerHTML = `<div class="card"><p class="muted">Tu nivel estimado</p><div class="score-big">${level}</div>
        <p class="muted">≈ ${scale} en la escala Cambridge (C1 se aprueba con 180).</p>
        <table><tr>${LEVELS.map((L) => `<th>${L}</th>`).join('')}</tr><tr>${LEVELS.map((L) => `<td>${byLevel[L]}/5</td>`).join('')}</tr></table>
        <p style="margin-top:10px">Tu cronograma se ha ajustado a este nivel. Este test solo mide gramática y vocabulario: tu writing y speaking los iremos evaluando con las tareas semanales.</p>
        <button class="btn primary" id="toPlan">Ver mi plan</button></div>`;
      $('#toPlan', body).onclick = () => show('plan');
    }
  });
}

function startEvaluation() {
  const body = activity('Evaluación mensual', 'practica');
  // Prioriza las clases ya vistas; si aún no hay, usa todas
  const seen = LESSONS.filter((l) => state.lessons[l.id] != null);
  const lessonItems = pick((seen.length >= 3 ? seen : LESSONS).flatMap((l) => l.exercises), 8);
  const p1 = UOE.part1[Math.floor(Math.random() * UOE.part1.length)];
  const p3 = UOE.part3[Math.floor(Math.random() * UOE.part3.length)];
  const items = [
    ...lessonItems,
    ...pick(examTextToItems(1, p1), 4),
    ...pick(examTextToItems(3, p3), 4),
    ...pick(UOE.part4, 4)
  ];
  body.innerHTML = `<div class="notice">20 preguntas mezcladas (gramática, vocabulario, word formation y transformaciones). Al terminar verás tu puntuación estimada en la escala Cambridge.</div><div id="eq"></div>`;
  renderQuiz($('#eq', body), items, {
    submitLabel: 'Terminar evaluación',
    onDone: (c, t) => {
      const pct = c / t;
      const scale = pctToScale(pct);
      state.tests.push({ date: dateKey(), type: 'eval', pct, scale });
      logActivity('eval', pct, 'Evaluación mensual');
      $('#eq .quiz-result', body).innerHTML = resultCard(c, t, `<p>Puntuación estimada: <b>${scale}</b> — ${scaleToLabel(scale)}</p><p class="muted small">Revisa arriba las explicaciones de lo que has fallado y repite esas clases.</p>`);
    }
  });
}

function startMock() {
  const body = activity('Simulacro', 'practica');
  const p1 = UOE.part1[Math.floor(Math.random() * UOE.part1.length)];
  const p2 = UOE.part2[Math.floor(Math.random() * UOE.part2.length)];
  const p3 = UOE.part3[Math.floor(Math.random() * UOE.part3.length)];
  const p4 = pick(UOE.part4, 6);
  const lis = LISTENINGS[Math.floor(Math.random() * LISTENINGS.length)];
  const results = {};

  body.innerHTML = `<div class="notice">🏁 Simulacro reducido en condiciones de examen. Pon el cronómetro y no consultes nada.<br>
    <b>Bloque 1:</b> Use of English Parts 1–4 (≈ 30 min) · <b>Bloque 2:</b> Listening (≈ 10 min) · <b>Bloque 3:</b> Writing Part 1 (45 min, en la sección Writing).</div>
    <div class="card spread"><span class="timer" id="mtimer">00:00</span><button class="btn small" id="mstart">▶ Empezar cronómetro</button></div>
    <h3>Part 1</h3><div id="m1"></div><h3>Part 2</h3><div id="m2"></div><h3>Part 3</h3><div id="m3"></div><h3>Part 4</h3><div id="m4"></div>
    <h3>Listening</h3><div class="card"><p class="muted">Dos escuchas.</p><button class="btn dark" id="mplay">▶ Escuchar (<span id="mleft">2</span>)</button></div><div id="m5"></div>
    <div id="mres"></div>`;

  let secs = 0;
  let iv = null;
  $('#mstart', body).onclick = () => {
    if (iv) return;
    iv = setInterval(() => {
      secs++;
      $('#mtimer', body).textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    }, 1000);
  };
  cleanupActivity = () => { if (iv) clearInterval(iv); stopSpeaking(); };

  const finish = () => {
    const parts = ['p1', 'p2', 'p3', 'p4', 'lis'];
    if (!parts.every((p) => results[p])) return;
    if (iv) clearInterval(iv);
    // En el examen real la Part 4 vale doble: lo replicamos
    const uoeC = results.p1[0] + results.p2[0] + results.p3[0] + results.p4[0] * 2;
    const uoeT = results.p1[1] + results.p2[1] + results.p3[1] + results.p4[1] * 2;
    const uoeScale = pctToScale(uoeC / uoeT);
    const lisScale = pctToScale(results.lis[0] / results.lis[1]);
    const overall = Math.round((uoeScale + lisScale) / 2);
    state.tests.push({ date: dateKey(), type: 'mock', pct: (uoeC + results.lis[0]) / (uoeT + results.lis[1]), scale: overall, breakdown: { useOfEnglish: uoeScale, listening: lisScale } });
    logActivity('mock', uoeC / uoeT, 'Simulacro');
    $('#mres', body).innerHTML = `<div class="card"><h3>Resultado del simulacro</h3>
      <table><tr><th>Bloque</th><th>Escala</th><th>Nivel</th></tr>
      <tr><td>Use of English</td><td>${uoeScale}</td><td>${scaleToLabel(uoeScale)}</td></tr>
      <tr><td>Listening</td><td>${lisScale}</td><td>${scaleToLabel(lisScale)}</td></tr>
      <tr><td><b>Media</b></td><td><b>${overall}</b></td><td><b>${scaleToLabel(overall)}</b></td></tr></table>
      <p class="muted small" style="margin-top:8px">Tiempo: ${Math.floor(secs / 60)} min. Completa ahora un essay en Writing para tener la foto completa.</p>
      <button class="btn primary" id="toWriting">Ir al Writing Part 1</button></div>`;
    $('#toWriting', body).onclick = () => startWriting(['essay1', 'essay2', 'essay3'][Math.floor(Math.random() * 3)]);
  };

  renderExamText($('#m1', body), 1, p1, { onDone: (c, t) => { results.p1 = [c, t]; finish(); } });
  renderExamText($('#m2', body), 2, p2, { onDone: (c, t) => { results.p2 = [c, t]; finish(); } });
  renderExamText($('#m3', body), 3, p3, { onDone: (c, t) => { results.p3 = [c, t]; finish(); } });
  renderQuiz($('#m4', body), p4, { onDone: (c, t) => { results.p4 = [c, t]; finish(); } });
  let plays = 0;
  $('#mplay', body).onclick = () => {
    if (plays >= 2) return;
    plays++;
    $('#mleft', body).textContent = String(2 - plays);
    speak(lis.text);
  };
  renderQuiz($('#m5', body), lis.questions.map((q) => ({ type: 'mc', ...q })), { onDone: (c, t) => { results.lis = [c, t]; finish(); } });
}

/* ==========================================================
   12b. Pantalla CHAT (gratis, sin IA de pago)
   - Sesiones de gramática de 15/20 min en formato chat, con
     preguntas del banco de la academia y corrección al momento.
   - Recordatorios en el calendario del móvil.
   - Conversación con Claude en un Proyecto (incluido en tu cuenta).
   ========================================================== */

const CLAUDE_KINDS = ['claudeclass', 'tutorlesson', 'speaking'];
const QUESTIONS_FOR = { 15: 15, 20: 20 }; // ~1 minuto por pregunta

// Un tema de conversación para cada día del mes
const TOPICS = [
  'your morning routine', 'a trip you would love to take', 'technology at work', 'living in a big city',
  'food and eating habits', 'a book, film or series that made you think', 'staying healthy with a busy job',
  'friendship as we get older', 'artificial intelligence: opportunities and risks', 'learning languages',
  'money: saving and spending', 'climate change and what individuals can do', 'remote work vs the office',
  'social media: connection or distraction?', 'a person who has influenced you', 'your ideal job in ten years',
  'traditions and festivals in your region', 'what schools should teach', 'shopping online vs in person',
  'renting vs buying a home', 'music in your life', 'a difficult decision you made', 'tourism and local people',
  'sleep, stress and well-being', 'the future of transport', 'a skill you want to learn', 'fake news',
  'volunteering', 'what makes a good leader', 'how your city has changed', 'your plans for the weekend'
];
function topicOfDay(d = new Date()) {
  return TOPICS[d.getDate() - 1];
}

// Todas las preguntas del banco, cada una con un id para no repetirlas
function questionBank() {
  const bank = [];
  LESSONS.forEach((l) => l.exercises.forEach((ex, i) => bank.push({ ...ex, id: `L:${l.id}:${i}`, lesson: l.id })));
  UOE.part4.forEach((ex, i) => bank.push({ ...ex, id: `P4:${i}`, lesson: null }));
  [1, 2, 3].forEach((part) => UOE['part' + part].forEach((t, ti) =>
    examTextToItems(part, t).forEach((ex, k) => bank.push({ ...ex, id: `T${part}:${ti}:${k}`, lesson: null }))));
  return bank;
}

// Elige las preguntas: sobre todo de la gramática de esta semana,
// algo de repaso de semanas anteriores y algo de Use of English.
function pickDrill(n) {
  const plan = buildPlan();
  const focus = plan ? grammarFocus(plan, new Date()) : { current: LESSONS.slice(0, 2), review: [] };
  const seen = new Set(state.drillSeen || []);
  const bank = questionBank();
  const fresh = (list) => {
    const unseen = list.filter((q) => !seen.has(q.id));
    return shuffle(unseen.length >= list.length / 3 ? unseen : list);
  };
  const curIds = focus.current.map((l) => l.id);
  const revIds = focus.review.map((l) => l.id);
  const current = fresh(bank.filter((q) => curIds.includes(q.lesson)));
  const review = fresh(bank.filter((q) => revIds.includes(q.lesson)));
  const uoe = fresh(bank.filter((q) => !q.lesson));
  const nCur = Math.min(current.length, Math.round(n * 0.5));
  const nRev = Math.min(review.length, Math.round(n * 0.25));
  const chosen = [...current.slice(0, nCur), ...review.slice(0, nRev)];
  const rest = fresh(bank.filter((q) => !chosen.includes(q)));
  const uoeFirst = [...uoe, ...rest].filter((q, i, arr) => arr.indexOf(q) === i && !chosen.includes(q));
  return shuffle([...chosen, ...uoeFirst.slice(0, n - chosen.length)]);
}

function renderChat() {
  const el = $('#view-chat');
  if (!state.profile) { el.innerHTML = ''; return; }
  const today = new Date();
  const sch = schedule();
  const session = sch.chat && CHAT_SESSIONS[today.getDay()];
  const doneToday = state.log.some((e) => e.date === dateKey() && e.kind === 'drill');
  const project = state.settings.claudeProjectUrl;

  el.innerHTML = `<h2>Chat</h2>
    <div class="card">
      <h3>🧠 Sesión de gramática</h3>
      ${session
        ? `<p>Hoy toca a las <b>${session.time}</b>: ${session.minutes} minutos (${QUESTIONS_FOR[session.minutes]} preguntas) sobre la gramática de esta semana y repaso.</p>
           ${doneToday ? '<p class="tag ok">✓ Hecha hoy</p>' : ''}
           <button class="btn primary block" data-drill="${session.minutes}">${doneToday ? 'Hacer otra' : 'Empezar'} (${session.minutes} min)</button>`
        : '<p class="muted">Hoy no hay sesión programada. Si quieres, haz una extra:</p>'}
      <div class="row" style="margin-top:8px"><button class="btn small" data-drill="15">Extra de 15 min</button><button class="btn small" data-drill="20">Extra de 20 min</button></div>
    </div>

    <div class="card">
      <h3>🔔 Recordatorios</h3>
      <p class="muted small">Añade las sesiones a la agenda del móvil (Google Calendar, Calendario de iPhone…). Te avisará lunes, martes y jueves a las 7:40 y miércoles y viernes a las 8:00, hasta el día del examen. Al tocar el aviso se abre la app.</p>
      <button class="btn dark" id="icsBtn">📅 Añadir al calendario</button>
    </div>

    <div class="card">
      <h3>💬 Conversación con Claude <span class="tag ok">gratis</span></h3>
      <p>Tema de hoy: <b>${esc(topicOfDay(today))}</b></p>
      <p class="muted small">Se hace en la app de Claude, con tu cuenta (sin pagar la API). Escribe <b>hello there</b> para empezar y <b>bye</b> para terminar: te corrige todo lo que digas mal. En el móvil puedes usar el <b>modo voz</b> de Claude para practicar hablando.</p>
      ${project ? '' : `<details class="week" open><summary>Configúralo una vez (5 min)</summary>
        <ol class="small" style="padding-left:18px;margin:8px 0 0">
          <li>Abre <a href="https://claude.ai/projects" target="_blank" rel="noopener">claude.ai/projects</a> → <b>Create project</b> → llámalo <i>English teacher</i>.</li>
          <li>Pulsa el botón de abajo para copiar las instrucciones y pégalas en <b>Project instructions</b> del proyecto.</li>
          <li>Copia el enlace del proyecto (la dirección de la página) y pégalo en ⚙️ Ajustes → <i>Enlace a tu proyecto de Claude</i>.</li>
        </ol></details>`}
      <div class="row" style="margin-top:10px">
        <button class="btn small" id="copyInstr">📋 Copiar instrucciones del proyecto</button>
        <button class="btn primary" id="goClaude">Abrir Claude y decir hello there</button>
      </div>
    </div>

    <div class="card">
      <h3>🤖 Tutor dentro de la app <span class="tag">opcional · de pago</span></h3>
      <p class="muted small">Usa la API de Claude con tu propia clave (se paga aparte por uso). No hace falta: con el proyecto de Claude tienes lo mismo gratis.</p>
      <button class="btn small" id="paidTutor">Abrir tutor de la app</button>
    </div>`;

  $$('[data-drill]', el).forEach((b) => (b.onclick = () => startDrill(Number(b.dataset.drill))));
  $('#icsBtn', el).onclick = downloadIcs;
  $('#copyInstr', el).onclick = () => copyText(projectInstructions(), 'Instrucciones copiadas. Pégalas en el proyecto de Claude.');
  $('#goClaude', el).onclick = () => openInClaude('hello there');
  $('#paidTutor', el).onclick = () => openTutor('free');
}

/* ---------- Sesión de gramática en formato chat ---------- */

function startDrill(minutes) {
  const n = QUESTIONS_FOR[minutes] || minutes;
  const items = pickDrill(n);
  const body = activity(`🧠 Gramática · ${minutes} min`, 'chat');
  body.innerHTML = `<div class="spread small muted" style="margin-bottom:8px"><span id="dProg">Pregunta 1/${items.length}</span><span class="timer" id="dTimer">${minutes}:00</span></div>
    <div class="chat" id="dChat"></div>
    <div class="composer" id="dComposer"></div>`;
  const chatEl = $('#dChat', body);
  const composer = $('#dComposer', body);
  let idx = 0;
  let correct = 0;
  const wrong = [];
  const started = Date.now();

  const iv = setInterval(() => {
    const left = Math.max(0, minutes * 60 - Math.floor((Date.now() - started) / 1000));
    const t = $('#dTimer', body);
    if (t) t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }, 1000);
  cleanupActivity = () => clearInterval(iv);

  const say = (html, who = 'assistant') => {
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    div.innerHTML = html;
    chatEl.appendChild(div);
    div.scrollIntoView({ block: 'end', behavior: 'smooth' });
  };

  const hello = new Date().getHours() < 13 ? 'Good morning' : 'Hi';
  say(`${hello}, ${esc(state.profile.name)}! ☕ ${items.length} preguntas rápidas. Responde como si fuera WhatsApp: si fallas, te digo cómo se dice bien.`);

  function ask() {
    const q = items[idx];
    $('#dProg', body).textContent = `Pregunta ${idx + 1}/${items.length}`;
    let html = `<b>Q${idx + 1}/${items.length}</b><br>`;
    if (q.type === 'kwt') html += `${esc(q.q)}<br><b>Palabra clave: ${esc(q.key)}</b><br><i>${esc(q.start || '')} ______ ${esc(q.end)}</i><br><span class="muted small">Escribe solo lo que va en el hueco (2–5 palabras).</span>`;
    else if (q.type === 'wf') html += `${gapHtml(q.q)}<br><span class="muted small">Forma una palabra a partir de <b>${esc(q.base)}</b>.</span>`;
    else html += gapHtml(q.q);
    say(html);
    if (q.type === 'mc') {
      composer.innerHTML = `<div class="opts">${q.options.map((o, k) => `<button class="opt" data-k="${k}">${String.fromCharCode(97 + k)}) ${esc(o)}</button>`).join('')}</div>`;
      $$('.opt', composer).forEach((b) => (b.onclick = () => answer(Number(b.dataset.k), `${String.fromCharCode(97 + Number(b.dataset.k))}) ${q.options[Number(b.dataset.k)]}`)));
    } else {
      composer.innerHTML = `<div class="row"><input type="text" id="dIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Tu respuesta…" style="flex:1"><button class="btn dark" id="dSend">Enviar</button></div>`;
      const inp = $('#dIn', composer);
      const send = () => { if (inp.value.trim()) answer(inp.value, inp.value); };
      $('#dSend', composer).onclick = send;
      inp.onkeydown = (e) => { if (e.key === 'Enter') send(); };
      inp.focus();
    }
  }

  function answer(given, shown) {
    const q = items[idx];
    composer.innerHTML = '';
    say(esc(shown), 'user');
    const ok = checkItem(q, given);
    if (ok) correct++;
    else wrong.push(q);
    const right = q.type === 'kwt' ? `${q.start ? q.start + ' ' : ''}${q.answers[0]} ${q.end}`.trim() : correctText(q);
    const fill = q.type !== 'kwt' && q.q.includes('___') ? q.q.replace('___', `*${right}*`) : right;
    setTimeout(() => {
      say(`${ok ? '✅ <b>Correct!</b>' : '❌ <b>Not quite.</b>'}<span class="corr">✏️ Se dice: ${mdLite(fill)}${q.explain ? `<br>${esc(q.explain)}` : ''}</span>`);
      state.drillSeen = [...(state.drillSeen || []), q.id].slice(-200);
      idx++;
      if (idx < items.length) setTimeout(ask, 500);
      else setTimeout(finish, 500);
    }, 250);
  }

  function finish() {
    clearInterval(iv);
    const pct = correct / items.length;
    logActivity('drill', pct, `${minutes} min`);
    const lessonsToReview = [...new Set(wrong.map((q) => q.lesson).filter(Boolean))].map((id) => LESSONS.find((l) => l.id === id));
    say(`🏁 <b>${correct}/${items.length}</b> — ${pct >= 0.8 ? 'Excellent! 🎉' : pct >= 0.6 ? 'Good job! 👍' : 'Keep going, ¡se aprende fallando! 💪'}
      ${lessonsToReview.length ? `<br>Repasa: ${lessonsToReview.map((l) => `<a href="#" data-lesson="${l.id}">${esc(l.title)}</a>`).join(', ')}` : ''}
      <br>Have a great day! ☀️`);
    $$('[data-lesson]', chatEl).forEach((a) => (a.onclick = (e) => { e.preventDefault(); openLesson(a.dataset.lesson); }));
    composer.innerHTML = '<button class="btn primary block" id="dBack">Volver al Chat</button>';
    $('#dBack', composer).onclick = () => show('chat');
  }

  ask();
}

/* ---------- Recordatorios (.ics para el calendario) ---------- */

function icsDate(d, time) {
  return `${dateKey(d).replace(/-/g, '')}T${time.replace(':', '')}00`;
}

function downloadIcs() {
  const exam = parseDate(state.profile.examDate);
  const until = `${dateKey(addDays(exam, -1)).replace(/-/g, '')}T235959Z`;
  const appUrl = location.href.split('#')[0] + '#chat';
  const groups = {};
  Object.entries(CHAT_SESSIONS).forEach(([wd, s]) => {
    (groups[s.time + '|' + s.minutes] = groups[s.time + '|' + s.minutes] || []).push(Number(wd));
  });
  const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const events = Object.entries(groups).map(([k, days]) => {
    const [time, minutes] = k.split('|');
    let first = new Date();
    while (!days.includes(first.getDay())) first = addDays(first, 1);
    const end = new Date(2000, 0, 1, ...time.split(':').map(Number));
    end.setMinutes(end.getMinutes() + Number(minutes));
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    return ['BEGIN:VEVENT',
      `UID:academia-c1-${time.replace(':', '')}-${days.join('')}@academia-c1`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Madrid:${icsDate(first, time)}`,
      `DTEND;TZID=Europe/Madrid:${icsDate(first, endTime)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => codes[d]).join(',')};UNTIL=${until}`,
      `SUMMARY:🧠 English grammar (${minutes} min)`,
      `DESCRIPTION:Sesión de gramática en la Academia C1: ${appUrl}`,
      `URL:${appUrl}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Grammar time!', 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT'].join('\r\n');
  });
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Academia C1//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Madrid',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE', ...events, 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'academia-c1-recordatorios.ics';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Abre el archivo descargado para añadirlo a tu calendario');
}

/* ---------- Claude (gratis con tu cuenta) ---------- */

function copyText(text, msg) {
  const done = () => toast(msg || 'Copiado');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('No se pudo copiar'); }
  ta.remove();
}

// Copia el mensaje y abre tu proyecto de Claude para pegarlo
function openInClaude(prompt) {
  const url = state.settings.claudeProjectUrl || 'https://claude.ai/projects';
  copyText(prompt, state.settings.claudeProjectUrl ? 'Mensaje copiado: pégalo en el chat de Claude' : 'Mensaje copiado. Configura tu proyecto en la pestaña Chat para ir directo.');
  window.open(url, '_blank', 'noopener');
}

function projectInstructions() {
  const p = state.profile;
  return `You are my personal English teacher. I'm ${p.name}, a Spanish speaker preparing the Cambridge C1 Advanced exam on ${p.examDate}. My current level is about ${p.level || 'B2'}. Use British English.

MOST IMPORTANT RULE: whenever I write or say anything with a mistake (grammar, vocabulary, collocation, spelling, word order or something unnatural), show me exactly how it should be said. Correct every mistake, not only the main one. At the end of each of your replies add:
✏️ Corrections
• "what I said" → "how to say it" (motivo breve en español)
If I made no mistakes, don't add this section.

CONVERSATION PRACTICE
- When I write "hello there", start a relaxed conversation about the topic of the day: take today's day of the month (1–31) and use that number in this list: ${TOPICS.map((t, i) => `${i + 1}. ${t}`).join('; ')}.
- Keep your turns short (2–4 sentences) and always finish with a follow-up question, so I talk more than you. Slip in one useful C1 expression per turn in bold.
- When I write "bye", stop the conversation and give me a short summary: in Spanish, my most repeated mistakes with the correct form, 3 useful expressions from today, and one tip for next time.

OTHER THINGS I MAY ASK
- "Class: <topic>": teach me that grammar or vocabulary point step by step, with examples, then make me produce sentences one by one and correct them.
- "Speaking Part <1-4>": act as a Cambridge C1 Advanced Speaking examiner and follow the real exam format. When I write "END", mark me with the official criteria (Grammatical Resource, Lexical Resource, Discourse Management, Interactive Communication, 0–5 each) and tell me in Spanish how to improve.
- "Reading": give me a C1 Advanced Reading text with multiple-choice questions, wait for my answers, then correct them explaining each one in Spanish.
- If I paste a piece of writing: mark it like a C1 Advanced examiner (Content, Communicative Achievement, Organisation, Language, 0–5 each), list every mistake with the correction, explain in Spanish what to improve and give me a model C1 version.

Explanations of mistakes go in Spanish; everything else in English.`;
}

function claudePromptFor(kind, week) {
  if (kind === 'speaking') {
    const sp = SPEAKING_PARTS.find((x) => x.id === week.speaking) || SPEAKING_PARTS[0];
    return `Speaking ${sp.name.split(' · ')[0]}. Let's start.`;
  }
  const l = LESSONS.find((x) => x.id === week.lessons[week.lessons.length - 1]) || LESSONS[0];
  return `Class: ${l.title} (${l.summary})`;
}

/* ==========================================================
   13. Pantalla TUTOR (conversación con IA)
   ========================================================== */

let tutorMode = 'free';
let tutorExtra = '';
let busy = false;
let recog = null;

function chatKey() {
  return tutorMode + (tutorExtra ? ':' + tutorExtra : '');
}

function openTutor(mode, extra) {
  tutorMode = mode;
  tutorExtra = extra || '';
  if (mode === 'examiner') {
    const sp = SPEAKING_PARTS.find((s) => s.id === extra) || SPEAKING_PARTS[0];
    tutorExtra = sp.id;
  }
  show('tutor');
}

function renderTutor() {
  const el = $('#view-tutor');
  const msgs = state.chats[chatKey()] || [];
  const lessonOpts = LESSONS.map((l) => `<option value="${esc(l.title)}" ${tutorExtra === l.title ? 'selected' : ''}>${esc(l.title)}</option>`).join('');
  const spOpts = SPEAKING_PARTS.map((s) => `<option value="${s.id}" ${tutorExtra === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

  el.innerHTML = `<h2>Tutor</h2>
    <div class="card">
      <label class="field" for="tmode" style="margin-top:0">Tipo de sesión</label>
      <select id="tmode">
        <option value="free" ${tutorMode === 'free' ? 'selected' : ''}>💬 Conversación libre</option>
        <option value="lesson" ${tutorMode === 'lesson' ? 'selected' : ''}>📚 Clase particular sobre un tema</option>
        <option value="examiner" ${tutorMode === 'examiner' ? 'selected' : ''}>🎓 Examinador de Speaking</option>
        <option value="corrector" ${tutorMode === 'corrector' ? 'selected' : ''}>✏️ Corrector de frases</option>
      </select>
      ${tutorMode === 'lesson' ? `<label class="field" for="textra">Tema</label><select id="textra">${lessonOpts}</select>` : ''}
      ${tutorMode === 'examiner' ? `<label class="field" for="textra">Parte del examen</label><select id="textra">${spOpts}</select><p class="muted small" style="margin:6px 0 0">${esc((SPEAKING_PARTS.find((s) => s.id === tutorExtra) || SPEAKING_PARTS[0]).desc)} Escribe <b>END</b> para recibir tu nota.</p>` : ''}
      <div class="row" style="margin-top:10px">
        <label class="row small"><input type="checkbox" id="autoSpeak" ${state.settings.autoSpeak ? 'checked' : ''}> Leer respuestas en voz alta</label>
        <button class="btn small ghost" id="newChat">🗑️ Nueva conversación</button>
      </div>
    </div>
    ${state.settings.apiKey ? '' : '<div id="tutorKey"></div>'}
    <div class="chat" id="chat">${msgs.length ? msgs.map(renderMsg).join('') : `<p class="muted">Pulsa <b>Empezar</b> y el profesor abrirá la sesión. Puedes escribir o hablar con el micrófono 🎤 (Chrome / Safari).</p>`}</div>
    <div class="composer">
      ${msgs.length ? '' : '<button class="btn primary block" id="startChat" style="margin-bottom:8px">Empezar</button>'}
      <textarea id="tinput" placeholder="Write in English…" ${msgs.length ? '' : 'class="hidden"'}></textarea>
      <div class="row" style="margin-top:6px">
        <button class="btn mic ${msgs.length ? '' : 'hidden'}" id="mic" ${Recognition ? '' : 'disabled title="Tu navegador no permite dictado por voz"'}>🎤</button>
        <button class="btn dark ${msgs.length ? '' : 'hidden'}" id="send" style="flex:1">Enviar</button>
      </div>
    </div>`;

  if (!state.settings.apiKey) needKey($('#tutorKey', el));
  $('#tmode', el).onchange = (e) => {
    tutorMode = e.target.value;
    tutorExtra = tutorMode === 'lesson' ? LESSONS[0].title : tutorMode === 'examiner' ? SPEAKING_PARTS[0].id : '';
    renderTutor();
  };
  const extraSel = $('#textra', el);
  if (extraSel) extraSel.onchange = (e) => { tutorExtra = e.target.value; renderTutor(); };
  $('#autoSpeak', el).onchange = (e) => { state.settings.autoSpeak = e.target.checked; save(); };
  $('#newChat', el).onclick = () => { delete state.chats[chatKey()]; save(); stopSpeaking(); renderTutor(); };
  const start = $('#startChat', el);
  if (start) start.onclick = () => sendTutor('(The student has just joined the session. Greet them briefly and start the activity.)', true);
  $('#send', el).onclick = () => {
    const v = $('#tinput', el).value.trim();
    if (v) sendTutor(v);
  };
  $('#tinput', el).onkeydown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('#send', el).click();
  };
  $('#mic', el).onclick = toggleMic;
  $$('.say-btn', el).forEach((b) => (b.onclick = () => speak(spokenPart(msgs[Number(b.dataset.i)].content))));
  const chatEl = $('#chat', el);
  chatEl.lastElementChild && chatEl.lastElementChild.scrollIntoView({ block: 'end' });
}

// Separa la respuesta del profesor de la parte de correcciones
function splitCorrections(text) {
  const i = text.indexOf('✏️ Corrections:');
  if (i === -1) return { main: text, corr: '' };
  return { main: text.slice(0, i).trim(), corr: text.slice(i).trim() };
}
function spokenPart(text) {
  return splitCorrections(text).main.replace(/[*_#>`]/g, '');
}
function mdLite(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>');
}

function renderMsg(m, i) {
  if (m.hidden) return '';
  if (m.role === 'user') return `<div class="msg user">${esc(m.content)}</div>`;
  const { main, corr } = splitCorrections(m.content);
  return `<div class="msg assistant">${mdLite(main)}${corr ? `<span class="corr">${mdLite(corr)}</span>` : ''}<div class="say"><button class="btn small ghost say-btn" data-i="${i}">🔊</button></div></div>`;
}

async function sendTutor(text, hidden = false) {
  if (busy) return;
  if (!state.settings.apiKey) { toast('Añade tu clave de API en ⚙️ Ajustes'); return; }
  const key = chatKey();
  const msgs = state.chats[key] || (state.chats[key] = []);
  msgs.push({ role: 'user', content: text, hidden });
  save();
  busy = true;
  renderTutor();
  const chatEl = $('#chat');
  const bubble = document.createElement('div');
  bubble.className = 'msg assistant';
  bubble.textContent = '…';
  chatEl.appendChild(bubble);
  bubble.scrollIntoView({ block: 'end' });

  // Solo mandamos los últimos 30 mensajes para que cada respuesta no salga cara
  const history = msgs.slice(-30).map((m) => ({ role: m.role, content: m.content }));
  while (history.length && history[0].role !== 'user') history.shift();
  const extra = tutorMode === 'examiner' ? (SPEAKING_PARTS.find((s) => s.id === tutorExtra) || SPEAKING_PARTS[0]).name : tutorExtra;
  try {
    const reply = await chat(state.settings, {
      system: tutorSystem(state.profile || {}, tutorMode, extra),
      messages: history,
      effort: tutorMode === 'examiner' ? 'medium' : 'low',
      onText: (t) => { bubble.innerHTML = mdLite(splitCorrections(t).main); }
    });
    msgs.push({ role: 'assistant', content: reply });
    // Cuenta como sesión de speaking a partir del 3.er mensaje tuyo (una vez al día por modo)
    const userTurns = msgs.filter((m) => m.role === 'user' && !m.hidden).length;
    const already = state.log.some((e) => e.date === dateKey() && e.detail === key);
    if (userTurns >= 3 && !already) logActivity(tutorMode === 'lesson' ? 'tutorlesson' : 'speaking', null, key);
    save();
    busy = false;
    renderTutor();
    if (state.settings.autoSpeak) speak(spokenPart(reply));
  } catch (e) {
    busy = false;
    msgs.pop();
    save();
    renderTutor();
    toast(e.message);
  }
}

function toggleMic() {
  const btn = $('#mic');
  if (recog) { recog.stop(); return; }
  if (!Recognition) return;
  stopSpeaking();
  recog = new Recognition();
  recog.lang = 'en-GB';
  recog.interimResults = true;
  recog.continuous = true;
  const ta = $('#tinput');
  const before = ta.value ? ta.value + ' ' : '';
  recog.onresult = (ev) => {
    let txt = '';
    for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
    ta.value = before + txt;
  };
  recog.onend = () => { recog = null; btn && btn.classList.remove('on'); };
  recog.onerror = (ev) => { toast('Micrófono: ' + ev.error); };
  recog.start();
  btn.classList.add('on');
  toast('Escuchando… pulsa 🎤 otra vez para parar');
}

/* ==========================================================
   14. Pantalla PROGRESO
   ========================================================== */

const SKILLS = [
  ['Gramática', ['lesson', 'review']],
  ['Use of English', ['uoe', 'uoe4']],
  ['Reading', ['reading']],
  ['Listening', ['listening', 'dictation']],
  ['Writing', ['writing']],
  ['Vocabulario', ['vocab']]
];

function skillScore(kinds) {
  const xs = state.log.filter((e) => kinds.includes(e.kind) && e.score != null).slice(-10);
  if (!xs.length) return null;
  return xs.reduce((a, e) => a + e.score, 0) / xs.length;
}

function chartSvg(tests) {
  if (!tests.length) return '<p class="muted">Haz el test de nivel y las evaluaciones para ver tu evolución aquí.</p>';
  const W = 600;
  const H = 220;
  const pad = 32;
  const min = 120;
  const max = 210;
  const y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
  const x = (i) => (tests.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (tests.length - 1));
  const pts = tests.map((t, i) => `${x(i)},${y(t.scale)}`).join(' ');
  const grid = [140, 160, 180, 200].map((v) => `<line class="axis" x1="${pad}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}"/><text x="2" y="${y(v) + 4}">${v}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de tu puntuación">
    ${grid}<line class="target" x1="${pad}" x2="${W - 8}" y1="${y(180)}" y2="${y(180)}"/>
    <text x="${W - 70}" y="${y(180) - 6}">C1 = 180</text>
    <polyline class="line" points="${pts}"/>
    ${tests.map((t, i) => `<circle class="dot" cx="${x(i)}" cy="${y(t.scale)}" r="4"><title>${t.date}: ${t.scale}</title></circle>`).join('')}
  </svg>`;
}

function renderProgreso() {
  const el = $('#view-progreso');
  const tests = state.tests;
  const last = tests[tests.length - 1];
  const typeName = { placement: 'Test de nivel', eval: 'Evaluación', mock: 'Simulacro' };
  const daysLeft = state.profile ? daysBetween(new Date(), parseDate(state.profile.examDate)) : 0;
  const weakest = LESSONS.filter((l) => state.lessons[l.id] != null && state.lessons[l.id] < 0.7);
  const writingAvg = state.writings.length ? state.writings.slice(-5).reduce((a, w) => a + w.total, 0) / Math.min(5, state.writings.length) : null;

  el.innerHTML = `<h2>Tu progreso</h2>
    <div class="kpis">
      <div class="kpi"><b>${last ? last.scale : '—'}</b><span>última nota (escala)</span></div>
      <div class="kpi"><b>${state.profile && state.profile.level ? state.profile.level : '—'}</b><span>nivel del test</span></div>
      <div class="kpi"><b>${Math.max(0, daysLeft)}</b><span>días al examen</span></div>
    </div>
    <div class="card chart"><h3>Evolución (escala Cambridge)</h3>${chartSvg(tests)}</div>
    <div class="card"><h3>Destrezas</h3><p class="muted small">Media de tus últimas 10 actividades de cada tipo.</p>
      ${SKILLS.map(([name, kinds]) => {
        const s = skillScore(kinds);
        return `<div class="skill-row"><div class="spread small"><span>${name}</span><b>${s == null ? 'sin datos' : Math.round(s * 100) + '%'}</b></div><div class="bar"><div style="width:${s == null ? 0 : Math.round(s * 100)}%"></div></div></div>`;
      }).join('')}
      <div class="skill-row"><div class="spread small"><span>Speaking</span><b>${state.log.filter((e) => e.kind === 'speaking' || e.kind === 'tutorlesson').length} sesiones</b></div></div>
      ${writingAvg != null ? `<p class="small">Writing (IA, últimas 5): <b>${writingAvg.toFixed(1)}/20</b> — en el examen el aprobado C1 está en torno a 12/20 por tarea.</p>` : ''}
    </div>
    ${weakest.length ? `<div class="card"><h3>Puntos débiles</h3><p class="muted small">Clases con menos de 70%. Repítelas o pide una clase al tutor.</p>${weakest.map((l) => `<button class="btn small" data-lesson="${l.id}" style="margin:0 6px 6px 0">${esc(l.title)} · ${Math.round(state.lessons[l.id] * 100)}%</button>`).join('')}</div>` : ''}
    <div class="card"><h3>Historial de evaluaciones</h3>
      ${tests.length ? `<table><tr><th>Fecha</th><th>Tipo</th><th>%</th><th>Escala</th></tr>${tests.slice().reverse().map((t) => `<tr><td>${t.date}</td><td>${typeName[t.type] || t.type}</td><td>${Math.round(t.pct * 100)}%</td><td>${t.scale}${t.level ? ' · ' + t.level : ''}</td></tr>`).join('')}</table>` : '<p class="muted">Aún no hay evaluaciones.</p>'}
    </div>
    <div class="card"><h3>Actividad reciente</h3>
      ${state.log.length ? `<table><tr><th>Fecha</th><th>Actividad</th><th>Nota</th></tr>${state.log.slice(-12).reverse().map((e) => `<tr><td>${e.date}</td><td>${(KIND_INFO[e.kind] || { emoji: '' }).emoji} ${esc((KIND_INFO[e.kind] || { label: e.kind }).label)}</td><td>${e.score == null ? '—' : Math.round(e.score * 100) + '%'}</td></tr>`).join('')}</table>` : '<p class="muted">Todavía no has hecho ninguna actividad.</p>'}
    </div>`;
  $$('[data-lesson]', el).forEach((b) => (b.onclick = () => openLesson(b.dataset.lesson)));
}

/* ==========================================================
   15. Bienvenida y ajustes
   ========================================================== */

function openModal(html) {
  $('#modalCard').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  $('#modal').classList.add('hidden');
}

function onboarding() {
  // Fecha orientativa: las convocatorias del C1 Advanced cambian cada año
  // y según el centro, así que se puede cambiar luego en Ajustes.
  const defaultExam = '2027-05-29';
  openModal(`<p class="eyebrow">👋 Bienvenida a tu academia</p><h2>Vamos a preparar tu C1</h2>
    <p class="muted">Dos datos y hacemos un test de nivel para crear tu cronograma.</p>
    <form id="obForm">
      <label class="field" for="obName">¿Cómo te llamas?</label><input type="text" id="obName" required>
      <label class="field" for="obDate">Fecha de tu examen Cambridge C1 Advanced</label><input type="date" id="obDate" value="${defaultExam}" required>
      <p class="muted small">Consulta la fecha exacta en tu centro examinador; la puedes cambiar después.</p>
      <div class="notice" style="margin-top:12px"><b>Tu horario:</b> ${esc(scheduleSummary(DEFAULT_SCHEDULE))}<br><span class="muted small">Lo puedes cambiar cuando quieras en ⚙️ Ajustes.</span></div>
      <button class="btn primary block" style="margin-top:16px">Hacer el test de nivel</button>
    </form>`);
  $('#obForm').onsubmit = (e) => {
    e.preventDefault();
    state.profile = {
      name: $('#obName').value.trim() || 'Student',
      examDate: $('#obDate').value,
      startDate: dateKey(),
      level: null,
      schedule: { ...DEFAULT_SCHEDULE }
    };
    save();
    closeModal();
    show('hoy');
    startPlacement();
  };
}

function openSettings() {
  const s = state.settings;
  const p = state.profile || {};
  const sch = schedule();
  if (!voices.length) loadVoices();
  openModal(`<div class="spread"><h2>Ajustes</h2><button class="icon-btn" id="closeSet" aria-label="Cerrar">✕</button></div>
    <label class="field" for="sName">Nombre</label><input type="text" id="sName" value="${esc(p.name || '')}">
    <label class="field" for="sDate">Fecha del examen</label><input type="date" id="sDate" value="${esc(p.examDate || '')}">
    <h3 style="margin-top:20px">🗓️ Horario</h3>
    <label class="field">Días de clase entre semana</label>
    <div class="row">${[1, 2, 3, 4, 5].map((d) => `<label class="row small"><input type="checkbox" class="sDay" value="${d}" ${sch.classDays.includes(d) ? 'checked' : ''}> ${DAY_NAMES[d]}</label>`).join('')}</div>
    <label class="field" for="sClassMin">Duración de cada clase (minutos)</label><input type="number" id="sClassMin" min="15" max="240" step="5" value="${sch.classMinutes}">
    <label class="field" for="sWeekend">Total del fin de semana, clase + ejercicios (minutos)</label><input type="number" id="sWeekend" min="0" max="900" step="15" value="${sch.weekendMinutes}">
    <label class="row small" style="margin-top:10px"><input type="checkbox" id="sWa" ${sch.chat ? 'checked' : ''}> Sesiones de gramática en el Chat (L, M, J 7:40 · X, V 8:00)</label>
    <label class="field" for="sProject">Enlace a tu proyecto de Claude (para conversar gratis)</label><input type="text" id="sProject" value="${esc(s.claudeProjectUrl || '')}" placeholder="https://claude.ai/project/...">

    <h3 style="margin-top:20px">🤖 Inteligencia artificial (Claude)</h3>
    <p class="muted small">El tutor, la corrección de writing y los ejercicios nuevos usan la API de Claude. Crea una clave en <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> (se paga por uso). La clave se guarda solo en este navegador y nunca se sube a GitHub.</p>
    <label class="field" for="sKey">Clave de API</label><input type="password" id="sKey" value="${esc(s.apiKey)}" placeholder="sk-ant-..." autocomplete="off">
    <label class="field" for="sModel">Modelo</label><select id="sModel">${MODELS.map((m) => `<option value="${m.id}" ${s.model === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>

    <h3 style="margin-top:20px">🔊 Voz</h3>
    <label class="field" for="sVoice">Voz en inglés</label><select id="sVoice"><option value="">Automática (británica si hay)</option>${voices.map((v) => `<option value="${esc(v.voiceURI)}" ${s.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select>
    <label class="field" for="sRate">Velocidad: <span id="rateVal">${s.rate}</span></label><input type="range" id="sRate" min="0.6" max="1.2" step="0.05" value="${s.rate}" style="width:100%">
    <button class="btn small" id="testVoice">🔊 Probar</button>

    <h3 style="margin-top:20px">💾 Copia de seguridad</h3>
    <p class="muted small">Tus datos viven en este navegador. Descarga una copia de vez en cuando (la clave de API no se incluye).</p>
    <div class="row"><button class="btn small" id="exportBtn">⬇️ Exportar</button><label class="btn small">⬆️ Importar<input type="file" id="importFile" accept="application/json" class="hidden"></label><button class="btn small ghost" id="resetBtn">Borrar todo</button></div>

    <button class="btn primary block" id="saveSet" style="margin-top:20px">Guardar</button>`);

  $('#closeSet').onclick = closeModal;
  $('#sRate').oninput = (e) => ($('#rateVal').textContent = e.target.value);
  $('#testVoice').onclick = () => {
    state.settings.voiceURI = $('#sVoice').value;
    speak('Hello! This is how I sound. Good luck with your C1 Advanced exam.', Number($('#sRate').value));
  };
  $('#saveSet').onclick = () => {
    if (state.profile) {
      state.profile.name = $('#sName').value.trim() || state.profile.name;
      state.profile.examDate = $('#sDate').value || state.profile.examDate;
      const days = $$('.sDay').filter((c) => c.checked).map((c) => Number(c.value));
      state.profile.schedule = {
        classDays: days,
        classMinutes: Number($('#sClassMin').value) || DEFAULT_SCHEDULE.classMinutes,
        weekendMinutes: Math.max(0, Number($('#sWeekend').value) || 0),
        chat: $('#sWa').checked
      };
    }
    state.settings.apiKey = $('#sKey').value.trim();
    state.settings.claudeProjectUrl = $('#sProject').value.trim();
    state.settings.model = $('#sModel').value;
    state.settings.voiceURI = $('#sVoice').value;
    state.settings.rate = Number($('#sRate').value);
    save();
    closeModal();
    toast('Ajustes guardados');
    show(currentView === 'actividad' ? 'hoy' : currentView);
  };
  $('#exportBtn').onclick = () => {
    const copy = { ...state, settings: { ...state.settings, apiKey: '' } };
    const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `academia-c1-${dateKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#importFile').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((txt) => {
      const data = JSON.parse(txt);
      if (!data || !('log' in data)) throw new Error('formato');
      const key = state.settings.apiKey;
      state = { ...freshState(), ...data, settings: { ...freshState().settings, ...(data.settings || {}), apiKey: key } };
      save();
      closeModal();
      toast('Copia importada');
      show('hoy');
    }).catch(() => toast('Ese archivo no es una copia válida'));
  };
  $('#resetBtn').onclick = () => {
    if (!confirm('¿Seguro? Se borrará todo tu progreso de este navegador.')) return;
    state = freshState();
    save();
    closeModal();
    onboarding();
  };
}

/* ==========================================================
   16. Arranque
   ========================================================== */

$$('.tabbar button').forEach((b) => (b.onclick = () => show(b.dataset.view)));
$('#settingsBtn').onclick = () => (state.profile ? openSettings() : onboarding());
$('#modal').onclick = (e) => { if (e.target.id === 'modal' && state.profile) closeModal(); };

show(location.hash === '#chat' && state.profile ? 'chat' : 'hoy');
if (!state.profile) onboarding();
