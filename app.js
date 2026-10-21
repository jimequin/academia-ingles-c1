/* ==========================================================
   Academia C1 · lógica principal
   Todo se guarda en el navegador (localStorage), en una sola
   clave: 'academia.v1'. No hay servidor.
   ========================================================== */

import { PLACEMENT, LESSONS, UOE, DICTATIONS, LISTENINGS, WRITING_TASKS, SPEAKING_PARTS, VOCAB } from './data.js';
import { MODELS, DEFAULT_MODEL, chat, askJson, tutorSystem, writingSystem, WRITING_SCHEMA, EXERCISES_SCHEMA, READING_SCHEMA } from './ai.js';

/* ==========================================================
   1. Estado y guardado
   ========================================================== */

const STORAGE_KEY = 'academia.v1';

function freshState() {
  return {
    profile: null, // { name, examDate, startDate, minutesPerDay, level }
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

// Fechas en hora local con formato AAAA-MM-DD (así "hoy" es tu hoy, no el de Londres)
function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function daysBetween(a, b) {
  return Math.round((parseDate(dateKey(b)) - parseDate(dateKey(a))) / 86400000);
}
function mondayOf(d) {
  const r = parseDate(dateKey(d));
  const wd = (r.getDay() + 6) % 7; // lunes = 0
  return addDays(r, -wd);
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

// Qué se hace cada día de la semana (0 = domingo)
const DAY_TEMPLATE = {
  1: ['lesson', 'vocab'],
  2: ['uoe', 'dictation'],
  3: ['writing'],
  4: ['listening', 'uoe4'],
  5: ['speaking', 'vocab'],
  6: ['review', 'reading'],
  0: ['vocab']
};

const KIND_INFO = {
  lesson: { emoji: '📚', label: 'Clase', minutes: 25 },
  vocab: { emoji: '🃏', label: 'Vocabulario (10 tarjetas)', minutes: 10 },
  uoe: { emoji: '🧩', label: 'Use of English', minutes: 15 },
  uoe4: { emoji: '🔁', label: 'Key word transformations', minutes: 15 },
  dictation: { emoji: '🎧', label: 'Dictado', minutes: 10 },
  listening: { emoji: '👂', label: 'Listening', minutes: 15 },
  reading: { emoji: '📖', label: 'Reading', minutes: 20 },
  writing: { emoji: '✍️', label: 'Writing', minutes: 45 },
  speaking: { emoji: '🗣️', label: 'Speaking con el tutor', minutes: 15 },
  review: { emoji: '🔄', label: 'Repaso de la semana', minutes: 20 },
  eval: { emoji: '📝', label: 'Evaluación mensual', minutes: 40 },
  mock: { emoji: '🏁', label: 'Simulacro de examen', minutes: 90 },
  placement: { emoji: '🎯', label: 'Test de nivel', minutes: 20 }
};

function buildPlan() {
  const p = state.profile;
  if (!p) return null;
  const start = mondayOf(parseDate(p.startDate));
  const exam = parseDate(p.examDate);
  const totalWeeks = Math.max(1, Math.ceil((daysBetween(start, exam) + 1) / 7));

  // Reparto de fases: si ya tienes C1, se dedica más tiempo a técnica de examen
  const lvl = p.level || 'B2';
  const f1 = lvl === 'C1' || lvl === 'C2' ? 0.2 : lvl === 'B2' ? 0.35 : 0.45;
  const p1 = Math.max(1, Math.round(totalWeeks * f1));
  const p3 = totalWeeks > 3 ? Math.max(1, Math.round(totalWeeks * 0.25)) : 0;
  const p2 = Math.max(0, totalWeeks - p1 - p3);
  const lessonWeeks = p1 + p2;

  const writingCycle = ['essay1', 'report1', 'essay2', 'proposal1', 'review1', 'essay3', 'letter1', 'email1'];
  const weeks = [];
  for (let i = 0; i < totalWeeks; i++) {
    const wStart = addDays(start, i * 7);
    const phase = i < p1 ? 1 : i < p1 + p2 ? 2 : 3;
    let lessons = [];
    if (i < lessonWeeks) {
      const a = Math.floor((i * LESSONS.length) / lessonWeeks);
      const b = Math.floor(((i + 1) * LESSONS.length) / lessonWeeks);
      lessons = LESSONS.slice(a, Math.max(b, a + 1)).map((l) => l.id);
    }
    const isLast = i === totalWeeks - 1;
    let test = null;
    if (!isLast) {
      if (phase === 3 && (i - (p1 + p2)) % 2 === 1) test = 'mock';
      else if (phase !== 3 && i > 0 && (i + 1) % 4 === 0) test = 'eval';
    }
    weeks.push({
      index: i,
      start: wStart,
      end: addDays(wStart, 6),
      phase,
      lessons,
      writing: writingCycle[i % writingCycle.length],
      speaking: SPEAKING_PARTS[i % SPEAKING_PARTS.length].id,
      uoePart: (i % 3) + 1,
      test,
      isLast
    });
  }
  return { start, exam, totalWeeks, p1, p2, p3, weeks };
}

const PHASES = {
  1: { name: 'Fase 1 · Consolidación', desc: 'Afianzar la gramática B2+ y crear el hábito diario.' },
  2: { name: 'Fase 2 · Núcleo C1', desc: 'Estructuras y vocabulario propios del C1, y writing con los cuatro géneros.' },
  3: { name: 'Fase 3 · Técnica de examen', desc: 'Simulacros cronometrados, repaso de puntos débiles y estrategia.' }
};

function weekForDate(plan, d) {
  if (!plan) return null;
  const idx = Math.floor(daysBetween(plan.start, d) / 7);
  return plan.weeks[idx] || null;
}

// Tareas de un día concreto según el cronograma
function tasksForDate(d) {
  const plan = buildPlan();
  if (!plan) return [];
  const key = dateKey(d);
  if (!state.tests.some((t) => t.type === 'placement')) {
    return [{ kind: 'placement', label: 'Haz el test de nivel', action: () => startPlacement() }];
  }
  const week = weekForDate(plan, d);
  if (!week) return [];
  if (key === state.profile.examDate) {
    return [{ kind: 'exam', label: '¡Día del examen! Descansa, desayuna bien y confía en tu preparación.', action: null }];
  }
  let kinds = DAY_TEMPLATE[d.getDay()].slice();
  if (week.isLast) kinds = d.getDay() === 0 ? ['vocab'] : ['vocab', 'speaking'];
  if (d.getDay() === 6 && week.test) kinds = [week.test];
  if (week.phase === 3 && d.getDay() === 1) kinds = ['uoe', 'vocab'];

  return kinds.map((kind) => {
    const info = KIND_INFO[kind];
    let label = info.label;
    let action = () => openKind(kind, week);
    if (kind === 'lesson' && week.lessons.length) {
      const l = LESSONS.find((x) => x.id === week.lessons[0]);
      label = `Clase: ${l.title}`;
      if (week.lessons.length > 1) label += ` (+${week.lessons.length - 1} más esta semana)`;
    }
    if (kind === 'writing') {
      const t = WRITING_TASKS.find((x) => x.id === week.writing);
      label = `Writing: ${t.genre}`;
    }
    if (kind === 'speaking') {
      const sp = SPEAKING_PARTS.find((x) => x.id === week.speaking);
      label = `Speaking · ${sp.name}`;
    }
    if (kind === 'uoe') label = `Use of English · Part ${week.uoePart}`;
    return { kind, label, minutes: info.minutes, emoji: info.emoji, action, key: `${key}:${kind}` };
  });
}

function isTaskDone(task, d) {
  if (state.manualDone[task.key]) return true;
  const key = dateKey(d);
  const map = { review: ['lesson', 'review'], eval: ['eval'], mock: ['mock'], placement: ['placement'] };
  const kinds = map[task.kind] || [task.kind];
  if (task.kind === 'placement') return state.tests.some((t) => t.type === 'placement');
  return state.log.some((e) => e.date === key && kinds.includes(e.kind));
}

function openKind(kind, week) {
  switch (kind) {
    case 'lesson': return openLesson(week.lessons[0] || LESSONS[0].id);
    case 'review': return startReview(week);
    case 'vocab': return startVocab();
    case 'uoe': return startUoePart(week.uoePart);
    case 'uoe4': return startUoePart(4);
    case 'dictation': return startDictation();
    case 'listening': return startListening();
    case 'reading': return startReading();
    case 'writing': return startWriting(week.writing);
    case 'speaking': return openTutor('examiner', week.speaking);
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
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const renderers = { hoy: renderHoy, plan: renderPlan, clases: renderClases, practica: renderPractica, tutor: renderTutor, progreso: renderProgreso };
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
  return state.log.reduce((a, e) => a + (e.minutes || 0), 0) / 60;
}

function renderHoy() {
  const el = $('#view-hoy');
  if (!state.profile) { el.innerHTML = ''; return; }
  const today = new Date();
  const plan = buildPlan();
  const week = weekForDate(plan, today);
  const tasks = tasksForDate(today);
  const doneCount = tasks.filter((t) => isTaskDone(t, today)).length;
  const lastTest = state.tests[state.tests.length - 1];

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
      <div class="spread"><h3>Tu clase de hoy</h3><span class="tag ${doneCount === tasks.length && tasks.length ? 'ok' : ''}">${doneCount}/${tasks.length}</span></div>
      <div class="tasks">${tasks.length ? tasks.map((t, i) => `
        <div class="task ${isTaskDone(t, today) ? 'done' : ''}" data-i="${i}">
          <button class="check" aria-label="Marcar como hecha">${isTaskDone(t, today) ? '✓' : ''}</button>
          <div class="task-body"><div class="task-label">${t.emoji || ''} ${esc(t.label)}</div>${t.minutes ? `<div class="muted small">~${t.minutes} min</div>` : ''}</div>
          ${t.action ? '<button class="btn small dark go">Empezar</button>' : ''}
        </div>`).join('') : '<p class="muted">No hay tareas para hoy.</p>'}
      </div>
    </div>
    ${hoursNotice(plan)}
    <div class="card">
      <h3>¿Te sobra tiempo?</h3>
      <div class="grid2">
        <button class="tile" data-go="tutor"><span class="emoji">💬</span><b>Conversar</b><span class="muted">Charla libre con el tutor</span></button>
        <button class="tile" data-go="vocab"><span class="emoji">🃏</span><b>Tarjetas</b><span class="muted">${dueCards().length} pendientes de repaso</span></button>
      </div>
    </div>`;

  $$('.task', el).forEach((row) => {
    const t = tasks[Number(row.dataset.i)];
    $('.check', row).onclick = () => {
      if (t.kind === 'placement' || t.kind === 'exam') return;
      state.manualDone[t.key] = !state.manualDone[t.key];
      save();
      renderHoy();
    };
    const go = $('.go', row);
    if (go) go.onclick = t.action;
  });
  $('[data-go="tutor"]', el).onclick = () => openTutor('free');
  $('[data-go="vocab"]', el).onclick = () => startVocab();
}

// Aviso honesto: ¿da tiempo con las horas que tienes?
function hoursNotice(plan) {
  if (!plan || !state.profile.level) return '';
  const lvl = state.profile.level;
  const needed = Math.max(0, HOURS_TO_REACH.C1 - (HOURS_TO_REACH[lvl] || HOURS_TO_REACH.B1));
  const daysLeft = Math.max(0, daysBetween(new Date(), plan.exam));
  const available = Math.round((daysLeft * 6 / 7) * (state.profile.minutesPerDay / 60));
  if (lvl === 'C1' || lvl === 'C2') {
    return `<div class="notice">✅ Tu nivel ya está en C1. El plan se centra en técnica de examen para que llegues con margen (objetivo: 190+).</div>`;
  }
  const ok = available >= needed;
  return `<div class="notice ${ok ? '' : 'warn'}">${ok ? '✅' : '⚠️'} Para pasar de <b>${lvl}</b> a <b>C1</b> se suelen necesitar unas <b>${needed} horas</b> de estudio guiado. Con ${state.profile.minutesPerDay} min/día te quedan unas <b>${available} horas</b> hasta el examen.${ok ? ' ¡Vas bien!' : ' Considera subir los minutos diarios en ⚙️ Ajustes o elegir una convocatoria posterior.'}</div>`;
}

/* ==========================================================
   9. Pantalla PLAN (cronograma)
   ========================================================== */

function renderPlan() {
  const el = $('#view-plan');
  const plan = buildPlan();
  if (!plan) { el.innerHTML = ''; return; }
  const today = new Date();
  const cur = weekForDate(plan, today);
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const weekday = [1, 2, 3, 4, 5, 6, 0];

  let html = `<h2>Tu cronograma</h2>
    <div class="card"><p>Del <b>${fmtDate(plan.start, { day: 'numeric', month: 'long' })}</b> al examen el <b>${fmtDate(plan.exam, { day: 'numeric', month: 'long', year: 'numeric' })}</b>: ${plan.totalWeeks} semanas, ${state.profile.minutesPerDay} min al día.</p>
    <p class="muted small" style="margin:0">Rutina semanal: Lun clase + vocabulario · Mar Use of English + dictado · Mié writing · Jue listening + transformaciones · Vie speaking · Sáb repaso/reading o evaluación · Dom descanso activo (tarjetas).</p></div>`;

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
        const t = tasksForDate(d);
        const done = t.length && t.every((x) => isTaskDone(x, d));
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
          ${w.test === 'eval' ? '<li>📝 Sábado: evaluación mensual</li>' : ''}
          ${w.test === 'mock' ? '<li>🏁 Sábado: simulacro cronometrado</li>' : ''}
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
    body.innerHTML = '<div id="nk"></div><p class="muted">Mientras tanto, practica Use of English (también es lectura) o haz el listening y lee la transcripción.</p>';
    needKey($('#nk', body));
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
      <button class="btn primary block" id="correct">Corregir con criterios Cambridge (IA)</button>
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
    const already = state.log.some((e) => e.date === dateKey() && e.kind === 'speaking' && e.detail === key);
    if (userTurns >= 3 && !already) logActivity('speaking', null, key);
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
      <div class="skill-row"><div class="spread small"><span>Speaking</span><b>${state.log.filter((e) => e.kind === 'speaking').length} sesiones</b></div></div>
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
    <p class="muted">Tres datos y hacemos un test de nivel para crear tu cronograma.</p>
    <form id="obForm">
      <label class="field" for="obName">¿Cómo te llamas?</label><input type="text" id="obName" required>
      <label class="field" for="obDate">Fecha de tu examen Cambridge C1 Advanced</label><input type="date" id="obDate" value="${defaultExam}" required>
      <p class="muted small">Consulta la fecha exacta en tu centro examinador; la puedes cambiar después.</p>
      <label class="field" for="obMin">¿Cuánto tiempo puedes estudiar al día?</label>
      <select id="obMin"><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60" selected>1 hora</option><option value="90">1 h 30 min</option><option value="120">2 horas</option></select>
      <button class="btn primary block" style="margin-top:16px">Hacer el test de nivel</button>
    </form>`);
  $('#obForm').onsubmit = (e) => {
    e.preventDefault();
    state.profile = {
      name: $('#obName').value.trim() || 'Student',
      examDate: $('#obDate').value,
      startDate: dateKey(),
      minutesPerDay: Number($('#obMin').value),
      level: null
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
  if (!voices.length) loadVoices();
  openModal(`<div class="spread"><h2>Ajustes</h2><button class="icon-btn" id="closeSet" aria-label="Cerrar">✕</button></div>
    <label class="field" for="sName">Nombre</label><input type="text" id="sName" value="${esc(p.name || '')}">
    <label class="field" for="sDate">Fecha del examen</label><input type="date" id="sDate" value="${esc(p.examDate || '')}">
    <label class="field" for="sMin">Minutos de estudio al día</label><input type="number" id="sMin" min="15" max="240" step="5" value="${p.minutesPerDay || 60}">

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
      state.profile.minutesPerDay = Number($('#sMin').value) || 60;
    }
    state.settings.apiKey = $('#sKey').value.trim();
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

show('hoy');
if (!state.profile) onboarding();
