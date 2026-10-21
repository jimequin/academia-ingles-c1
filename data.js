/* ==========================================================
   Contenido de la academia (todo escrito a mano, sin IA).
   Si quieres añadir ejercicios, este es el sitio: cada bloque
   es una lista normal de JavaScript.

   Tipos de ejercicio que entiende la app:
   - { type: 'mc',  q, options: [...], answer: índice, explain }
   - { type: 'gap', q (con ___), answers: ['válida1','válida2'], explain }
   - { type: 'kwt', q, key, start, end, answers: [...], explain }  (key word transformation)
   - { type: 'wf',  q (con ___), base: 'PALABRA', answers: [...], explain } (word formation)
   ========================================================== */

/* ---------- Test de nivel: 5 preguntas por nivel MCER ---------- */
export const PLACEMENT = [
  // A2
  { level: 'A2', type: 'mc', q: 'I ___ to the cinema last weekend.', options: ['go', 'went', 'have gone', 'was go'], answer: 1 },
  { level: 'A2', type: 'mc', q: 'There isn\'t ___ milk in the fridge.', options: ['some', 'many', 'any', 'a'], answer: 2 },
  { level: 'A2', type: 'mc', q: 'She is ___ than her brother.', options: ['more tall', 'taller', 'tallest', 'the taller'], answer: 1 },
  { level: 'A2', type: 'mc', q: 'What ___ you doing right now?', options: ['do', 'are', 'did', 'have'], answer: 1 },
  { level: 'A2', type: 'mc', q: 'We ___ visit my grandparents next Sunday.', options: ['are going to', 'going to', 'will to', 'go to'], answer: 0 },
  // B1
  { level: 'B1', type: 'mc', q: 'I ___ here since 2019.', options: ['live', 'am living', 'have lived', 'lived'], answer: 2 },
  { level: 'B1', type: 'mc', q: 'If it rains tomorrow, we ___ the match.', options: ['cancel', 'will cancel', 'would cancel', 'cancelled'], answer: 1 },
  { level: 'B1', type: 'mc', q: 'The book ___ by millions of people.', options: ['has read', 'has been read', 'have been reading', 'is reading'], answer: 1 },
  { level: 'B1', type: 'mc', q: 'She asked me where ___.', options: ['did I live', 'I lived', 'do I live', 'I did live'], answer: 1 },
  { level: 'B1', type: 'mc', q: 'I\'m not used to ___ up so early.', options: ['get', 'getting', 'got', 'have got'], answer: 1 },
  // B2
  { level: 'B2', type: 'mc', q: 'If I ___ about the traffic, I would have left earlier.', options: ['knew', 'had known', 'would know', 'have known'], answer: 1 },
  { level: 'B2', type: 'mc', q: 'By the time we arrived, the film ___.', options: ['already started', 'has already started', 'had already started', 'was already starting'], answer: 2 },
  { level: 'B2', type: 'mc', q: 'He denied ___ the window.', options: ['to break', 'breaking', 'break', 'that broke'], answer: 1 },
  { level: 'B2', type: 'mc', q: 'You ___ have told her — it was supposed to be a surprise!', options: ['mustn\'t', 'shouldn\'t', 'couldn\'t', 'needn\'t to'], answer: 1 },
  { level: 'B2', type: 'mc', q: 'The meeting was ___ off because the manager was ill.', options: ['called', 'put', 'taken', 'turned'], answer: 0 },
  // C1
  { level: 'C1', type: 'mc', q: 'Not until the results were published ___ how serious the problem was.', options: ['we realised', 'did we realise', 'we did realise', 'had we realise'], answer: 1 },
  { level: 'C1', type: 'mc', q: 'The new policy is likely to ___ a lot of criticism.', options: ['draw', 'make', 'raise up', 'do'], answer: 0 },
  { level: 'C1', type: 'mc', q: '___ the bad weather, the event was a great success.', options: ['Despite of', 'Although', 'Notwithstanding', 'However'], answer: 2 },
  { level: 'C1', type: 'mc', q: 'It\'s high time the government ___ action on housing.', options: ['takes', 'took', 'will take', 'has taken'], answer: 1 },
  { level: 'C1', type: 'mc', q: 'She is said ___ a fortune when she was young.', options: ['to make', 'to have made', 'having made', 'that she made'], answer: 1 },
  // C2
  { level: 'C2', type: 'mc', q: 'Little ___ that his decision would change the company forever.', options: ['he knew', 'he did know', 'did he know', 'knew he'], answer: 2 },
  { level: 'C2', type: 'mc', q: 'The minister\'s speech was so ___ that nobody could tell what he actually meant.', options: ['equivocal', 'eloquent', 'explicit', 'emphatic'], answer: 0 },
  { level: 'C2', type: 'mc', q: 'Were the proposal ___, thousands of jobs would be at risk.', options: ['to reject', 'to be rejected', 'rejecting', 'reject'], answer: 1 },
  { level: 'C2', type: 'mc', q: 'He went to great ___ to make sure everyone felt welcome.', options: ['lengths', 'efforts', 'pains of', 'ways'], answer: 0 },
  { level: 'C2', type: 'mc', q: 'Her argument doesn\'t ___ water — the figures contradict it.', options: ['keep', 'hold', 'carry', 'bear'], answer: 1 }
];

/* ---------- Clases (gramática y vocabulario C1) ---------- */
export const LESSONS = [
  {
    id: 'tenses',
    title: 'Tiempos narrativos y aspecto perfecto',
    skill: 'grammar',
    summary: 'Contar historias con precisión: past simple, past continuous, past perfect (simple y continuo) y present perfect continuous.',
    theory: [
      '<b>Past perfect</b> (<i>had done</i>): algo anterior a otro momento del pasado. <i>When I arrived, the train <u>had left</u>.</i>',
      '<b>Past perfect continuous</b> (<i>had been doing</i>): duración hasta un momento del pasado. <i>She was tired because she <u>had been working</u> all night.</i>',
      '<b>Present perfect continuous</b>: actividad que empezó antes y sigue o acaba de terminar, con foco en la duración. <i>I\'<u>ve been studying</u> for three hours.</i>',
      'Los verbos de estado (<i>know, believe, own, belong</i>) normalmente no van en continuo: <i>I\'ve known him for years</i> (no <s>I\'ve been knowing</s>).',
      'Con <b>the first/second time</b> se usa perfecto: <i>It\'s the first time I\'<u>ve been</u> here. / It was the first time I\'<u>d been</u> there.</i>'
    ],
    mistakes: ['<s>I am living here since 2020</s> → I have been living here since 2020.', '<s>When I arrived, he left</s> (si ya se había ido) → he had left.'],
    exercises: [
      { type: 'mc', q: 'By the time the ambulance arrived, the man ___ consciousness.', options: ['regained', 'had regained', 'has regained', 'was regaining'], answer: 1, explain: 'Acción anterior a otro momento pasado → past perfect.' },
      { type: 'mc', q: 'Her eyes were red because she ___.', options: ['cried', 'had been crying', 'has cried', 'was cried'], answer: 1, explain: 'Actividad prolongada con resultado visible en el pasado → past perfect continuous.' },
      { type: 'gap', q: 'It was the first time I ___ (ever / see) snow.', answers: ['had ever seen', "'d ever seen"], explain: '"It was the first time" + past perfect.' },
      { type: 'gap', q: 'How long ___ (you / wait)? — About twenty minutes.', answers: ['have you been waiting'], explain: 'Duración hasta ahora → present perfect continuous.' },
      { type: 'mc', q: 'I ___ him for over ten years, so I trust him completely.', options: ['have been knowing', 'know', 'have known', 'am knowing'], answer: 2, explain: '"Know" es verbo de estado: no va en continuo.' },
      { type: 'mc', q: 'While I ___ dinner, the lights suddenly went out.', options: ['was cooking', 'had cooked', 'cooked', 'have cooked'], answer: 0, explain: 'Acción en progreso interrumpida → past continuous.' }
    ]
  },
  {
    id: 'future',
    title: 'Futuro y futuro en el pasado',
    skill: 'grammar',
    summary: 'Future continuous, future perfect, be about to / be on the verge of, y was going to / would para planes del pasado.',
    theory: [
      '<b>Future perfect</b> (<i>will have done</i>): algo terminado antes de un momento futuro. <i>By June, I <u>will have passed</u> the exam.</i>',
      '<b>Future continuous</b> (<i>will be doing</i>): acción en progreso en un momento futuro. <i>This time tomorrow I<u>\'ll be flying</u> to London.</i>',
      '<b>be about to / be on the point of / be on the verge of</b>: algo inminente. <i>The company <u>is on the verge of</u> collapse.</i>',
      '<b>be due to / be set to / be bound to</b>: horarios previstos, algo planeado o casi seguro. <i>The results <u>are due to</u> be published on Friday.</i>',
      '<b>Futuro en el pasado</b>: <i>was going to / would / was about to</i>. <i>I <u>was going to</u> call you, but I forgot.</i>'
    ],
    mistakes: ['<s>By next year I will finish</s> (antes de un límite) → I will have finished.', '<s>The train is due to arriving</s> → is due to arrive.'],
    exercises: [
      { type: 'mc', q: 'By the end of this course, you ___ more than 200 hours of English.', options: ['will study', 'will have studied', 'are studying', 'will be study'], answer: 1, explain: '"By the end of" + acción completada → future perfect.' },
      { type: 'mc', q: 'Don\'t call at 9 — I ___ my online class then.', options: ['will have', 'will be having', 'have', 'will have had'], answer: 1, explain: 'Acción en progreso en un momento futuro → future continuous.' },
      { type: 'gap', q: 'The new law is ___ to come into force next month. (planned / scheduled)', answers: ['due', 'set'], explain: '"be due to" o "be set to" + infinitivo para algo programado.' },
      { type: 'mc', q: 'I ___ phone you, but my battery died.', options: ['will', 'was going to', 'am going to', 'would have'], answer: 1, explain: 'Plan del pasado que no se cumplió → was going to.' },
      { type: 'gap', q: 'Scientists say they are on the ___ of a major breakthrough.', answers: ['verge', 'brink', 'point'], explain: '"on the verge/brink of" + sustantivo = a punto de.' },
      { type: 'mc', q: 'With so many tickets sold, the concert is ___ to be a success.', options: ['bound', 'due', 'about', 'likely that'], answer: 0, explain: '"be bound to" = es casi seguro que.' }
    ]
  },
  {
    id: 'conditionals',
    title: 'Condicionales avanzados',
    skill: 'grammar',
    summary: 'Condicionales mixtas, inversión (Had I known…, Should you…, Were it not for…) y alternativas a "if".',
    theory: [
      '<b>Mixta pasado → presente</b>: <i>If I <u>had studied</u> medicine, I <u>would be</u> a doctor now.</i>',
      '<b>Mixta presente → pasado</b>: <i>If I <u>weren\'t</u> so shy, I <u>would have spoken</u> to her yesterday.</i>',
      '<b>Inversión</b> (registro formal, muy de C1): <i><u>Had I known</u>, I would have helped. / <u>Should you need</u> help, call me. / <u>Were</u> he to resign, … / <u>Were it not for</u> your help, …</i>',
      '<b>Alternativas a if</b>: <i>provided (that), as long as, on condition that, unless, supposing, but for + sustantivo, otherwise</i>.',
      '<i>But for</i> + sustantivo = si no hubiera sido por. <i><u>But for</u> the rain, we would have won.</i>'
    ],
    mistakes: ['<s>If I would have known</s> → If I had known.', '<s>Unless you don\'t hurry</s> → Unless you hurry.'],
    exercises: [
      { type: 'kwt', q: 'I didn\'t know you were ill, so I didn\'t visit you.', key: 'HAD', start: '', end: 'would have visited you.', answers: ['had i known you were ill, i', 'had i known that you were ill, i'], explain: 'Inversión de la 3ª condicional: Had I known…, I would have…' },
      { type: 'mc', q: 'If she ___ the job in Berlin, she would be living in Germany now.', options: ['took', 'had taken', 'would take', 'has taken'], answer: 1, explain: 'Mixta: condición pasada, resultado presente.' },
      { type: 'mc', q: '___ you require any further information, please do not hesitate to contact us.', options: ['If', 'Should', 'Would', 'Were'], answer: 1, explain: '"Should you…" = If you happen to… (muy común en emails formales).' },
      { type: 'gap', q: '___ for your support, I would never have finished the project.', answers: ['but', 'were it not', 'had it not been'], explain: '"But for your support" = si no hubiera sido por tu apoyo. (Ojo: "Had it not been for" también vale.)' },
      { type: 'mc', q: 'You can borrow my car ___ you bring it back by Sunday.', options: ['unless', 'provided that', 'otherwise', 'in case'], answer: 1, explain: '"provided that" = siempre y cuando.' },
      { type: 'mc', q: 'Leave now, ___ you\'ll miss the last bus.', options: ['unless', 'otherwise', 'provided', 'if not that'], answer: 1, explain: '"otherwise" = si no, de lo contrario.' }
    ]
  },
  {
    id: 'inversion',
    title: 'Inversión para dar énfasis',
    skill: 'grammar',
    summary: 'Never have I…, Not only… but also, Hardly… when, No sooner… than, Only after…, Little did I…',
    theory: [
      'Tras una expresión negativa o restrictiva al principio de la frase, se invierte <b>auxiliar + sujeto</b> como en una pregunta.',
      '<i><u>Never have I seen</u> such a mess. / <u>Rarely do we</u> get the chance.</i>',
      '<i><u>Not only did she</u> win, <u>but</u> she <u>also</u> broke the record.</i>',
      '<i><u>Hardly/Scarcely had</u> I sat down <u>when</u> the phone rang. / <u>No sooner had</u> I sat down <u>than</u> …</i>',
      '<i><u>Only after/when/if</u> …</i>: la inversión va en la oración principal. <i>Only after the meeting <u>did I realise</u> …</i>',
      '<i><u>Under no circumstances</u> should you … / <u>At no time</u> did he … / <u>Not until</u> … did …</i>'
    ],
    mistakes: ['<s>No sooner had I arrived when</s> → than.', '<s>Only after he left I understood</s> → did I understand.'],
    exercises: [
      { type: 'kwt', q: 'I had just closed the door when the phone rang.', key: 'SOONER', start: 'No', end: 'the phone rang.', answers: ['sooner had i closed the door than'], explain: 'No sooner had + sujeto + participio + than.' },
      { type: 'mc', q: 'Not only ___ late, but he also forgot the documents.', options: ['he arrived', 'did he arrive', 'he did arrive', 'arrived he'], answer: 1, explain: 'Not only + auxiliar + sujeto.' },
      { type: 'mc', q: 'Under no circumstances ___ leave the building during the exam.', options: ['candidates should', 'should candidates', 'candidates must', 'they should'], answer: 1, explain: 'Inversión tras "Under no circumstances".' },
      { type: 'gap', q: 'Hardly had the match started ___ it began to pour with rain.', answers: ['when', 'before'], explain: 'Hardly … when.' },
      { type: 'kwt', q: 'I didn\'t realise how much I missed home until I moved abroad.', key: 'DID', start: 'Not until I moved abroad', end: 'how much I missed home.', answers: ['did i realise', 'did i realize'], explain: 'Not until … + did + sujeto + verbo.' },
      { type: 'mc', q: 'Little ___ that the police were watching them.', options: ['they knew', 'did they know', 'they did know', 'knew they'], answer: 1, explain: '"Little did they know" = no tenían ni idea.' }
    ]
  },
  {
    id: 'cleft',
    title: 'Oraciones escindidas (cleft sentences)',
    skill: 'grammar',
    summary: 'What I need is…, It was… that…, All I want is…, The reason why…',
    theory: [
      '<b>It-cleft</b>: destaca un elemento. <i><u>It was</u> Maria <u>who</u> found the mistake (not John).</i>',
      '<b>Wh-cleft</b>: <i><u>What</u> I really need <u>is</u> a holiday. / <u>What</u> happened <u>was that</u> …</i>',
      'Con acciones se usa <b>do</b>: <i><u>What</u> she <u>did was</u> (to) call the police.</i>',
      '<i><u>All</u> I want <u>is</u> … / <u>The thing that</u> annoys me <u>is</u> … / <u>The reason (why)</u> I left <u>was that</u> …</i>'
    ],
    mistakes: ['<s>What I need it is a rest</s> → What I need is a rest.', '<s>The reason is because</s> → The reason is that…'],
    exercises: [
      { type: 'kwt', q: 'I only want a bit of peace and quiet.', key: 'ALL', start: '', end: 'a bit of peace and quiet.', answers: ['all i want is'], explain: 'All I want is …' },
      { type: 'kwt', q: 'Her attitude really annoys me.', key: 'WHAT', start: '', end: 'her attitude.', answers: ['what really annoys me is', 'what annoys me is'], explain: 'Wh-cleft: What … is …' },
      { type: 'mc', q: '___ was in 2015 that I first visited Ireland.', options: ['That', 'There', 'It', 'What'], answer: 2, explain: 'It-cleft: It was … that …' },
      { type: 'mc', q: 'What the company did ___ reduce its prices.', options: ['is', 'was to', 'that', 'it was'], answer: 1, explain: 'What + sujeto + did + was (to) + infinitivo.' },
      { type: 'gap', q: 'The reason I left the job was ___ the salary was too low.', answers: ['that'], explain: '"The reason … was that" (no "because").' }
    ]
  },
  {
    id: 'passive',
    title: 'Pasiva avanzada y causativa',
    skill: 'grammar',
    summary: 'It is said that… / He is said to have…, have/get something done, pasiva con infinitivos y gerundios.',
    theory: [
      '<b>Pasiva impersonal</b>: <i><u>It is believed that</u> the thief escaped.</i> = <i>The thief <u>is believed to have escaped</u>.</i>',
      'Infinitivo perfecto (<i>to have done</i>) cuando la acción es anterior: <i>He is said <u>to have been</u> rich.</i>',
      '<b>Causativa</b>: <i>I <u>had my car repaired</u>. / She <u>got her hair cut</u>.</i> También para cosas malas: <i>He <u>had his wallet stolen</u>.</i>',
      'Gerundio/infinitivo pasivos: <i>I hate <u>being interrupted</u>. / She expects <u>to be promoted</u>.</i>',
      '<i>need + -ing</i> con sentido pasivo: <i>The walls <u>need painting</u>.</i>'
    ],
    mistakes: ['<s>It is said him to be</s> → He is said to be.', '<s>I cut my hair at the hairdresser\'s</s> → I had my hair cut.'],
    exercises: [
      { type: 'kwt', q: 'People believe that the painting was stolen last year.', key: 'BELIEVED', start: 'The painting', end: 'last year.', answers: ['is believed to have been stolen'], explain: 'Sujeto + is believed + to have been + participio.' },
      { type: 'kwt', q: 'A mechanic is going to service my car tomorrow.', key: 'HAVE', start: 'I\'m going to', end: 'tomorrow.', answers: ['have my car serviced'], explain: 'Causativa: have + objeto + participio.' },
      { type: 'mc', q: 'She can\'t stand ___ what to do.', options: ['telling', 'being told', 'to tell', 'be told'], answer: 1, explain: 'Gerundio pasivo tras "can\'t stand".' },
      { type: 'mc', q: 'The roof needs ___ before winter.', options: ['repair', 'repairing', 'to repair', 'repaired'], answer: 1, explain: '"need + -ing" con sentido pasivo.' },
      { type: 'gap', q: 'It ___ reported that the minister will resign. (present)', answers: ['is', 'has been'], explain: 'It is reported that …' }
    ]
  },
  {
    id: 'modals',
    title: 'Modales de deducción y modales en pasado',
    skill: 'grammar',
    summary: 'must have / can\'t have / might have, should have, needn\'t have vs didn\'t need to.',
    theory: [
      '<b>Deducción en pasado</b>: <i>must have done</i> (seguro que sí), <i>can\'t/couldn\'t have done</i> (seguro que no), <i>may/might/could have done</i> (quizás).',
      '<b>Crítica o arrepentimiento</b>: <i>should(n\'t) have done / ought to have done</i>.',
      '<i><u>needn\'t have done</u></i>: lo hiciste pero no hacía falta. <i>I needn\'t have cooked — they\'d already eaten.</i>',
      '<i><u>didn\'t need to do</u></i>: no hacía falta (y normalmente no lo hiciste).',
      '<i>was/were supposed to</i>: obligación o plan que no se cumplió.'
    ],
    mistakes: ['<s>He must have went</s> → must have gone.', '<s>She mustn\'t have seen me</s> (deducción) → can\'t have seen me.'],
    exercises: [
      { type: 'mc', q: 'The lights are off. They ___ to bed already.', options: ['must go', 'must have gone', 'can\'t have gone', 'should go'], answer: 1, explain: 'Deducción segura sobre el pasado.' },
      { type: 'mc', q: 'She ___ the email — she would have replied by now.', options: ['mustn\'t have read', 'can\'t have read', 'needn\'t have read', 'shouldn\'t read'], answer: 1, explain: 'Deducción negativa → can\'t have.' },
      { type: 'kwt', q: 'It wasn\'t necessary for me to bring food, but I did.', key: 'NEEDN\'T', start: 'I', end: 'food.', answers: ["needn't have brought"], explain: 'Lo hiciste y no era necesario → needn\'t have + participio.' },
      { type: 'kwt', q: 'It was a mistake to tell him the truth.', key: 'SHOULDN\'T', start: 'You', end: 'him the truth.', answers: ["shouldn't have told"], explain: 'Crítica sobre el pasado.' },
      { type: 'mc', q: 'We ___ to arrive at 8, but the flight was delayed.', options: ['were supposed', 'should', 'must have', 'had better'], answer: 0, explain: '"were supposed to" = plan que no se cumplió.' }
    ]
  },
  {
    id: 'unreal',
    title: 'Deseos y pasado irreal',
    skill: 'grammar',
    summary: 'I wish / If only, it\'s (high) time, would rather, as if / as though.',
    theory: [
      '<i>wish/if only + past simple</i>: deseo sobre el presente. <i>I wish I <u>had</u> more time.</i>',
      '<i>wish/if only + past perfect</i>: arrepentimiento sobre el pasado. <i>If only I <u>had listened</u>.</i>',
      '<i>wish + would</i>: queja sobre lo que otro hace. <i>I wish you <u>would stop</u> interrupting.</i>',
      '<i>It\'s (high/about) time + sujeto + past simple</i>. <i>It\'s time we <u>left</u>.</i>',
      '<i>would rather + sujeto + past simple</i>: <i>I\'d rather you <u>didn\'t smoke</u> here.</i>',
      '<i>as if / as though</i> + pasado para algo irreal: <i>He talks as if he <u>were</u> the boss.</i>'
    ],
    mistakes: ['<s>I wish I would have</s> → I wish I had.', '<s>It\'s time we go</s> → It\'s time we went.'],
    exercises: [
      { type: 'kwt', q: 'I regret not studying harder at school.', key: 'WISH', start: 'I', end: 'harder at school.', answers: ['wish i had studied', "wish i'd studied"], explain: 'Arrepentimiento del pasado → wish + past perfect.' },
      { type: 'mc', q: 'It\'s high time you ___ a decision.', options: ['make', 'made', 'will make', 'have made'], answer: 1, explain: 'It\'s high time + past simple.' },
      { type: 'mc', q: 'I\'d rather you ___ anyone about this.', options: ['don\'t tell', 'didn\'t tell', 'not tell', 'won\'t tell'], answer: 1, explain: 'would rather + sujeto + past simple.' },
      { type: 'gap', q: 'If ___ I had taken the job in London!', answers: ['only'], explain: 'If only = ojalá.' },
      { type: 'mc', q: 'I wish my neighbours ___ so much noise at night.', options: ['didn\'t make', 'wouldn\'t make', 'don\'t make', 'won\'t make'], answer: 1, explain: 'Queja sobre un comportamiento → wish + would.' }
    ]
  },
  {
    id: 'clauses',
    title: 'Relativas y oraciones de participio',
    skill: 'grammar',
    summary: 'Relativas con preposición (in which, of whom), whereby, y participios para resumir ideas.',
    theory: [
      'Registro formal: preposición delante. <i>the person <u>to whom</u> I spoke / the extent <u>to which</u> …</i>',
      'Cuantificadores: <i>many of whom, some of which, neither of which, the majority of whom</i>.',
      '<i>whereby</i> = por el cual (método). <i>a system <u>whereby</u> employees share profits</i>.',
      '<b>Participio presente</b> (activo): <i><u>Feeling</u> tired, I went to bed.</i> <b>Participio pasado</b> (pasivo): <i><u>Built</u> in 1890, the house …</i>',
      '<b>Perfecto</b>: <i><u>Having finished</u> the report, she left.</i> Ojo: el sujeto debe ser el mismo en ambas partes.'
    ],
    mistakes: ['<s>Walking down the street, a car hit me</s> (¡el coche no caminaba!) → Walking down the street, I was hit by a car.', '<s>The people which</s> → who.'],
    exercises: [
      { type: 'mc', q: 'She has three brothers, all of ___ live abroad.', options: ['them', 'who', 'whom', 'which'], answer: 2, explain: 'Cuantificador + of whom.' },
      { type: 'mc', q: '___ the report, she sent it to her manager.', options: ['Having written', 'Written', 'Being written', 'Wrote'], answer: 0, explain: 'Participio perfecto: acción anterior, mismo sujeto.' },
      { type: 'gap', q: 'They introduced a scheme ___ customers earn points for every purchase.', answers: ['whereby', 'in which', 'by which'], explain: 'whereby = mediante el cual.' },
      { type: 'mc', q: '___ in 1889, the Eiffel Tower was initially criticised.', options: ['Completing', 'Completed', 'Having completed', 'To complete'], answer: 1, explain: 'Participio pasado con sentido pasivo.' },
      { type: 'gap', q: 'This is the extent to ___ the problem has grown.', answers: ['which'], explain: 'the extent to which …' }
    ]
  },
  {
    id: 'verbpatterns',
    title: 'Gerundio vs infinitivo',
    skill: 'grammar',
    summary: 'Verbos que cambian de significado: remember, forget, stop, try, regret, go on, mean.',
    theory: [
      '<i>remember/forget <u>doing</u></i> (recuerdo del pasado) vs <i>remember/forget <u>to do</u></i> (no olvidar una tarea).',
      '<i>stop <u>doing</u></i> (dejar de) vs <i>stop <u>to do</u></i> (parar para hacer otra cosa).',
      '<i>try <u>doing</u></i> (probar algo como experimento) vs <i>try <u>to do</u></i> (intentar con esfuerzo).',
      '<i>regret <u>to inform</u> you</i> (anuncio formal) vs <i>regret <u>doing</u></i> (arrepentirse).',
      '<i>mean <u>doing</u></i> (implicar) vs <i>mean <u>to do</u></i> (tener intención).',
      'Tras preposición siempre <b>-ing</b>: <i>look forward to <u>hearing</u>, object to <u>paying</u>, be committed to <u>improving</u></i>.'
    ],
    mistakes: ['<s>I look forward to hear from you</s> → to hearing.', '<s>I\'m used to work late</s> → to working late.'],
    exercises: [
      { type: 'mc', q: 'I\'ll never forget ___ the Grand Canyon for the first time.', options: ['to see', 'seeing', 'see', 'to have seen'], answer: 1, explain: 'Recuerdo de algo vivido → forget + -ing.' },
      { type: 'mc', q: 'We regret ___ you that your application has been unsuccessful.', options: ['informing', 'to inform', 'inform', 'having informed'], answer: 1, explain: 'Fórmula formal → regret to inform.' },
      { type: 'mc', q: 'If the printer doesn\'t work, try ___ it off and on again.', options: ['to turn', 'turning', 'turn', 'turned'], answer: 1, explain: 'Probar algo como solución → try + -ing.' },
      { type: 'gap', q: 'I look forward to ___ (hear) from you.', answers: ['hearing'], explain: '"to" es preposición → -ing.' },
      { type: 'mc', q: 'Taking the job would mean ___ to another city.', options: ['to move', 'moving', 'move', 'moved'], answer: 1, explain: 'mean + -ing = implicar.' },
      { type: 'mc', q: 'On the way home, we stopped ___ some bread.', options: ['buying', 'to buy', 'buy', 'for buy'], answer: 1, explain: 'Parar para hacer algo → stop + to.' }
    ]
  },
  {
    id: 'linking',
    title: 'Conectores y marcadores del discurso',
    skill: 'writing',
    summary: 'Los conectores que suben nota en Writing: contraste, causa, consecuencia, adición y concesión.',
    theory: [
      '<b>Contraste</b>: <i>however, nevertheless, nonetheless, whereas, while, on the other hand, conversely</i>.',
      '<b>Concesión</b>: <i>although, even though, despite / in spite of (+ -ing o sustantivo), albeit (+ adjetivo/sustantivo), admittedly</i>.',
      '<b>Causa / consecuencia</b>: <i>owing to, due to, as a result, consequently, hence, thereby</i>.',
      '<b>Adición</b>: <i>furthermore, moreover, in addition, what is more, not to mention</i>.',
      '<b>Opinión y conclusión</b>: <i>it could be argued that, on balance, all things considered, to sum up</i>.',
      'Puntuación: <i>However,</i> va tras punto o punto y coma, nunca une dos frases con coma.'
    ],
    mistakes: ['<s>Despite of the rain</s> → Despite the rain / In spite of the rain.', '<s>I like it, however it\'s expensive</s> → I like it; however, it\'s expensive.'],
    exercises: [
      { type: 'mc', q: 'The plan was effective, ___ expensive.', options: ['albeit', 'despite', 'whereas', 'however'], answer: 0, explain: 'albeit + adjetivo = aunque.' },
      { type: 'mc', q: '___ having trained hard, he didn\'t qualify.', options: ['Although', 'Despite', 'However', 'Even though'], answer: 1, explain: 'Despite + -ing.' },
      { type: 'mc', q: 'Some people prefer cities, ___ others enjoy rural life.', options: ['whereas', 'despite', 'moreover', 'hence'], answer: 0, explain: 'Contraste entre dos ideas → whereas.' },
      { type: 'gap', q: 'The flight was cancelled ___ to bad weather.', answers: ['owing', 'due'], explain: 'owing to / due to + sustantivo.' },
      { type: 'mc', q: 'Costs rose sharply; ___, the company raised its prices.', options: ['nevertheless', 'consequently', 'whereas', 'albeit'], answer: 1, explain: 'Consecuencia → consequently.' }
    ]
  },
  {
    id: 'wordformation',
    title: 'Formación de palabras (Part 3)',
    skill: 'vocab',
    summary: 'Prefijos negativos y sufijos clave para la Part 3 de Use of English.',
    theory: [
      '<b>Prefijos negativos</b>: <i>un- (unlikely), in- (inaccurate), im- (impatient), ir- (irrelevant), il- (illegal), dis- (disagree), mis- (misunderstand), non- (non-existent)</i>.',
      '<b>Sustantivos</b>: <i>-tion, -ment, -ness, -ity, -ance/-ence, -ship, -hood</i>. Ej: <i>reliable → reliability, aware → awareness</i>.',
      '<b>Adjetivos</b>: <i>-ful, -less, -ous, -ive, -able/-ible, -al, -ic</i>. Ej: <i>effect → effective, ignore → ignorant</i>.',
      '<b>Verbos</b>: <i>-en (widen), -ise/-ize (modernise), en- (enable), -ify (simplify)</i>.',
      'Truco del examen: mira qué categoría pide el hueco (¿después de "the"? → sustantivo; ¿antes de un sustantivo? → adjetivo) y si la frase es negativa en sentido.'
    ],
    mistakes: ['<s>unpossible</s> → impossible.', '<s>The importantness</s> → The importance.'],
    exercises: [
      { type: 'wf', q: 'The ___ of the results surprised everyone.', base: 'ACCURATE', answers: ['accuracy', 'inaccuracy'], explain: 'Tras "the" → sustantivo.' },
      { type: 'wf', q: 'His comments were completely ___ to the discussion.', base: 'RELEVANT', answers: ['irrelevant'], explain: 'Sentido negativo → ir-.' },
      { type: 'wf', q: 'We need to ___ the road to reduce traffic jams.', base: 'WIDE', answers: ['widen'], explain: 'Verbo con -en.' },
      { type: 'wf', q: 'There is a growing ___ of the dangers of plastic.', base: 'AWARE', answers: ['awareness'], explain: 'Sustantivo con -ness.' },
      { type: 'wf', q: 'The instructions were so ___ that nobody could follow them.', base: 'CONFUSE', answers: ['confusing'], explain: 'Adjetivo -ing (causa la confusión).' },
      { type: 'wf', q: 'She has a ___ for getting into trouble.', base: 'TEND', answers: ['tendency'], explain: 'Sustantivo: tendency.' }
    ]
  },
  {
    id: 'collocations',
    title: 'Colocaciones y phrasal verbs C1',
    skill: 'vocab',
    summary: 'Combinaciones de palabras que suenan naturales y que el examen pregunta en la Part 1.',
    theory: [
      '<b>Verbo + sustantivo</b>: <i>draw a conclusion, raise awareness, pose a threat, meet a deadline, bear in mind, take into account, place emphasis on</i>.',
      '<b>Adjetivo + sustantivo</b>: <i>heavy traffic, a vast majority, a sharp increase, a narrow escape, a broad range</i>.',
      '<b>Adverbio + adjetivo</b>: <i>highly unlikely, deeply concerned, bitterly disappointed, fully aware</i>.',
      '<b>Phrasal verbs C1</b>: <i>come up with (idear), put forward (proponer), carry out (llevar a cabo), bring about (provocar), rule out (descartar), stem from (derivar de), live up to (estar a la altura)</i>.'
    ],
    mistakes: ['<s>make a conclusion</s> → draw/reach a conclusion.', '<s>strongly disappointed</s> → bitterly/deeply disappointed.'],
    exercises: [
      { type: 'mc', q: 'The study ___ the conclusion that sleep affects memory.', options: ['made', 'drew', 'did', 'took'], answer: 1, explain: 'draw a conclusion.' },
      { type: 'mc', q: 'Climate change ___ a serious threat to coastal cities.', options: ['makes', 'poses', 'gives', 'puts'], answer: 1, explain: 'pose a threat.' },
      { type: 'mc', q: 'It\'s ___ unlikely that he\'ll arrive on time.', options: ['highly', 'strongly', 'heavily', 'greatly'], answer: 0, explain: 'highly unlikely.' },
      { type: 'gap', q: 'The police have not ruled ___ the possibility of murder.', answers: ['out'], explain: 'rule out = descartar.' },
      { type: 'gap', q: 'The film didn\'t live up ___ my expectations.', answers: ['to'], explain: 'live up to = estar a la altura de.' },
      { type: 'mc', q: 'Many of his health problems ___ from a poor diet.', options: ['stem', 'come up', 'bring', 'carry'], answer: 0, explain: 'stem from = derivar de.' }
    ]
  },
  {
    id: 'reporting',
    title: 'Estilo indirecto y verbos de reporte',
    skill: 'grammar',
    summary: 'accuse of, insist on, deny, urge, warn against… Imprescindible para la Part 4 (key word transformation).',
    theory: [
      '<b>verbo + -ing</b>: <i>deny, admit, suggest, recommend</i>. <i>He <u>denied taking</u> the money.</i>',
      '<b>verbo + preposición + -ing</b>: <i>accuse sb <u>of</u>, blame sb <u>for</u>, insist <u>on</u>, apologise <u>for</u>, congratulate sb <u>on</u>, warn sb <u>against</u></i>.',
      '<b>verbo + objeto + to</b>: <i>urge, advise, encourage, persuade, warn, remind sb <u>to</u> do</i>.',
      '<b>verbo + to</b>: <i>refuse, offer, threaten, promise, agree</i>.',
      '<i>suggest</i> nunca va con "to": <i>She suggested <u>going</u> / suggested <u>that we (should) go</u>.</i>'
    ],
    mistakes: ['<s>He suggested me to go</s> → He suggested (that) I (should) go.', '<s>She accused him to lie</s> → of lying.'],
    exercises: [
      { type: 'kwt', q: '"You stole my bike!" Tom said to Jack.', key: 'ACCUSED', start: 'Tom', end: 'his bike.', answers: ['accused jack of stealing', 'accused jack of having stolen'], explain: 'accuse sb of + -ing.' },
      { type: 'kwt', q: '"I\'ll pay for dinner, no arguments," said Anna.', key: 'INSISTED', start: 'Anna', end: 'for dinner.', answers: ['insisted on paying'], explain: 'insist on + -ing.' },
      { type: 'mc', q: 'The doctor ___ me to take more exercise.', options: ['suggested', 'urged', 'insisted', 'denied'], answer: 1, explain: 'urge sb to do.' },
      { type: 'mc', q: 'He apologised ___ late.', options: ['to be', 'for being', 'being', 'of being'], answer: 1, explain: 'apologise for + -ing.' },
      { type: 'kwt', q: '"Don\'t swim in the river, it\'s dangerous," the guide told us.', key: 'WARNED', start: 'The guide', end: 'in the river.', answers: ['warned us not to swim', 'warned us against swimming'], explain: 'warn sb not to do / against doing.' }
    ]
  }
];

/* ---------- Use of English (formato examen) ---------- */
export const UOE = {
  part1: [
    {
      title: 'The power of sleep',
      text: 'Scientists have long [1] that sleep plays a vital role in memory. A recent study, [2] out at a leading university, has shed new light on the process. Participants who slept after learning a list of words were far more likely to [3] them the next day. Researchers believe that during deep sleep the brain [4] the day\'s experiences, strengthening some connections and discarding others. The findings [5] doubt on the common habit of studying late into the night. "Pulling an all-nighter may seem productive, but it often has the [6] effect," explained the lead author. She [7] students to take regular breaks and to bear in [8] that rest is part of learning, not a waste of time.',
      gaps: [
        { options: ['suspected', 'doubted', 'wondered', 'questioned'], answer: 0 },
        { options: ['taken', 'carried', 'brought', 'made'], answer: 1 },
        { options: ['remind', 'recall', 'remark', 'revise'], answer: 1 },
        { options: ['processes', 'proceeds', 'progresses', 'produces'], answer: 0 },
        { options: ['put', 'cast', 'throw', 'place'], answer: 1 },
        { options: ['opposite', 'contrary', 'reverse', 'inverse'], answer: 0 },
        { options: ['suggests', 'urges', 'insists', 'proposes'], answer: 1 },
        { options: ['thought', 'head', 'brain', 'mind'], answer: 3 }
      ]
    },
    {
      title: 'Working from home',
      text: 'When offices closed overnight, few people could have [1] how permanent remote work would become. Companies that had previously [2] the idea suddenly discovered that productivity did not [3] — in some cases, it actually improved. Not everyone, however, has [4] to the change. Many employees say they miss the informal conversations that used to take [5] by the coffee machine, and some managers find it hard to keep [6] of what their teams are doing. Experts suggest that a hybrid model may [7] the best balance, provided that companies make a genuine [8] to keep remote staff included.',
      gaps: [
        { options: ['foreseen', 'previewed', 'forecast', 'overseen'], answer: 0 },
        { options: ['refused', 'dismissed', 'denied', 'declined'], answer: 1 },
        { options: ['suffer', 'damage', 'harm', 'injure'], answer: 0 },
        { options: ['adapted', 'fitted', 'suited', 'matched'], answer: 0 },
        { options: ['part', 'turn', 'place', 'hold'], answer: 2 },
        { options: ['track', 'trace', 'sight', 'touch'], answer: 0 },
        { options: ['strike', 'hit', 'reach', 'meet'], answer: 0 },
        { options: ['effort', 'attempt', 'try', 'work'], answer: 0 }
      ]
    }
  ],
  part2: [
    {
      title: 'Learning a language as an adult',
      text: 'It is often claimed that children learn languages more easily [1] adults. While there is some truth in this, adults have advantages of [2] own. They can use their knowledge of grammar to understand [3] a sentence works, and they are usually better at organising their study time. What matters most, [4] to experts, is regular exposure. [5] matter how busy you are, fifteen minutes a day is more effective [6] two hours once a week. It is also important not to be afraid of making mistakes, [7] they are a natural part of the learning process. [8] all, nobody ever learnt to swim without getting wet.',
      answers: [['than'], ['their'], ['how'], ['according'], ['no'], ['than'], ['as', 'since', 'because', 'for'], ['after']]
    },
    {
      title: 'A different kind of holiday',
      text: 'More and more travellers are choosing "slow travel", [1] means spending longer in one place instead of rushing between cities. The idea is to get to know a place [2] a local would, shopping at markets and chatting to neighbours. [3] it may sound less exciting, many say it is far more rewarding. It also has a smaller impact on the environment, [4] fewer flights are needed. Of course, not [5] can take a month off work. But [6] if you only have a week, you can still apply the principle: choose one base and explore the surrounding area, rather [7] trying to see everything at [8].',
      answers: [['which'], ['as', 'like'], ['although', 'though', 'while', 'whilst'], ['as', 'since', 'because'], ['everyone', 'everybody'], ['even'], ['than'], ['once']]
    }
  ],
  part3: [
    {
      title: 'Volunteering',
      text: 'Volunteering is a [1] way of meeting people and gaining experience. Many young people find that it increases their [2] when looking for a job. Employers value the [3] and teamwork that volunteers develop. However, some organisations report a [4] of volunteers at weekends. It is [5] to expect people to work for free every week, so flexible schemes are essential. Charities that offer clear [6] and training tend to keep their volunteers for longer. Above all, volunteers need to feel that their contribution is [7] and that their work makes a real [8].',
      gaps: [
        { base: 'REWARD', answers: ['rewarding'] },
        { base: 'EMPLOY', answers: ['employability'] },
        { base: 'RESPONSIBLE', answers: ['responsibility'] },
        { base: 'SHORT', answers: ['shortage'] },
        { base: 'REAL', answers: ['unrealistic'] },
        { base: 'GUIDE', answers: ['guidance'] },
        { base: 'APPRECIATE', answers: ['appreciated'] },
        { base: 'DIFFER', answers: ['difference'] }
      ]
    },
    {
      title: 'Online reviews',
      text: 'Before buying almost anything, most of us now check online reviews. But how [1] are they? Studies suggest that a significant number of reviews are written by people with a financial [2] in the product. Some companies even pay for [3] comments about their competitors. As a result, consumers are becoming increasingly [4] of reviews that seem too good to be true. Experts recommend reading a [5] of opinions and paying attention to [6] details. Reviews that describe a real experience, including minor problems, tend to be more [7] than vague praise. In short, a little [8] can save you a lot of money.',
      gaps: [
        { base: 'RELY', answers: ['reliable'] },
        { base: 'INTERESTED', answers: ['interest'] },
        { base: 'FAVOUR', answers: ['unfavourable', 'unfavorable'] },
        { base: 'SUSPECT', answers: ['suspicious'] },
        { base: 'VARY', answers: ['variety'] },
        { base: 'SPECIFY', answers: ['specific'] },
        { base: 'BELIEVE', answers: ['believable'] },
        { base: 'SCEPTIC', answers: ['scepticism', 'skepticism'] }
      ]
    }
  ],
  part4: [
    { type: 'kwt', q: 'It\'s possible that she missed the train.', key: 'MAY', start: 'She', end: 'the train.', answers: ['may have missed'], explain: 'may have + participio.' },
    { type: 'kwt', q: 'I\'ve never eaten such delicious food.', key: 'MOST', start: 'This is', end: 'I have ever eaten.', answers: ['the most delicious food'], explain: 'Superlativo + present perfect.' },
    { type: 'kwt', q: 'They think the fire was started deliberately.', key: 'THOUGHT', start: 'The fire', end: 'started deliberately.', answers: ['is thought to have been'], explain: 'Pasiva impersonal con infinitivo perfecto.' },
    { type: 'kwt', q: 'He was too nervous to speak.', key: 'SO', start: 'He was', end: 'he couldn\'t speak.', answers: ['so nervous that'], explain: 'so + adjetivo + that.' },
    { type: 'kwt', q: 'I didn\'t go to the party because I was ill.', key: 'BEEN', start: 'If I hadn\'t', end: 'I would have gone to the party.', answers: ['been ill'], explain: 'Tercera condicional.' },
    { type: 'kwt', q: 'The concert was cancelled because of the storm.', key: 'CALLED', start: 'The concert', end: 'because of the storm.', answers: ['was called off'], explain: 'call off = cancelar.' },
    { type: 'kwt', q: 'She regrets not accepting the offer.', key: 'WISHES', start: 'She', end: 'the offer.', answers: ['wishes she had accepted', "wishes she'd accepted"], explain: 'wish + past perfect.' },
    { type: 'kwt', q: 'It was difficult for me to understand his accent.', key: 'DIFFICULTY', start: 'I', end: 'his accent.', answers: ['had difficulty understanding', 'had difficulty in understanding'], explain: 'have difficulty (in) + -ing.' },
    { type: 'kwt', q: 'Nobody told me about the change of plan.', key: 'INFORMED', start: 'I', end: 'the change of plan.', answers: ['was not informed about', "wasn't informed about", 'was not informed of', "wasn't informed of"], explain: 'Pasiva: was not informed about/of.' },
    { type: 'kwt', q: 'Although he is rich, he lives very simply.', key: 'DESPITE', start: '', end: ', he lives very simply.', answers: ['despite being rich', 'despite his wealth', 'despite the fact that he is rich'], explain: 'despite + -ing / sustantivo / the fact that.' },
    { type: 'kwt', q: 'I\'m sure he didn\'t mean to offend you.', key: 'CAN\'T', start: 'He', end: 'to offend you.', answers: ["can't have meant", 'cannot have meant'], explain: 'Deducción negativa: can\'t have + participio.' },
    { type: 'kwt', q: 'The last time I saw her was in 2020.', key: 'SINCE', start: 'I', end: '2020.', answers: ["haven't seen her since", 'have not seen her since'], explain: 'Present perfect negativo + since.' }
  ]
};

/* ---------- Dictados (se leen con la voz del navegador) ---------- */
export const DICTATIONS = [
  { level: 'B2', text: 'The meeting has been postponed until further notice.' },
  { level: 'B2', text: 'She had been working there for years before she was promoted.' },
  { level: 'B2', text: 'If I were you, I would apply for that scholarship.' },
  { level: 'B2', text: 'Despite the heavy rain, thousands of people attended the festival.' },
  { level: 'B2', text: 'The government is expected to announce new measures next week.' },
  { level: 'B2', text: 'I would rather stay at home than go out in this weather.' },
  { level: 'B2', text: 'He apologised for not having replied to my email sooner.' },
  { level: 'B2', text: 'Our flight was delayed owing to a technical problem.' },
  { level: 'C1', text: 'Not only did the company exceed its targets, but it also reduced its emissions.' },
  { level: 'C1', text: 'Had we known about the strike, we would have taken a different route.' },
  { level: 'C1', text: 'The findings cast doubt on the effectiveness of the treatment.' },
  { level: 'C1', text: 'It is widely believed that the painting was stolen during the war.' },
  { level: 'C1', text: 'Little did she know that her life was about to change forever.' },
  { level: 'C1', text: 'The proposal was rejected on the grounds that it was too expensive.' },
  { level: 'C1', text: 'What struck me most was the generosity of the local people.' },
  { level: 'C1', text: 'Under no circumstances should you share your password with anyone.' },
  { level: 'C1', text: 'The vast majority of respondents were in favour of the new scheme.' },
  { level: 'C1', text: 'Were it not for her determination, the project would never have succeeded.' },
  { level: 'C1', text: 'Researchers are on the verge of a significant breakthrough in cancer treatment.' },
  { level: 'C1', text: 'The rise in unemployment can be attributed to a number of factors.' },
  { level: 'C1', text: 'Hardly had the speaker begun when the microphone stopped working.' },
  { level: 'C1', text: 'Admittedly, the plan has its drawbacks, but on balance it is worth trying.' },
  { level: 'C1', text: 'Bearing in mind the circumstances, the team performed remarkably well.' },
  { level: 'C1', text: 'The council has come under fire for its handling of the housing crisis.' },
  { level: 'C1', text: 'Whereas some experts welcome the change, others remain deeply sceptical.' },
  { level: 'C2', text: 'The minister\'s remarks were widely interpreted as a thinly veiled criticism of his predecessor.' },
  { level: 'C2', text: 'Notwithstanding the considerable obstacles, the negotiations were brought to a successful conclusion.' },
  { level: 'C2', text: 'So convincing was his performance that the audience rose to their feet.' }
];

/* ---------- Listening (texto leído por la voz + preguntas) ---------- */
export const LISTENINGS = [
  {
    title: 'A podcast about habits',
    text: 'Welcome back to the show. Today I want to talk about habits, and in particular why most of us fail to keep our New Year\'s resolutions. The problem, according to recent research, isn\'t a lack of willpower. It\'s that we set goals which are far too ambitious. Someone who has never run decides to run ten kilometres every morning, and by the second week they\'ve given up. What psychologists recommend instead is to start with something so small that it feels almost ridiculous: one push-up, or reading a single page. The point is not the exercise itself, but building the identity of a person who shows up every day. Once that identity is established, increasing the difficulty becomes much easier. Another tip is to attach the new habit to something you already do, like practising vocabulary while your coffee is brewing.',
    questions: [
      { q: 'According to the speaker, why do people abandon resolutions?', options: ['They lack willpower.', 'Their goals are unrealistic.', 'They don\'t have enough time.', 'They choose the wrong activities.'], answer: 1 },
      { q: 'What is the main purpose of starting with a tiny habit?', options: ['To avoid injury.', 'To save time in the morning.', 'To build a sense of identity.', 'To impress other people.'], answer: 2 },
      { q: 'What does the speaker suggest about new habits?', options: ['They should replace old ones.', 'They should be linked to existing routines.', 'They should be done in the evening.', 'They should be shared with friends.'], answer: 1 }
    ]
  },
  {
    title: 'A talk on urban gardens',
    text: 'When we first proposed turning the abandoned car park into a community garden, the reaction from the council was, let\'s say, lukewarm. They were worried about costs and about who would be responsible for maintenance. So we did something rather unusual: instead of asking for money, we asked for permission to try it for six months at our own expense. Local residents donated tools, a nearby school adopted two of the beds, and a retired engineer designed a rainwater collection system. By the end of the trial, the garden was producing enough vegetables to supply a weekly market stall, and, perhaps more importantly, neighbours who had lived on the same street for twenty years were finally talking to each other. The council not only renewed our permission, but has since funded three similar projects in other parts of the city.',
    questions: [
      { q: 'How did the council initially react to the idea?', options: ['With enthusiasm.', 'Without much enthusiasm.', 'With open hostility.', 'They ignored it.'], answer: 1 },
      { q: 'What was unusual about the organisers\' approach?', options: ['They asked for a large grant.', 'They funded a trial themselves.', 'They hired a professional gardener.', 'They involved the police.'], answer: 1 },
      { q: 'What does the speaker consider perhaps the greatest benefit?', options: ['The weekly market stall.', 'The rainwater system.', 'Stronger relationships between neighbours.', 'Funding for new projects.'], answer: 2 }
    ]
  }
];

/* ---------- Writing (formato Cambridge C1 Advanced) ---------- */
export const WRITING_TASKS = [
  { id: 'essay1', part: 1, genre: 'Essay', words: '220–260', prompt: 'Your class has attended a panel discussion on what governments can do to encourage people to lead healthier lives. You have made the notes below.\n\nMethods: • taxes on unhealthy food • free sports facilities • education campaigns\n\nOpinions expressed: "People don\'t like being told what to eat." / "If sport were free, more people would do it." / "Children need to learn healthy habits at school."\n\nWrite an essay discussing TWO of the methods in your notes. Explain which method you think is more effective, giving reasons to support your opinion.' },
  { id: 'essay2', part: 1, genre: 'Essay', words: '220–260', prompt: 'Your class has watched a documentary on how cities could reduce traffic congestion. You have made the notes below.\n\nMethods: • improving public transport • charging drivers to enter the city centre • encouraging remote work\n\nOpinions expressed: "Buses are too slow and unreliable." / "Charges are unfair for people on low incomes." / "Not every job can be done from home."\n\nWrite an essay discussing TWO of the methods in your notes. Explain which method you think is more effective, giving reasons to support your opinion.' },
  { id: 'essay3', part: 1, genre: 'Essay', words: '220–260', prompt: 'Your class has had a discussion about how technology has affected the way young people learn. You have made the notes below.\n\nAreas affected: • access to information • concentration • communication with teachers\n\nOpinions expressed: "Everything is online now — you don\'t need to memorise anything." / "Nobody can focus for more than five minutes." / "Students can get help any time."\n\nWrite an essay discussing TWO of the areas in your notes. Explain which area has been affected more, giving reasons to support your opinion.' },
  { id: 'report1', part: 2, genre: 'Report', words: '220–260', prompt: 'The manager of the language school where you study wants to improve the facilities for students. You have been asked to write a report on the current facilities, explaining what students like and dislike about them, and recommending which improvements should be made first.\n\nWrite your report.' },
  { id: 'proposal1', part: 2, genre: 'Proposal', words: '220–260', prompt: 'Your company wants to improve the well-being of its employees and has invited staff to submit proposals. Write a proposal describing the current situation, suggesting two or three initiatives, and explaining how they would benefit both the employees and the company.\n\nWrite your proposal.' },
  { id: 'review1', part: 2, genre: 'Review', words: '220–260', prompt: 'An international website is inviting readers to submit reviews of a book, film or series that taught them something important. Write a review describing the work, explaining what you learnt from it, and saying whether you would recommend it to other people.\n\nWrite your review.' },
  { id: 'letter1', part: 2, genre: 'Formal letter / email', words: '220–260', prompt: 'You recently attended a professional conference which was poorly organised. Write a letter to the organisers explaining what went wrong, how it affected you and other attendees, and suggesting what they should do differently next year.\n\nWrite your letter.' },
  { id: 'email1', part: 2, genre: 'Informal email', words: '220–260', prompt: 'An English-speaking friend is thinking of moving to your city for work and has asked for your advice. Write an email describing what it is like to live there, the advantages and disadvantages, and giving advice about finding accommodation and making friends.\n\nWrite your email.' }
];

/* ---------- Speaking (para el tutor IA en modo examinador) ---------- */
export const SPEAKING_PARTS = [
  { id: 'p1', name: 'Part 1 · Interview', minutes: 2, desc: 'Preguntas personales sobre ti, tus estudios, trabajo y aficiones.' },
  { id: 'p2', name: 'Part 2 · Long turn', minutes: 4, desc: 'Comparas dos de tres situaciones (descritas por el examinador) durante 1 minuto.' },
  { id: 'p3', name: 'Part 3 · Collaborative task', minutes: 4, desc: 'Discutes con tu "compañero" (la IA) sobre un tema con 5 opciones y llegáis a un acuerdo.' },
  { id: 'p4', name: 'Part 4 · Discussion', minutes: 5, desc: 'Preguntas abiertas y más abstractas sobre el tema de la Part 3.' }
];

/* ---------- Vocabulario (tarjetas con repaso espaciado) ---------- */
export const VOCAB = [
  ['draw a conclusion', 'sacar una conclusión'], ['raise awareness', 'concienciar'], ['pose a threat', 'suponer una amenaza'],
  ['meet a deadline', 'cumplir un plazo'], ['bear in mind', 'tener en cuenta'], ['take into account', 'tener en cuenta / considerar'],
  ['come up with', 'idear, proponer'], ['put forward', 'presentar (una propuesta)'], ['carry out', 'llevar a cabo'],
  ['bring about', 'provocar, ocasionar'], ['rule out', 'descartar'], ['stem from', 'derivar de'],
  ['live up to', 'estar a la altura de'], ['look into', 'investigar'], ['phase out', 'eliminar gradualmente'],
  ['set out to', 'proponerse'], ['come across', 'toparse con / dar la impresión'], ['account for', 'explicar / representar (%)'],
  ['call for', 'exigir, requerir'], ['fall short of', 'no alcanzar'], ['highly unlikely', 'muy poco probable'],
  ['deeply concerned', 'profundamente preocupado'], ['bitterly disappointed', 'tremendamente decepcionado'], ['fully aware', 'plenamente consciente'],
  ['a sharp increase', 'un aumento brusco'], ['a steady decline', 'un descenso constante'], ['the vast majority', 'la inmensa mayoría'],
  ['a narrow escape', 'salvarse por los pelos'], ['a broad range of', 'una amplia gama de'], ['to a large extent', 'en gran medida'],
  ['nevertheless', 'sin embargo, no obstante'], ['albeit', 'aunque (+ adj./sust.)'], ['whereas', 'mientras que'],
  ['hence', 'de ahí, por lo tanto'], ['thereby', 'de ese modo'], ['owing to', 'debido a'],
  ['notwithstanding', 'a pesar de'], ['admittedly', 'hay que reconocer que'], ['on balance', 'en general, sopesándolo todo'],
  ['detrimental', 'perjudicial'], ['feasible', 'viable'], ['reluctant', 'reacio'],
  ['thriving', 'próspero, floreciente'], ['unprecedented', 'sin precedentes'], ['controversial', 'polémico'],
  ['to tackle', 'abordar (un problema)'], ['to undermine', 'socavar, minar'], ['to enhance', 'mejorar, realzar'],
  ['to foster', 'fomentar'], ['to hinder', 'obstaculizar'], ['to outweigh', 'superar (en peso/importancia)'],
  ['to cope with', 'hacer frente a'], ['to comply with', 'cumplir (normas)'], ['to be prone to', 'ser propenso a'],
  ['a drawback', 'un inconveniente'], ['a breakthrough', 'un gran avance'], ['a setback', 'un revés, contratiempo'],
  ['a trade-off', 'un compromiso, equilibrio entre dos cosas'], ['a bottleneck', 'un cuello de botella'], ['the bottom line', 'lo esencial, el resultado final'],
  ['get the hang of', 'cogerle el truco a'], ['by and large', 'en general'], ['in the long run', 'a la larga'],
  ['a far cry from', 'muy distinto de'], ['the tip of the iceberg', 'la punta del iceberg'], ['to cut corners', 'hacer algo de forma chapucera para ahorrar'],
  ['to make ends meet', 'llegar a fin de mes'], ['to take for granted', 'dar por sentado'], ['to stand a chance', 'tener posibilidades'],
  ['up to a point', 'hasta cierto punto'], ['for the time being', 'por el momento'], ['as a rule of thumb', 'como regla general']
];
