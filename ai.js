/* ==========================================================
   Todo lo que habla con la IA está en este archivo.

   Hay dos "profesores" posibles (se elige en ⚙️ Ajustes):
   - Gemini, de Google: GRATIS con límites diarios. En el plan
     gratis Google puede usar las conversaciones para mejorar
     sus modelos (no escribas datos personales).
   - Claude, de Anthropic: de pago por uso (créditos de la API).

   La clave se guarda SOLO en este navegador (localStorage) y el
   navegador habla directamente con Google o Anthropic. Los SDK
   oficiales se descargan del CDN la primera vez que se usan.
   ========================================================== */

const CLAUDE_SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm';
const GEMINI_SDK_URL = 'https://cdn.jsdelivr.net/npm/@google/genai@2.25.0/+esm';

export const PROVIDERS = [
  { id: 'gemini', label: 'Gemini de Google — gratis (con límites diarios)' },
  { id: 'claude', label: 'Claude de Anthropic — de pago por uso' }
];

export const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite — rápido, el que más mensajes gratis permite' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash — mejor profesor, pero muy pocos mensajes gratis al día' }
];
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — el mejor profesor (más caro)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — muy bueno y más barato' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — rapidísimo y económico' }
];
export const DEFAULT_MODEL = 'claude-opus-5-5';

// ¿Hay un profesor IA configurado?
export function aiReady(settings) {
  return provider(settings) === 'gemini' ? !!settings.geminiKey : !!settings.apiKey;
}
function provider(settings) {
  return settings.provider || 'gemini';
}

const sdkCache = {};
function loadSdk(url) {
  if (!sdkCache[url]) sdkCache[url] = import(url);
  return sdkCache[url];
}

function textOf(message) {
  return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

/* ---------- Gemini (gratis) ---------- */

async function geminiClient(settings) {
  if (!settings.geminiKey) throw new Error('Falta tu clave de Gemini. Ve a ⚙️ Ajustes y pégala allí.');
  const sdk = await loadSdk(GEMINI_SDK_URL);
  return { sdk, ai: new sdk.GoogleGenAI({ apiKey: settings.geminiKey }) };
}

function geminiError(sdk, err) {
  if (sdk && err instanceof sdk.ApiError) {
    if (err.status === 429) return 'Has llegado al límite gratis de Gemini por ahora. Espera un minuto (o hasta mañana si es el límite diario), o cambia de modelo en ⚙️ Ajustes.';
    if (err.status === 400 || err.status === 403) return 'Gemini no acepta la clave o la petición. Revisa tu clave en ⚙️ Ajustes. (' + (err.message || err.status) + ')';
    if (err.status === 404) return 'Ese modelo de Gemini ya no existe. Elige otro en ⚙️ Ajustes.';
    if (err.status >= 500) return 'Los servidores de Gemini están saturados. Inténtalo en un momento.';
    return 'Error de Gemini (' + err.status + '): ' + (err.message || '');
  }
  if (err && /fetch|network/i.test(String(err.message))) return 'No hay conexión con Gemini. ¿Tienes internet?';
  return err && err.message ? err.message : String(err);
}

function toGeminiContents(messages) {
  return messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
}

async function geminiChat(settings, { system, messages, onText }) {
  let sdk = null;
  try {
    const got = await geminiClient(settings);
    sdk = got.sdk;
    const stream = await got.ai.models.generateContentStream({
      model: settings.geminiModel || DEFAULT_GEMINI_MODEL,
      contents: toGeminiContents(messages),
      config: { systemInstruction: system }
    });
    let acc = '';
    for await (const chunk of stream) {
      acc += chunk.text || '';
      if (onText) onText(acc);
    }
    if (!acc.trim()) throw new Error('Gemini no ha devuelto respuesta. Prueba a reformular el mensaje.');
    return acc;
  } catch (err) {
    throw new Error(geminiError(sdk, err));
  }
}

async function geminiJson(settings, { system, prompt, schema }) {
  let sdk = null;
  try {
    const got = await geminiClient(settings);
    sdk = got.sdk;
    const res = await got.ai.models.generateContent({
      model: settings.geminiModel || DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: { systemInstruction: system, responseMimeType: 'application/json', responseJsonSchema: schema }
    });
    if (!res.text) throw new Error('Gemini no ha devuelto respuesta. Inténtalo de nuevo.');
    return JSON.parse(res.text);
  } catch (err) {
    throw new Error(geminiError(sdk, err));
  }
}

/* ---------- Claude (de pago) ---------- */

async function claudeClient(settings) {
  if (!settings.apiKey) {
    throw new Error('Falta tu clave de API de Claude. Ve a ⚙️ Ajustes y pégala allí.');
  }
  const sdk = await loadSdk(CLAUDE_SDK_URL);
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

function claudeError(sdk, err) {
  if (sdk) {
    if (err instanceof sdk.AuthenticationError) return 'La clave de API no es válida. Revísala en ⚙️ Ajustes.';
    if (err instanceof sdk.RateLimitError) return 'Demasiadas peticiones seguidas. Espera un minuto y vuelve a intentarlo.';
    if (err instanceof sdk.BadRequestError) return 'La API rechazó la petición: ' + (err.message || '');
    if (err instanceof sdk.APIConnectionError) return 'No hay conexión con la API. ¿Tienes internet?';
    if (err instanceof sdk.APIError) return 'Error de la API (' + err.status + '): ' + (err.message || '');
  }
  return err && err.message ? err.message : String(err);
}

async function claudeChat(settings, { system, messages, onText, effort }) {
  let sdk = null;
  try {
    const got = await claudeClient(settings);
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
    throw new Error(claudeError(sdk, err));
  }
}

async function claudeJson(settings, { system, prompt, schema, effort }) {
  let sdk = null;
  try {
    const got = await claudeClient(settings);
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
    throw new Error(claudeError(sdk, err));
  }
}

/* ---------- Lo que usa la app (elige el proveedor solo) ---------- */

// Chat en streaming: onText recibe el texto acumulado a medida que llega
export function chat(settings, { system, messages, onText, effort = 'low' }) {
  return provider(settings) === 'gemini'
    ? geminiChat(settings, { system, messages, onText })
    : claudeChat(settings, { system, messages, onText, effort });
}

// Petición que devuelve JSON con un esquema fijo (corregir writings,
// generar ejercicios…): así la app puede guardar notas y pintar ejercicios.
export function askJson(settings, { system, prompt, schema, effort = 'medium' }) {
  return provider(settings) === 'gemini'
    ? geminiJson(settings, { system, prompt, schema })
    : claudeJson(settings, { system, prompt, schema, effort });
}

/* ---------- Prompts del "profesorado" ---------- */

export function tutorSystem(profile, mode, extra) {
  const level = profile.level || 'B2';
  const name = profile.name || 'the student';
  const common = `You are an experienced Cambridge English teacher working in a private language academy. Your student is ${name}, a Spanish speaker whose current level is about ${level} (CEFR). Their goal is to pass the Cambridge C1 Advanced exam. Speak British English.

Rules for every reply:
- Keep your turns short and natural (2–5 sentences) so the student does most of the talking. Always end with a question or a clear prompt, unless the activity has finished.
- Use vocabulary and structures slightly above the student's level, and model C1 language (inversion, cleft sentences, collocations, hedging) naturally.
- MOST IMPORTANT RULE: whenever the student's last message contains ANY mistake (grammar, vocabulary, collocation, spelling, punctuation, word order, or something unnatural), show exactly how it should be said. Correct EVERY mistake, not just the main ones. After your reply, add a section that starts exactly with "✏️ Corrections:" with one line per mistake: "wrong → right (short reason in Spanish)". Then suggest one more advanced way to say something they said, starting with "⬆️ C1 upgrade:". If there were no mistakes, write "✏️ Corrections: none — well done!".
- Only use Spanish inside the corrections section, or if the student explicitly asks for an explanation in Spanish.`;

  const modes = {
    free: `\n\nActivity: relaxed conversation practice. Today's topic: "${extra || 'anything the student likes'}". Greet the student and ask an engaging, open question about it; the conversation can drift, but gently come back to the topic. When the student writes "bye", stop the conversation: say goodbye and, in Spanish, give a short summary with (1) their most repeated mistakes and the correct forms, (2) 3 useful expressions from today, (3) one tip for next time.`,
    lesson: `\n\nActivity: a short one-to-one class about "${extra}". Teach it step by step: briefly explain the point with examples, then ask the student to produce their own sentences one at a time, correcting them as you go. After 5–6 exchanges, give a short summary and a mini-challenge.`,
    examiner: `\n\nActivity: simulate the Cambridge C1 Advanced Speaking test, ${extra}. Act as the examiner (and, in Part 3, also as the other candidate). Follow the official format (about 15 minutes for a pair): Part 1 interview (2 min) with personal questions; Part 2 long turn: describe three pictures in words with a question, the student compares two of them for about 1 minute, then answers a short question about the other candidate's pictures (about 30 seconds); Part 3 collaborative task: a central question with five prompts, 2 minutes of discussion and then 1 minute to reach a decision; Part 4 discussion (5 min) with more abstract questions related to Part 3. Do NOT include the corrections section during the test. When the student writes "END" or the part is complete, assess them with the official C1 Advanced criteria — Grammatical Resource, Lexical Resource, Discourse Management, Interactive Communication (each 0–5); Pronunciation is also an official criterion but can't be assessed from text, so say so — explaining in Spanish what to improve, plus the corrections section.`,
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

export const READING_PART_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    texts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { label: { type: 'string' }, text: { type: 'string' } },
        required: ['label', 'text']
      }
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answer: { type: 'integer', description: 'Index of the correct option' },
          explain: { type: 'string', description: 'Short explanation in Spanish' }
        },
        required: ['q', 'options', 'answer', 'explain']
      }
    }
  },
  required: ['title', 'texts', 'questions']
};
