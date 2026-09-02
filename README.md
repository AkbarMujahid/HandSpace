# ✋ HandSpace

### Hand-controlled 3D playground · V3.2

HandSpace turns a webcam into a natural controller for an interactive Three.js/WebGL scene. **V3.2 starts with a completely empty scene by design — no shapes are created until the user adds them.**

## V3.2

- 🎥 MediaPipe real-time hand tracking
- 🤏 Pinch grab + quick-release throwing
- 👐 Two-hand group scale + rotation
- ↕️ Approximate Z/depth control
- 🫳 Fist snap-to-center
- 👍 Thumb-up color switching
- ✌️ Peace gesture grid toggle
- 🖐️🖐️ Two-palm selection clear
- ↔️ Swipe selection
- 🎨 Solid / Glass / Metal material presets
- 🧲 Gravity + boundaries
- 💥 Object collisions
- 📦 GLB/GLTF import
- 💾 JSON scene save/load for primitives
- 🔴 Record / ▶ Replay transforms
- ⚡ Quality / Performance modes
- 🎥 Camera preview toggle
- 📊 FPS counter
- 🧼 Empty-by-default scene — Reset/Clear returns to a blank playground
- 📱 Responsive mobile HUD

## Stack

Three.js `0.185.0` · MediaPipe Tasks Vision `1.0.1` · Vite `7.1.3` · JavaScript · WebGL

## Run

```bash
git clone https://github.com/AkbarMujahid/HandSpace.git
cd HandSpace
npm install
npm run dev
```

## Netlify

```text
Build command: npm run build
Publish directory: dist
```

Do not commit `node_modules/` or `dist/`.

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
.DS_Store
Thumbs.db
```

## Gestures

| Gesture | Action |
|---|---|
| 👆 Point | Highlight |
| 🤏 Pinch | Grab |
| ✋ Release | Throw |
| 👐 Two pinches | Scale + rotate |
| 🫳 Fist | Snap selection |
| 👍 Thumb up | Cycle color |
| ✌️ Peace | Toggle grid |
| 🖐️🖐️ Two palms | Clear selection |
| ↔️ Swipe | Select highlighted object |

## Notes

Built-in primitives are fully saveable as JSON. Imported external model files can be manipulated in the current session but are not embedded into JSON scene files.

The current MediaPipe runtime/model are loaded from external resources, so internet access is required when initializing hand tracking.

> **Your hands are the controller.**
