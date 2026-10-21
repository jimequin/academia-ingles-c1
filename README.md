# Academia C1 — Road to Cambridge Advanced

Tu academia de inglés personal para preparar el **Cambridge C1 Advanced (CAE)**.
Es una app web sencilla (HTML + CSS + JavaScript, sin frameworks ni instalación)
que se instala en el móvil como una app.

## Qué incluye

| Sección | Qué hace |
|---|---|
| 🏠 **Hoy** | Tu "clase del día" según el cronograma, racha de días, horas estudiadas y nota estimada. |
| 🗓️ **Plan** | Cronograma semana a semana desde hoy hasta la fecha de tu examen, en 3 fases (consolidación → núcleo C1 → técnica de examen), con evaluaciones mensuales y simulacros. |
| 📚 **Clases** | 14 clases de gramática y vocabulario C1 (inversión, cleft sentences, condicionales mixtas, pasiva avanzada, word formation, colocaciones…) con teoría en español, errores típicos y ejercicios corregidos al momento. |
| ✍️ **Práctica** | Use of English Parts 1–4 en formato examen, dictados, listening (2 escuchas, como en el examen), reading, writing, tarjetas de vocabulario con repaso espaciado, evaluación y simulacro. |
| 💬 **Tutor** | Conversación con un profesor de IA: charla libre, clase particular de un tema, **examinador de Speaking** (Parts 1–4, con nota según los criterios Cambridge) o corrector de frases. Puedes hablarle con el micrófono y te responde en voz alta. |
| 📈 **Progreso** | Gráfico de tu evolución en la escala Cambridge (C1 = 180), destrezas, puntos débiles e historial. |

Al abrirla por primera vez te pide tu nombre, la fecha del examen y cuánto
tiempo tienes al día, y te hace un **test de nivel** (25 preguntas, A2→C2)
para ajustar el plan.

## La parte de IA (opcional, pero recomendable)

El tutor de conversación, la corrección de writings y los ejercicios/lecturas
nuevos usan **Claude** a través de la API de Anthropic. Sin clave, todo lo demás
funciona igual (clases, Use of English, dictados, listening, evaluaciones…).

1. Crea una cuenta en <https://console.anthropic.com> y añade algo de saldo.
2. Ve a **Settings → API Keys** y crea una clave.
3. En la app: **⚙️ Ajustes → Clave de API**, pégala y guarda.

En Ajustes puedes elegir el modelo: Opus 5.5 (el mejor profesor), Sonnet 5.5
(más barato) o Haiku 5.5 (rapidísimo y muy económico). Si vas a conversar mucho
cada día, Sonnet o Haiku te saldrán bastante más baratos.

**Seguridad:** la clave se guarda solo en tu navegador (`localStorage`) y la app
habla directamente con la API de Anthropic. No está en el código ni se sube a
GitHub. Como la app es solo para ti, este sistema es suficiente; si algún día la
abrieras a más gente, habría que poner un pequeño servidor que guarde la clave.

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
├── app.js         → toda la lógica: plan, ejercicios, tests, tutor, progreso
├── data.js        → el contenido: test de nivel, clases, ejercicios, dictados…
├── ai.js          → la conexión con Claude (tutor, correcciones, ejercicios nuevos)
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
