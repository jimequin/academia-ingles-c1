/* ==========================================================
   Todo lo que habla con Claude (la IA) está en este archivo.

   - La clave de API la pones tú en Ajustes y se guarda SOLO en
     este navegador (localStorage). No va a ningún servidor nuestro:
     el navegador habla directamente con la API de Anthropic.
   - El SDK oficial se descarga del CDN la primera vez que se usa,
     así el resto de la app funciona aunque no tengas clave ni internet.
   ========================================================== */

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — el mejor profesor (más caro)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — muy bueno y más barato' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — rapidísimo y económico' }
];
export const DEFAULT_MODEL = 'claude-opus-5-5';

let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) sdkPromise = import(SDK_URL);
  return sdkPromise;
}

async function getClient(settings) {
  if (!settings.apiKey) {
    throw new Error('Falta tu clave de API. Ve a ⚙️ Ajustes y pégala allí.');
  }
  const sdk = await loadSdk();
  const Anthropic = sdk.default;
  // dangerouslyAllowBrowser: estamos en una app personal que solo usas tú,
  // con tu propia clave guardada en tu navegador. En una app pública con
  // muchos usuarios habría que poner un servidor intermedio.
  return { sdk, client: new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true }) };
}

// Parámetros comunes. Las "fallbacks" hacen que, si el modelo rechaza una
// petición por un falso positivo de seguridad, la API la repita sola con
// otro modelo en vez de devolver un error.
function baseParams(settings, effort) {
  const model = settings.model || DEFAULT_MODEL;
  const params = { model, output_config: { effort } };
  if (model !== 'claude-haiku-5-5') {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

function friendlyError(sdk, err) {
  if (sdk) {
    if (err instanceof sdk.AuthenticationError) return 'La clave de API no es válida. Revísala en ⚙️ Ajustes.';
    if (err instanceof sdk.RateLimitError) return 'Demasiadas peticiones seguidas. Espera un minuto y vuelve a intentarlo.';
    if (err instanceof sdk.BadRequestError) return 'La API rechazó la petición: ' + (err.message || '');
    if (err instanceof sdk.APIConnectionError) return 'No hay conexión con la API. ¿Tienes internet?';
    if (err instanceof sdk.APIError) return 'Error de la API (' + err.status + '): ' + (err.message || '');
  }
  return err && err.message ? err.message : String(err);
}

function textOf(message) {
  return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

/* ---------- Chat en streaming (tutor de conversación) ----------
   onText recibe el texto acumulado a medida que llega. */
export async function chat(settings, { system, messages, onText, effort = 'low' }) {
  let sdk = null;
  try {
    const got = await getClient(settings);
    sdk = got.sdk;
    const stream = got.client.beta.messages.stream({
      ...baseParams(settings, effort),
      max_tokens: 16000,
      system,
      messages
    });
    let acc = '';
    stream.on('text', (delta) => {
      acc += delta;
      if (onText) onText(acc);
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      throw new Error('El modelo no ha querido responder a esto. Prueba a reformularlo.');
    }
    return textOf(final);
  } catch (err) {
    throw new Error(friendlyError(sdk, err));
  }
}

/* ---------- Petición que devuelve JSON con un esquema fijo ----------
   Se usa para corregir writings y generar ejercicios: así la app puede
   guardar las notas y pintar los ejercicios sin tener que "adivinar". */
export async function askJson(settings, { system, prompt, schema, effort = 'medium' }) {
  let sdk = null;
  try {
    const got = await getClient(settings);
    sdk = got.sdk;
    const params = baseParams(settings, effort);
    params.output_config.format = { type: 'json_schema', schema };
    const stream = got.client.beta.messages.stream({
      ...params,
      max_tokens: 32000,
      system,
      messages: [{ role: 'user', content: prompt }]
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      throw new Error('El modelo no ha querido responder a esto.');
    }
    if (final.stop_reason === 'max_tokens') {
      throw new Error('La respuesta se cortó por ser demasiado larga. Inténtalo de nuevo.');
    }
    return JSON.parse(textOf(final));
  } catch (err) {
    throw new Error(friendlyError(sdk, err));
  }
}

/* ---------- Prompts del "profesorado" ---------- */

export function tutorSystem(profile, mode, extra) {
  const level = profile.level || 'B2';
  const name = profile.name || 'the student';
  const common = `You are an experienced Cambridge English teacher working in a private language academy. Your student is ${name}, a Spanish speaker whose current level is about ${level} (CEFR). Their goal is to pass the Cambridge C1 Advanced exam. Speak British English.

Rules for every reply:
- Keep your turns short and natural (2–5 sentences) so the student does most of the talking. Always end with a question or a clear prompt, unless the activity has finished.
- Use vocabulary and structures slightly above the student's level, and model C1 language (inversion, cleft sentences, collocations, hedging) naturally.
- After your reply, if the student's last message contained mistakes, add a section that starts exactly with "✏️ Corrections:" listing up to 3 of the most important mistakes as "wrong → right (short reason in Spanish)". Also suggest one more advanced way to say something they said, starting with "⬆️ C1 upgrade:". If there were no mistakes, write "✏️ Corrections: none — well done!".
- Only use Spanish inside the corrections section, or if the student explicitly asks for an explanation in Spanish.`;

  const modes = {
    free: `\n\nActivity: free conversation practice. Pick engaging, exam-relevant topics (work, technology, environment, education, travel, culture, health) and let the conversation flow.`,
    lesson: `\n\nActivity: a short one-to-one class about "${extra}". Teach it step by step: briefly explain the point with examples, then ask the student to produce their own sentences one at a time, correcting them as you go. After 5–6 exchanges, give a short summary and a mini-challenge.`,
    examiner: `\n\nActivity: simulate the Cambridge C1 Advanced Speaking test, ${extra}. Act as the examiner (and, in Part 3, also as the other candidate). Follow the real exam format and timing as closely as possible in text: in Part 2 describe three pictures in words and ask the student to compare two of them; in Part 3 give a central question with five prompts. Do NOT include the corrections section during the test. When the student writes "END" or the part is complete, give an assessment using the Cambridge criteria — Grammatical Resource, Lexical Resource, Discourse Management, Interactive Communication (each 0–5) — explaining in Spanish what to improve, plus the corrections section. Note that you can't assess pronunciation from text.`,
    corrector: `\n\nActivity: the student will paste sentences or short texts. Correct them, explain each mistake briefly in Spanish, and give a C1-level rewritten version.`
  };
  return common + (modes[mode] || modes.free);
}

export const WRITING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    content: { type: 'integer', description: 'Cambridge Content score 0-5' },
    communicative: { type: 'integer', description: 'Communicative Achievement score 0-5' },
    organisation: { type: 'integer', description: 'Organisation score 0-5' },
    language: { type: 'integer', description: 'Language score 0-5' },
    estimated_level: { type: 'string', description: 'CEFR level shown by this text, e.g. B2, C1' },
    summary_es: { type: 'string', description: 'Overall feedback in Spanish, 3-5 sentences' },
    strengths_es: { type: 'array', items: { type: 'string' } },
    improvements_es: { type: 'array', items: { type: 'string' } },
    mistakes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          wrong: { type: 'string' },
          right: { type: 'string' },
          why_es: { type: 'string' }
        },
        required: ['wrong', 'right', 'why_es']
      }
    },
    improved_version: { type: 'string', description: 'A model C1 version of the same text, keeping the student\'s ideas' }
  },
  required: ['content', 'communicative', 'organisation', 'language', 'estimated_level', 'summary_es', 'strengths_es', 'improvements_es', 'mistakes', 'improved_version']
};

export function writingSystem() {
  return 'You are a senior Cambridge English examiner for C1 Advanced Writing. Assess the candidate\'s text strictly but fairly using the official C1 Advanced assessment scales (Content, Communicative Achievement, Organisation, Language, each 0-5, where 3 is a solid C1 pass). Penalise texts far outside the 220-260 word range. Feedback for the student must be in Spanish; quoted corrections stay in English.';
}

export const EXERCISES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q: { type: 'string', description: 'The question. Use ___ for the gap.' },
          options: { type: 'array', items: { type: 'string' }, description: 'Exactly 4 options' },
          answer: { type: 'integer', description: 'Index (0-3) of the correct option' },
          explain: { type: 'string', description: 'Short explanation in Spanish' }
        },
        required: ['q', 'options', 'answer', 'explain']
      }
    }
  },
  required: ['exercises']
};

export const READING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    text: { type: 'string', description: 'The reading or listening passage' },
    questions: EXERCISES_SCHEMA.properties.exercises
  },
  required: ['title', 'text', 'questions']
};
