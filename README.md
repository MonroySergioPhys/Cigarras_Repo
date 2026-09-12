# 🦗 Cicadas — Laboratorio de acústica bioinspirada

<p align="center">
  <img src="assets/cicadas.svg" alt="Cicadas" width="120">
</p>

<h3 align="center">
  Del sonido a los datos.<br>
  De los datos a la biología.
</h3>

<p align="center">
  Herramienta educativa para explorar grabaciones acústicas de cigarras
  mediante procesamiento digital de señales.
</p>

<p align="center">
  <a href="https://monroysergiophys.github.io/Cigarras_Repo/">🚀 <strong>Probar Cicadas</strong></a>
  &nbsp;&nbsp;•&nbsp;&nbsp;
  <a href="https://github.com/MonroySergioPhys/Cigarras_Repo">💻 <strong>Ver código</strong></a>
</p>

---

## Índice

- [¿Qué es Cicadas?](#-qué-es-cicadas)
- [Funcionalidades](#-funcionalidades)
- [Selección de intervalo](#-selección-de-intervalo)
- [Tres formas de mirar el mismo sonido](#-tres-formas-de-mirar-el-mismo-sonido)
- [Sonograma en tiempo real](#-sonograma-en-tiempo-real)
- [Indicadores acústicos](#-indicadores-acústicos)
- [Flujo de procesamiento](#-flujo-de-procesamiento)
- [¿Por qué estudiar cigarras?](#-por-qué-estudiar-cigarras)
- [Metodología](#-metodología)
- [Fundamento teórico](#-fundamento-teórico)
- [Arquitectura del proyecto](#-arquitectura-del-proyecto)
- [Tecnologías](#-tecnologías)
- [Privacidad](#-privacidad)
- [Ejecutar el proyecto](#-ejecutar-el-proyecto)
- [Contexto académico](#-contexto-académico)
- [Hoja de ruta](#️-hoja-de-ruta)
- [Autor](#-autor)
- [Licencia](#-licencia)

---

## 🔬 ¿Qué es Cicadas?

**Cicadas** es un pequeño laboratorio digital de acústica diseñado para
transformar una grabación sonora en información que puede ser observada,
analizada e interpretada.

La aplicación permite estudiar una misma señal desde tres perspectivas
complementarias:

> **Tiempo → Frecuencia → Tiempo–Frecuencia**

Una grabación deja de ser solamente un archivo de audio y se convierte en
una señal que puede estudiarse con herramientas de procesamiento digital
de señales.

El proyecto está pensado principalmente como una herramienta educativa,
especialmente útil para estudiantes de **Física, Biología, Ciencias
Naturales e Ingeniería**.

La aplicación funciona directamente en el navegador — no es necesario
instalar Python, MATLAB ni otro software especializado para el análisis
básico.

---

## 🎧 Funcionalidades

- 🎵 Cargar una grabación (WAV, MP3, OGG, WebM y otros formatos soportados
  por el navegador).
- 🎙️ Grabar directamente con el micrófono.
- 🔎 Seleccionar un intervalo específico dentro de la grabación.
- 📈 Estudiar el espectro de frecuencias (FFT).
- 🌈 Observar la evolución temporal mediante un sonograma (STFT).
- ⚡ Analizar el sonido **en tiempo real**, con seguimiento de la
  frecuencia dominante.
- 📐 Calcular indicadores acústicos (RMS, pico, crest factor, centroide
  espectral).
- 💾 Reproducir y descargar el audio cargado o grabado.

---

## 🎯 Selección de intervalo

Las grabaciones pueden ser largas, por lo que Cicadas separa dos ideas:
**navegar por toda la grabación** y **analizar detalladamente una región**.

Una grabación puede contener minutos de silencio, ruido ambiental o
eventos que no son relevantes para la pregunta biológica:

```text
Grabación completa
│
├───────────────┬────────────────────┬───────────────┐
│               │                    │               │
ruido          vocalización          ruido          ambiente
                ▲
                │
          intervalo de interés
```

La vista general permite localizar rápidamente una parte interesante del
registro; después se selecciona el intervalo que se desea estudiar. Esto
concentra el procesamiento más costoso únicamente en la región de interés.

---

## 📈 Tres formas de mirar el mismo sonido

Una señal acústica contiene mucha información — por eso Cicadas utiliza
tres representaciones complementarias.

### 1. Forma de onda — `x(t)`

Representa la señal en función del tiempo. Permite responder:

> ¿Cómo cambia el sonido con el tiempo?

Características observables: amplitud, pulsos, periodicidad, cambios
rápidos, duración de eventos acústicos, regiones de mayor actividad.

### 2. Transformada de Fourier — `X(f) = 𝓕{x(t)}`

Pasa del dominio temporal al dominio frecuencial. En lugar de preguntar
cómo cambia la señal con el tiempo, permite responder:

> ¿Qué frecuencias están presentes?

Variables analizables: frecuencia dominante, distribución espectral,
centroide espectral, amplitud relativa, componentes armónicas.

### 3. Sonograma (STFT) — `X(τ,f)`

El espectro de Fourier por sí solo no indica *cuándo* aparece una
determinada frecuencia. Para estudiar simultáneamente tiempo y frecuencia
se usa la **Transformada de Fourier de Tiempo Corto (STFT)**: la señal se
divide en ventanas cortas y se calcula una FFT para cada una.

```text
Frecuencia
    ↑
    │       ╱╲
    │      ╱  ╲       ╱╲
    │ ────╱────╲─────╱──╲────
    │      patrones acústicos
    └────────────────────────→ Tiempo
```

Permite observar: pulsos, armónicos, bandas de frecuencia, cambios de
frecuencia, duración de vocalizaciones, patrones repetitivos, evolución
temporal de la señal.

---

## ⚡ Sonograma en tiempo real

Cicadas incorpora un modo de análisis en vivo: el micrófono alimenta
continuamente el análisis y se genera un sonograma dinámico tipo cascada.

```text
                 tiempo →
┌──────────────────────────────────────┐
│ ░░▒▒▓▓████▓▓▒▒░░                     │
│ ░▒▓████████▓▒░░░                     │
│ ▒▓██▓▒▒▓██▓▒░░░                      │
│ ░░▒▓███▓▒░░░                          │
└──────────────────────────────────────┘
↑ frecuencia
```

Los datos más recientes aparecen por un extremo mientras los más antiguos
desaparecen, y se realiza seguimiento de la **frecuencia dominante** en
cada instante.

**Útil para:** observar vocalizaciones en tiempo real, experimentar con
señales acústicas, localizar frecuencias dominantes, estudiar cambios
rápidos, visualizar de inmediato la respuesta del sistema.

---

## 📐 Indicadores acústicos

A partir del intervalo seleccionado se calculan las siguientes
características de la señal.

| Indicador | Fórmula | Qué mide |
|---|---|---|
| **RMS** | $x_{\mathrm{RMS}} = \sqrt{\frac{1}{N}\sum_{n=0}^{N-1} x_n^2}$ | Magnitud energética de la señal |
| **Pico de amplitud** | $x_{\max} = \max\lvert x_n\rvert$ | Mayor valor absoluto de la señal |
| **Crest factor** | $CF = \dfrac{x_{\max}}{x_{\mathrm{RMS}}}$ | Distingue señales impulsivas de señales uniformes |
| **Frecuencia dominante** | — | Componente frecuencial con mayor contribución en el espectro |
| **Centroide espectral** | $f_c = \dfrac{\sum_k f_k A_k}{\sum_k A_k}$ | "Centro de gravedad" del espectro ($A_k$ = amplitud en cada frecuencia) |

---

## 🧠 Flujo de procesamiento

```text
                🎙️
             Grabación
                 │
                 ▼
        ┌─────────────────┐
        │    Señal x(t)   │
        └─────────────────┘
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
      Tiempo   Fourier   STFT
        │        │        │
        ▼        ▼        ▼
     Onda      FFT    Sonograma
        │        │        │
        └────────┼────────┘
                 ▼
          Características
             acústicas
                 │
                 ▼
        🦗 Interpretación
            biológica
```

La idea central no es solamente producir gráficas, sino conectar:

> **señal → procesamiento → característica → interpretación**

---

## 🦗 ¿Por qué estudiar cigarras?

Las cigarras producen señales acústicas altamente estructuradas que
pueden estudiarse desde distintas disciplinas.

Desde la física, una vocalización puede analizarse como una señal
oscilatoria con determinada estructura temporal y espectral. Desde la
biología, las vocalizaciones pueden estar relacionadas con:

- comunicación;
- reconocimiento;
- competencia;
- comportamiento reproductivo;
- identificación de especies;
- interacción con el ambiente.

Características como frecuencia dominante, estructura armónica,
duración, repetición, intensidad relativa y evolución temporal pueden
usarse como información para comparar diferentes registros acústicos.

---

## 🔬 Metodología

Cicadas está pensado como un pequeño laboratorio reproducible:

```text
┌──────────────┐
│   REGISTRAR  │  carga una grabación o usa el micrófono
└──────┬───────┘
       ↓
┌──────────────┐
│ SELECCIONAR  │  localiza un intervalo representativo
└──────┬───────┘
       ↓
┌──────────────┐
│  TRANSFORMAR │  obtén su representación temporal, espectral y tiempo–frecuencia
└──────┬───────┘
       ↓
┌──────────────┐
│    MEDIR     │  observa las características acústicas obtenidas
└──────┬───────┘
       ↓
┌──────────────┐
│  INTERPRETAR │  relaciona los patrones con la pregunta biológica
└──────────────┘
```

---

## 📚 Fundamento teórico

**Señal temporal**

$$x(t)$$

Describe la evolución de la señal registrada.

**Transformada de Fourier**

$$X(f) = \int_{-\infty}^{\infty} x(t)\,e^{-i2\pi ft}\, dt$$

Permite estudiar la composición frecuencial de la señal.

**STFT**

$$X(\tau,f) = \int_{-\infty}^{\infty} x(t)\,w(t-\tau)\,e^{-i2\pi ft}\, dt$$

donde $w(t-\tau)$ es una ventana localizada alrededor del instante
$\tau$. Esto permite estudiar simultáneamente **qué frecuencias
aparecen y cuándo aparecen**:

$$x(t) \;\longrightarrow\; X(f) \;\longrightarrow\; X(\tau,f)$$

---

## 🧪 Arquitectura del proyecto

```text
Cigarras_Repo/
│
├── index.html
├── package.json
├── README.md
├── LICENSE
├── NOTICE
│
├── assets/
│   ├── cicadas.svg
│   └── logos institucionales
│
├── styles/
│   ├── main.css
│   └── loading.css
│
└── src/
    ├── app.js               orquesta la interacción general de la aplicación
    ├── audio.js              carga y decodificación de archivos de audio
    ├── recorder.js            captura de audio mediante el micrófono
    ├── analysis.js            FFT, STFT, conversión a mono, características acústicas
    ├── plotting.js            representaciones gráficas (Plotly)
    ├── timeline.js            navegación y selección del intervalo de análisis
    └── liveSpectrogram.js     sonograma y espectro en tiempo real
```

---

## 💻 Tecnologías

| Tecnología | Uso |
|---|---|
| HTML5 | Estructura |
| CSS3 | Diseño e interfaz |
| JavaScript (ES modules) | Lógica y procesamiento |
| Web Audio API | Audio y micrófono |
| Plotly.js | Visualización científica |
| FFT / STFT | Análisis frecuencial y tiempo–frecuencia |
| GitHub Pages | Publicación |

El procesamiento se realiza directamente en el navegador, sin backend ni
build step.

---

## 🔐 Privacidad

**Tus archivos permanecen en tu navegador.** El análisis se realiza
localmente — no se envía ningún archivo a un servidor.

```text
                 TU COMPUTADOR
                       │
                       ▼
                 🎵 Archivo
                       │
                       ▼
              ┌────────────────┐
              │ Cicadas Web App│
              └────────────────┘
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
             FFT      STFT     RMS
              │        │        │
              └────────┼────────┘
                       ▼
                  📊 Resultados
```

---

## 🚀 Ejecutar el proyecto

### Localmente

```bash
git clone https://github.com/MonroySergioPhys/Cigarras_Repo.git
cd Cigarras_Repo
python -m http.server 8000
```

Luego abre `http://localhost:8000`.

> Se recomienda usar un servidor local en lugar de abrir `index.html`
> directamente, especialmente por los módulos ES y el acceso al
> micrófono (`getUserMedia`).

### Versión publicada

No necesitas clonar el repositorio para usar el laboratorio:

## 🦗 [monroysergiophys.github.io/Cigarras_Repo](https://monroysergiophys.github.io/Cigarras_Repo/)

---

## 🎓 Contexto académico

Cicadas nace como un proyecto académico orientado a la aplicación de
conceptos de Física, procesamiento digital de señales, análisis de
Fourier, análisis tiempo–frecuencia, acústica, programación,
visualización científica y bioacústica.

El proyecto busca servir como puente entre una descripción matemática de
una señal y su interpretación dentro de un contexto experimental.

---

## 🗺️ Hoja de ruta

- [ ] Comparación automática entre grabaciones
- [ ] Detección automática de vocalizaciones
- [ ] Clasificación de patrones acústicos
- [ ] Identificación de armónicos
- [ ] Comparación entre especies
- [ ] Exportación de resultados
- [ ] Generación de reportes
- [ ] Análisis estadístico de múltiples grabaciones
- [ ] Herramientas adicionales para bioacústica

---

## 🧑‍💻 Autor

**Sergio David Monroy Barragán**
🎓 Universidad del Tolima — 🔬 Programa de Física

Proyecto académico relacionado con física computacional, procesamiento
de señales y bioacústica.

---

## 📄 Licencia

Este proyecto se distribuye bajo los términos de la **Apache License
2.0**. Consulta [`LICENSE`](LICENSE) para el texto completo y
[`NOTICE`](NOTICE) para el aviso de autoría.

Cualquier redistribución debe conservar los avisos de copyright,
licencia y atribución correspondientes. Las modificaciones realizadas
sobre archivos existentes deben indicarse de acuerdo con los términos de
la licencia.

---

<p align="center">
  <strong>Escucha. Visualiza. Analiza. Interpreta.</strong><br><br>
  🎙️ → 📈 → 🌈 → 🧬<br><br>
  <em>Una señal acústica también puede ser una ventana hacia la biología.</em>
</p>

<p align="center">
  <sub>Cicadas — Laboratorio de acústica bioinspirada</sub>
</p>
