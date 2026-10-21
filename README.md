# Academia C1 — Road to Cambridge Advanced

Tu academia de inglés personal para preparar el **Cambridge C1 Advanced (CAE)**.
Es una app web sencilla (HTML + CSS + JavaScript, sin frameworks ni instalación)
que se instala en el móvil como una app.

## Qué incluye

| Sección | Qué hace |
|---|---|
| 🏠 **Hoy** | Lo que toca hoy según tu horario, minutos estudiados frente a tu objetivo, racha y nota estimada. |
| 🗓️ **Plan** | Cronograma semana a semana hasta tu examen, en 3 fases (consolidación → núcleo C1 → técnica de examen), con evaluaciones mensuales y simulacros. |
| 📚 **Clases** | **Guía oficial del examen** (formato de cada parte, puntuación, criterios, estrategias y recursos gratuitos de Cambridge) y 14 clases de gramática y vocabulario C1 con teoría en español y ejercicios corregidos al momento. |
| ✍️ **Práctica** | Use of English Parts 1–4, Reading Parts 5–8 (generados por la IA con el formato oficial), dictados, listening, writing, vocabulario, examen semanal, examen mensual y simulacro. |
| 💬 **Chat** | Profesor IA dentro de la app (gratis con Gemini): *hello there* para conversar, *bye* para terminar. Sesiones de gramática de 15/20 minutos y recordatorios para el calendario. |
| 📈 **Progreso** | Tu subnivel (cada nivel dividido en 4: B2.1…B2.4, C1.1…), mejora semana a semana y mes a mes, gráfico en la escala Cambridge (C1 = 180), destrezas y puntos débiles. |

## Tu horario

| Cuándo | Qué |
|---|---|
| Lunes, martes y jueves · 7:40 | Sesión de gramática en el Chat (15 min) |
| Miércoles y viernes · 8:00 | Sesión de gramática en el Chat (20 min) |
| Miércoles y viernes | Clase de 1 h 30 |
| Fin de semana, cuando te venga bien | 4 h entre clase y ejercicios, con el **examen semanal** (y cada 4 semanas, el **examen mensual**) |

Todo se puede cambiar en **⚙️ Ajustes → Horario**. Para que el móvil te avise,
pulsa **Chat → Añadir al calendario** y abre el archivo que se descarga.

Al abrirla por primera vez te pide tu nombre, la fecha del examen y cuánto
tiempo tienes al día, y te hace un **test de nivel** (25 preguntas, A2→C2)
para ajustar el plan.

## Profesor IA gratis dentro de la app (Gemini)

1. Entra en <https://aistudio.google.com/apikey> con tu cuenta de Google y pulsa **Create API key**.
2. En la app: **⚙️ Ajustes → Profesor IA**, deja *Gemini* y pega la clave.

Con eso funcionan el tutor (*hello there* / *bye*), la corrección de writings, el
Reading y los ejercicios nuevos. Es gratis con un límite de mensajes al día.
En el plan gratuito Google puede usar las conversaciones para mejorar sus
modelos: no escribas datos personales sensibles.

## Alternativa: conversar en la app de Claude (Proyecto)

La conversación, las clases particulares, el speaking, el reading y la
corrección de writings se hacen en la **app de Claude con tu cuenta**, sin
pagar nada aparte:

1. Abre <https://claude.ai/projects> → **Create project** → llámalo *English teacher*.
2. En la app de la academia: **Chat → Copiar instrucciones del proyecto**, y
   pégalas en *Project instructions*.
3. Copia el enlace del proyecto y pégalo en **⚙️ Ajustes → Enlace a tu proyecto de Claude**.

A partir de ahí: escribe **hello there** para conversar (un tema distinto cada
día), **bye** para terminar, y Claude te corrige todo lo que digas mal. En el
móvil puedes usar el modo voz de Claude para practicar hablando. Los botones
de la academia ("Clase con Claude", "Speaking", "Corregir gratis en Claude")
copian el mensaje y abren tu proyecto: solo tienes que pegarlo.

### Opcional: IA dentro de la app (de pago)

Si algún día quieres el tutor y las correcciones dentro de la propia app, puedes
poner una clave de la API de Anthropic en **⚙️ Ajustes**. Eso se paga aparte
de tu cuenta de Claude, por uso (créditos que se gastan según los *tokens*).
No hace falta para usar la academia.

## Tus datos

Todo tu progreso vive en el navegador donde uses la app. Si cambias de móvil o
borras los datos del navegador, se pierde, así que de vez en cuando usa
**⚙️ Ajustes → Exportar** para descargar una copia (y **Importar** para recuperarla).

## Probarla en tu ordenador

```bash
cd academia-ingles-c1
python3 -m http.server 8000
```

Y abre <http://localhost:8000>. (Hace falta un servidor local porque la app usa
módulos de JavaScript, que el navegador no carga abriendo el archivo con doble clic.)

## Publicarla gratis con GitHub Pages (para usarla en el móvil)

1. En el repo: **Settings → Pages**.
2. En "Branch" elige `main` y la carpeta `/ (root)`. Guarda.
3. En un minuto estará en `https://jimequin.github.io/academia-ingles-c1/`.

**Instalarla:** en Android abre la URL en Chrome → menú ⋮ → *Instalar aplicación*.
En iPhone ábrela en Safari → compartir → *Añadir a pantalla de inicio*.

> El dictado por voz (🎤) funciona en Chrome y en Safari. Las voces en inglés
> dependen del sistema: en Ajustes puedes elegir la que más te guste (mejor una británica).

## Estructura

```
academia-ingles-c1/
├── index.html     → esqueleto de la app (pestañas y ventanas)
├── styles.css     → diseño (modo claro y oscuro)
├── app.js         → toda la lógica: pantallas, ejercicios, tests, chat, progreso
├── plan.js        → el cronograma y tu horario semanal
├── data.js        → el contenido: test de nivel, clases, ejercicios, dictados…
├── ai.js          → la conexión opcional (de pago) con la API de Claude
├── manifest.json  → hace que se pueda instalar en el móvil
├── sw.js          → permite usarla sin conexión
└── icons/         → iconos de la app
```

## Ideas para seguir aprendiendo con ella

- Añadir tus propias frases al dictado o tus palabras nuevas a las tarjetas
  (están en `data.js`, son listas normales de JavaScript).
- Añadir más textos de Use of English copiando el formato de los que ya hay.
- Guardar el progreso en una base de datos (por ejemplo Supabase) para usarla
  en varios dispositivos.
