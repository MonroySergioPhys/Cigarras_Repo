# 🦗 Cicadas — Laboratorio de acústica bioinspirada

Herramienta educativa para explorar grabaciones acústicas (con foco en
vocalizaciones de cigarras) mediante tres perspectivas complementarias:
**forma de onda**, **espectro (FFT)** y **sonograma (STFT)** — además de
un modo de **sonograma en tiempo real** con seguimiento de la frecuencia
dominante.

Todo el análisis corre en el navegador: no se sube ningún archivo a un
servidor.

## Autoría

**Sergio David Monroy Barragán**
Universidad del Tolima — Programa de Física

Este proyecto fue desarrollado como trabajo académico. Se distribuye
bajo la licencia **Apache License 2.0** (ver [`LICENSE`](./LICENSE)):
cualquier reutilización debe conservar el aviso de copyright original
y declarar explícitamente los cambios realizados sobre el código
fuente. Ver también [`NOTICE`](./NOTICE).

## Características

- **Carga de audio**: arrastra o selecciona un archivo (WAV, MP3, OGG,
  WebM y otros formatos que el navegador pueda decodificar).
- **Grabación con micrófono**: graba directamente desde el navegador y
  analiza el resultado igual que un archivo subido.
- **Selector de intervalo**: para audios largos, permite elegir con dos
  marcadores arrastrables qué fragmento analizar — así el análisis
  pesado (FFT/STFT) nunca intenta procesar un archivo completo de
  decenas de minutos.
- **Forma de onda, espectro FFT y sonograma STFT** del intervalo
  seleccionado, con indicadores (RMS, frecuencia dominante, centroide
  espectral, resolución de la STFT).
- **Modo en vivo**: sonograma tipo "cascada" alimentado directamente
  del micrófono, con marcador de frecuencia dominante y un espectro en
  vivo (barras) debajo, actualizándose en tiempo real.
- **Reproducción y descarga** del audio cargado o grabado.

## Cómo ejecutarlo

Este proyecto es HTML/CSS/JavaScript puro (módulos ES, sin build ni
dependencias de Node). Necesita servirse por HTTP (no abrir el
`index.html` con doble clic), porque el acceso al micrófono
(`getUserMedia`) y los módulos ES lo requieren:

```bash
# Desde la raíz del proyecto
python3 -m http.server 8000
```

Luego abre `http://localhost:8000` en el navegador.

También funciona publicado en GitHub Pages (HTTPS cumple el mismo
requisito de seguridad que localhost).

## Estructura del proyecto

```
├── index.html              Estructura de la página
├── assets/                 Favicon e íconos institucionales
├── styles/
│   ├── main.css             Sistema de diseño y layout
│   └── loading.css          Barra de progreso y estados de grabación
└── src/
    ├── app.js               Orquestación general de la interfaz
    ├── audio.js              Decodificación de archivos de audio
    ├── recorder.js            Grabación con micrófono (MediaRecorder)
    ├── analysis.js            FFT, STFT, métricas de la señal
    ├── plotting.js            Gráficas (Plotly): onda, espectro, sonograma
    ├── timeline.js            Selector de intervalo sobre audios largos
    └── liveSpectrogram.js     Sonograma en tiempo real + espectro en vivo
```

## Fundamento teórico

| Vista | Qué muestra | Pregunta que responde |
|---|---|---|
| Forma de onda `x(t)` | Amplitud en el tiempo | ¿Cómo cambia la señal? |
| Espectro `X(f)` | Energía por frecuencia (FFT) | ¿Qué frecuencias aparecen? |
| Sonograma `X(τ,f)` | Energía por frecuencia a lo largo del tiempo (STFT) | ¿Cómo evolucionan las frecuencias? |

## Tecnologías

- JavaScript (módulos ES nativos, sin framework ni build step)
- [Plotly.js](https://plotly.com/javascript/) para las gráficas
- Web Audio API (`AudioContext`, `AnalyserNode`, `MediaRecorder`)
- FFT radix-2 implementada desde cero (`src/analysis.js`)

## Licencia

Distribuido bajo la licencia Apache License 2.0 — ver [`LICENSE`](./LICENSE)
para el texto completo y [`NOTICE`](./NOTICE) para el aviso de autoría.
