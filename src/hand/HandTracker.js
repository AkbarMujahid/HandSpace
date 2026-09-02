import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const MEDIAPIPE_VERSION = "1.0.1";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

function describeError(error) {
  if (error == null) return "Unknown error";

  if (typeof error === "string") return error;

  if (error instanceof Error) {
    return error.message || error.name || "Unknown Error";
  }

  if (error instanceof Event) {
    const target = error.target;
    const url = target?.src || target?.href || target?.url || "";
    return `${error.type || "browser"} event${url ? ` while loading ${url}` : ""}`;
  }

  if (error?.message) return String(error.message);
  if (error?.error?.message) return String(error.error.message);
  if (error?.reason) return String(error.reason);
  if (error?.type) return `${error.type} event`;

  try {
    const text = String(error);
    return text && text !== "[object Object]" && text !== "[object Event]"
      ? text
      : "Unknown browser event";
  } catch {
    return "Unknown browser event";
  }
}

export class HandTracker {
  constructor(video, onStatus = () => {}) {
    this.video = video;
    this.landmarker = null;
    this.last = -1;
    this.onStatus = onStatus;
  }

  async init() {
    let vision;

    try {
      this.onStatus("Loading MediaPipe runtime…");
      vision = await FilesetResolver.forVisionTasks(WASM_URL);
    } catch (error) {
      const details = describeError(error);
      throw new Error(
        `MediaPipe runtime failed to load. Check your internet connection, firewall, VPN, or browser extensions. Details: ${details}`
      );
    }

    const common = {
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    };

    let gpuError = null;

    // Try GPU first for better real-time performance.
    try {
      this.onStatus("Loading hand model · GPU…");
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...common,
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
      });
      this.onStatus("Hand tracking ready · GPU");
      return;
    } catch (error) {
      gpuError = error;
      console.warn("HandSpace: GPU initialization failed; trying CPU.", error);
    }

    // CPU is the compatibility fallback.
    try {
      this.onStatus("GPU unavailable · loading hand model · CPU…");
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...common,
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "CPU",
        },
      });
      this.onStatus("Hand tracking ready · CPU");
    } catch (cpuError) {
      const gpuMessage = describeError(gpuError);
      const cpuMessage = describeError(cpuError);

      console.error("HandSpace GPU initialization error:", gpuError);
      console.error("HandSpace CPU initialization error:", cpuError);

      throw new Error(
        `MediaPipe hand tracker could not initialize. GPU: ${gpuMessage}. CPU: ${cpuMessage}.`
      );
    }
  }

  detect() {
    if (!this.landmarker || this.video.readyState < 2) return [];
    if (this.video.currentTime === this.last) return null;

    this.last = this.video.currentTime;

    try {
      const result = this.landmarker.detectForVideo(
        this.video,
        performance.now()
      );
      return result?.landmarks || [];
    } catch (error) {
      console.error("HandSpace detection error:", error);
      return [];
    }
  }

  close() {
    try {
      this.landmarker?.close?.();
    } catch (error) {
      console.warn("HandSpace: could not close hand tracker:", error);
    }
    this.landmarker = null;
    this.last = -1;
  }
}
