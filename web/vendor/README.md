# Vendored

Third-party files the app loads at run time, kept here so that the showcase edition works from a plain folder with no network.

| Path | What | From | Licence |
|---|---|---|---|
| `mediapipe/vision_bundle.mjs`, `mediapipe/wasm/*` | MediaPipe Tasks Vision 1.2.3: the JavaScript bundle and its WebAssembly runtime | npm `@mediapipe/tasks-vision@1.2.3` | Apache 2.0 |
| `mediapipe/face_landmarker.task` | Face Landmarker (478 landmarks, 52 blendshapes), float16, version 1 | `storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/` | Apache 2.0 |
| `mediapipe/hair_segmenter.tflite` | Hair segmenter, float32 | `storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/` | Apache 2.0 |
| `../fonts/fraunces*.woff2` | Fraunces variable, roman and italic, Latin | npm `@fontsource-variable/fraunces@5.3.0` | SIL Open Font License 1.1 |
| `../fonts/plex-mono-*.woff2` | IBM Plex Mono 400 and 500, Latin | npm `@fontsource/ibm-plex-mono@5.3.0` | SIL Open Font License 1.1 |

One change was made: the `//# sourceMappingURL` comment at the end of `vision_bundle.mjs` was removed, because the map is not shipped and browsers report the missing file. Nothing else is modified.

The app uses these only in `web/js/studio/reading.js`, on the CPU delegate, and never sends a frame anywhere.
