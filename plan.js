/* ==========================================================
   Cronograma: qué toca cada semana hasta el examen y el horario
   de las sesiones del Chat. Lo usan app.js y chat.js.
   ========================================================== */

import { LESSONS, SPEAKING_PARTS } from './data.js';

/* ---------- Fechas (en hora local, formato AAAA-MM-DD) ---------- */

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function daysBetween(a, b) {
  return Math.round((parseDate(dateKey(b)) - parseDate(dateKey(a))) / 86400000);
}
export function mondayOf(d) {
  const r = parseDate(dateKey(d));
  const wd = (r.getDay() + 6) % 7; // lunes = 0
  return addDays(r, -wd);
}

/* ---------- Horario semanal ---------- */

// Sesiones de gramática en el Chat (día de la semana: 1 = lunes … 5 = viernes)
export const CHAT_SESSIONS = {
  1: { time: '07:40', minutes: 15 },
  2: { time: '07:40', minutes: 15 },
  3: { time: '08:00', minutes: 20 },
  4: { time: '07:40', minutes: 15 },
  5: { time: '08:00', minutes: 20 }
};

// Horario por defecto: clases de 1 h 30 los miércoles y viernes y
// 4 horas el fin de semana (clase + ejercicios), cuando a ti te venga bien.
export const DEFAULT_SCHEDULE = {
  classDays: [3, 5],
  classMinutes: 90,
  weekendMinutes: 240,
  chat: true
};

export function weeklyMinutes(schedule) {
  const drills = schedule.chat ? Object.values(CHAT_SESSIONS).reduce((a, s) => a + s.minutes, 0) : 0;
  return schedule.classDays.length * schedule.classMinutes + schedule.weekendMinutes + drills;
}

/* ---------- Plan de semanas hasta el examen ---------- */

const WRITING_CYCLE = ['essay1', 'report1', 'essay2', 'proposal1', 'review1', 'essay3', 'letter1', 'email1'];

// profile: { startDate, examDate, level }
export function buildPlan(profile) {
  if (!profile) return null;
  const start = mondayOf(parseDate(profile.startDate));
  const exam = parseDate(profile.examDate);
  const totalWeeks = Math.max(1, Math.ceil((daysBetween(start, exam) + 1) / 7));

  // Reparto de fases: si ya tienes C1, se dedica más tiempo a técnica de examen
  const lvl = profile.level || 'B2';
  const f1 = lvl === 'C1' || lvl === 'C2' ? 0.2 : lvl === 'B2' ? 0.35 : 0.45;
  const p1 = Math.max(1, Math.round(totalWeeks * f1));
  const p3 = totalWeeks > 3 ? Math.max(1, Math.round(totalWeeks * 0.25)) : 0;
  const p2 = Math.max(0, totalWeeks - p1 - p3);
  const lessonWeeks = p1 + p2;

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
      // Cada 4 semanas, examen mensual; en la fase de examen, simulacro
      // las otras semanas alternas. (El examen semanal es todas las semanas.)
      if (i > 0 && (i + 1) % 4 === 0) test = 'eval';
      else if (phase === 3 && (i - (p1 + p2)) % 2 === 1) test = 'mock';
    }
    weeks.push({
      index: i,
      start: wStart,
      end: addDays(wStart, 6),
      phase,
      lessons,
      writing: WRITING_CYCLE[i % WRITING_CYCLE.length],
      writing2: WRITING_CYCLE[(i + 4) % WRITING_CYCLE.length],
      speaking: SPEAKING_PARTS[i % SPEAKING_PARTS.length].id,
      uoePart: (i % 3) + 1,
      test,
      isLast
    });
  }
  return { start, exam, totalWeeks, p1, p2, p3, weeks };
}

export function weekForDate(plan, d) {
  if (!plan) return null;
  const idx = Math.floor(daysBetween(plan.start, d) / 7);
  return plan.weeks[idx] || null;
}

// Temas gramaticales "de la semana" para las sesiones del Chat: los de la
// semana actual y, como repaso, los de las semanas anteriores.
export function grammarFocus(plan, d) {
  const week = weekForDate(plan, d);
  if (!week) return { current: LESSONS.slice(0, 2), review: [] };
  let currentIds = week.lessons;
  if (!currentIds.length) {
    // Fase de examen: sin temas nuevos, se repasa todo
    currentIds = LESSONS.map((l) => l.id);
  }
  const past = plan.weeks.slice(0, week.index).flatMap((w) => w.lessons);
  const byId = (id) => LESSONS.find((l) => l.id === id);
  return {
    current: currentIds.map(byId).filter(Boolean),
    review: [...new Set(past)].filter((id) => !currentIds.includes(id)).map(byId).filter(Boolean)
  };
}
