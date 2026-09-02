import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HandTracker } from "./hand/HandTracker.js";
import { pinch, openPalm, fist, roll, palmDepth, thumbUp, peace } from "./hand/HandMath.js";
import { makeShape, COLORS, applyMaterial } from "./scene/ShapeFactory.js";
import { SelectionManager } from "./interaction/SelectionManager.js";
import { TransformManager } from "./interaction/TransformManager.js";
import { Physics } from "./interaction/Physics.js";
import { Particles } from "./effects/Particles.js";
import { Trail } from "./effects/Trail.js";
import { serialize, parse } from "./scene/SceneIO.js";
import "./style.css";

const $ = (id) => document.getElementById(id);
const video = $("webcam"), canvas = $("scene"), start = $("startBtn");
const status = $("status"), gesture = $("gesture"), handsUI = $("handCount");
const selUI = $("selectedCount"), modeUI = $("modeText"), cursor = $("cursor");
const reticle = $("reticle"), err = $("error"), statusDot = $("statusDot");
const controlPanel = $("controlPanel"), controlsBtn = $("controlsBtn");
const minimizeBtn = $("minimizeBtn"), closeBtn = $("closeBtn");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

scene.add(new THREE.AmbientLight(0xffffff, 1.65));
const key = new THREE.DirectionalLight(0xffffff, 3.7);
key.position.set(3, 5, 8);
scene.add(key);
const fill = new THREE.PointLight(0x66ccff, 18, 20);
fill.position.set(-5, 2, 5);
scene.add(fill);

const grid = new THREE.GridHelper(14, 28, 0x557799, 0x334455);
grid.rotation.x = Math.PI / 2;
grid.position.z = -1.8;
grid.material.transparent = true;
grid.material.opacity = 0.18;
grid.visible = false;
scene.add(grid);

let objects = [];
let colorIndex = 0;

function objectColor(o, fallback = 0xffffff) {
  let color = fallback;
  o?.traverse?.((c) => {
    if (c.isMesh && c.material?.color) color = c.material.color.getHex();
  });
  return color;
}

function objectHasMaterial(o) {
  let found = false;
  o?.traverse?.((c) => {
    if (c.isMesh && c.material) found = true;
  });
  return found;
}

const selection = new SelectionManager();
const transform = new TransformManager();
const physics = new Physics();
const particles = new Particles(scene);
const trails = new Trail(scene);
const tracker = new HandTracker(video, (message) => {
  status.textContent = message;
});
const loader = new GLTFLoader();

function add(kind = "ico", color = COLORS[colorIndex++ % COLORS.length], pos = new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4, 0), id = crypto.randomUUID()) {
  const o = makeShape(kind, color, pos, id);
  scene.add(o);
  objects.push(o);
  trails.add(o);
  return o;
}

function reset(showToast = false) {
  objects.forEach((o) => {
    scene.remove(o);
    o.traverse?.((child) => {
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => mat.dispose?.());
      }
    });
  });
  objects = [];
  grabbed = [null, null];
  was = [false, false];
  selection.clear();
  transform.end();
  if (showToast) toast("Scene cleared — add an object to begin");
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let grabbed = [null, null];
let was = [false, false];
let prevRoll = [0, 0];
let two = false;
let started = false;
let lastTime = performance.now();
let fistLatch=false,gestureLatch="",lastHandX=null,lastHandT=0,recording=false,replaying=false,recordFrames=[],replayIndex=0;
let performanceMode=localStorage.getItem("handspace-performance")==="1";
let cameraPreview=localStorage.getItem("handspace-preview")!=="0";

// Start with a completely empty scene. All state used by reset() is initialized above.
reset(false);

function hit(x, y) {
  ndc.set(x * 2 - 1, -(y * 2 - 1));
  ray.setFromCamera(ndc, camera);
  const child = ray.intersectObjects(objects, true)[0]?.object;
  if (!child) return null;

  let root = child;
  while (root.parent && root.parent !== scene) root = root.parent;
  return objects.includes(root) ? root : child;
}

function moveCursor(h) {
  const x = (1 - h[8].x) * innerWidth;
  const y = h[8].y * innerHeight;
  cursor.style.left = x + "px";
  cursor.style.top = y + "px";
  cursor.style.display = "block";
  reticle.style.left = x + "px";
  reticle.style.top = y + "px";
  reticle.style.display = "block";
}

function release(i, throwIt = true) {
  const o = grabbed[i];
  if (!o) return;
  if (throwIt) {
    o.userData.velocity.copy(o.position).sub(o.userData.lastPos).multiplyScalar(25).clampLength(0, 6);
  }
  o.userData.grabber = null;
  grabbed[i] = null;
}

function grab(i, h) {
  const o = hit(1 - h[8].x, h[8].y);
  if (!o) return;
  if (!selection.has(o)) selection.add(o);
  grabbed[i] = o;
  o.userData.grabber = i;
  o.userData.velocity.set(0, 0, 0);
  o.userData.lastPos.copy(o.position);
  particles.burst(o.position, objectColor(o), 12);
}

function worldFromHand(h) {
  const x = (1 - h[8].x) * 2 - 1;
  const y = -(h[8].y * 2 - 1);
  const v = new THREE.Vector3(x, y, 0.5).unproject(camera);
  const d = v.sub(camera.position).normalize();
  const p = camera.position.clone().add(d.multiplyScalar(9));
  return new THREE.Vector3(p.x, p.y, THREE.MathUtils.clamp((0.02 - palmDepth(h)) * 8, -2.3, 2.3));
}

function move(i, h) {
  const o = grabbed[i];
  if (!o) return;
  o.userData.lastPos.copy(o.position);
  o.position.lerp(worldFromHand(h), 0.35);
  let d = roll(h) - prevRoll[i];
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  o.rotation.z -= d * 1.7;
  prevRoll[i] = roll(h);
}

function process(hs){
  handsUI.textContent=`${hs.length} HAND${hs.length===1?"":"S"}`;
  if(!hs.length){release(0,false);release(1,false);was=[false,false];two=false;transform.end();cursor.style.display="none";reticle.style.display="none";modeUI.textContent="Idle";gesture.textContent="Show one or two hands";return}
  moveCursor(hs[0]);
  const both=hs.length===2&&pinch(hs[0])&&pinch(hs[1]);
  hs.forEach((h,i)=>{const p=pinch(h);if(!both){if(p&&!was[i]){grab(i,h);prevRoll[i]=roll(h)}if(!p&&was[i])release(i,true);if(p)move(i,h)}else if(!was[i]&&p){const o=hit(1-h[8].x,h[8].y);if(o&&!selection.has(o))selection.add(o);grabbed[i]=null}was[i]=p});
  if(both){if(!two){release(0,false);release(1,false);transform.begin(selection.objects(),hs[0],hs[1]);two=true}transform.update(selection.objects(),hs[0],hs[1]);modeUI.textContent="Two-hand Transform";gesture.textContent="Spread = scale · twist = rotate"}else if(two){two=false;transform.end()}
  const palms=hs.length===2&&openPalm(hs[0])&&openPalm(hs[1]);if(palms&&gestureLatch!=="palms"){selection.clear();release(0,false);release(1,false);gestureLatch="palms";toast("Selection cleared")}if(!palms&&gestureLatch==="palms")gestureLatch="";
  const f=fist(hs[0]);if(f&&!fistLatch&&selection.count()){const c=new THREE.Vector3();selection.objects().forEach(o=>c.add(o.position));c.multiplyScalar(1/selection.count());selection.objects().forEach(o=>{o.position.lerp(c,.55);o.userData.velocity.set(0,0,0)});particles.burst(c,0xffffff,28);toast("Objects snapped to center")}fistLatch=f;
  if(thumbUp(hs[0])&&gestureLatch!=="thumb"){gestureLatch="thumb";cycleColor()}if(!thumbUp(hs[0])&&gestureLatch==="thumb")gestureLatch="";
  if(peace(hs[0])&&gestureLatch!=="peace"){gestureLatch="peace";toggleGrid()}if(!peace(hs[0])&&gestureLatch==="peace")gestureLatch="";
  const now=performance.now(),hx=1-hs[0][8].x;if(lastHandX!==null&&now-lastHandT<180){const vx=(hx-lastHandX)/Math.max(.016,(now-lastHandT)/1000);if(!both&&Math.abs(vx)>2.4){const o=hit(1-hs[0][8].x,hs[0][8].y);if(o){selection.clear();selection.add(o);particles.burst(o.position,objectColor(o),18);toast("Swipe selected")}}}lastHandX=hx;lastHandT=now;
  if(!two){const i=hs.findIndex(pinch),o=hit(1-hs[0][8].x,hs[0][8].y);gesture.textContent=i>=0?`Pinching · depth + momentum · ${selection.count()} selected`:o?"Shape highlighted — pinch to grab":"Point at a shape, then pinch";modeUI.textContent=i>=0?"Grab / Depth":"Hover"}
  selUI.textContent=`${selection.count()} object${selection.count()===1?"":"s"}`;
}

function setControls(open) {
  if (!controlPanel || !controlsBtn) return;
  controlPanel.classList.toggle("is-hidden", !open);
  controlPanel.setAttribute("aria-hidden", String(!open));
  controlsBtn.setAttribute("aria-expanded", String(open));
  controlsBtn.textContent = open ? "☰ Hide Controls" : "☰ Controls";
}

controlsBtn.onclick = () => setControls(controlPanel.classList.contains("is-hidden"));
closeBtn.onclick = () => setControls(false);
minimizeBtn.onclick = () => {
  controlPanel.classList.toggle("minimized");
  minimizeBtn.textContent = controlPanel.classList.contains("minimized") ? "+" : "—";
  minimizeBtn.title = controlPanel.classList.contains("minimized") ? "Expand" : "Minimize";
  minimizeBtn.setAttribute("aria-label", controlPanel.classList.contains("minimized") ? "Expand controls" : "Minimize controls");
};

function cycleColor(){if(!selection.count()){toast("Select an object first");return}colorIndex=(colorIndex+1)%COLORS.length;selection.objects().forEach(o=>applyMaterial(o,{color:COLORS[colorIndex]}));particles.burst(selection.objects()[0].position,COLORS[colorIndex],18);toast("Color changed")}
function setSelectedMaterial(s){if(!selection.count()){toast("Select an object first");return}selection.objects().forEach(o=>applyMaterial(o,s));toast("Material updated")}
function toggleGrid(){grid.visible=!grid.visible;toast(grid.visible?"Grid on":"Grid off")}
function snapshot(){return objects.map(o=>({id:o.userData.id,p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray()}))}
function restoreFrame(f){f.forEach(x=>{const o=objects.find(y=>y.userData.id===x.id);if(o){o.position.fromArray(x.p);o.quaternion.fromArray(x.q);o.scale.fromArray(x.s)}})}

start.onclick = async () => {
  try {
    err.style.display = "none";
    statusDot.classList.add("active");

    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Webcam API unavailable in this browser.");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    await tracker.init();

    started = true;
    start.disabled = true;
    start.textContent = "Camera Enabled";
    status.textContent = "Hand tracking ready";
    gesture.textContent = "Show your hand to begin";
  } catch (e) {
    console.error("HandSpace startup error:", e);

    // If MediaPipe fails after the webcam starts, release the camera so the
    // user can retry cleanly instead of leaving the device locked.
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    tracker.close?.();
    started = false;
    start.disabled = false;
    start.textContent = "Enable Camera";
    status.textContent = "Hand tracking failed";
    err.textContent =
      "Webcam works, but hand tracking failed: " +
      (e?.message || String(e));
    err.style.display = "block";
    statusDot.classList.remove("active");
  }
};

document.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
  const o = add(b.dataset.add);
  selection.clear();
  selection.add(o);
  particles.burst(o.position, objectColor(o));
  toast("Added");
});

$("deleteBtn").onclick = () => {
  selection.objects().forEach((o) => {
    particles.burst(o.position, objectColor(o));
    scene.remove(o);
    objects = objects.filter((x) => x !== o);
  });
  selection.clear();
  toast("Deleted");
};

$("duplicateBtn").onclick = () => {
  const primitiveKinds = new Set(["ico", "box", "torus", "tetra", "octa"]);
  const copies = [];
  selection.objects().forEach((o) => {
    if (!primitiveKinds.has(o.userData.kind)) return;
    const c = add(o.userData.kind, objectColor(o), o.position.clone().add(new THREE.Vector3(0.5, 0.4, 0)));
    c.scale.copy(o.scale);
    c.rotation.copy(o.rotation);
    copies.push(c);
  });
  if (!copies.length && selection.count()) toast("Imported models can't be duplicated yet");
  selection.clear();
  copies.forEach((o) => selection.add(o));
  if (copies.length) toast("Duplicated");
};

$("clearBtn").onclick = () => selection.clear();
$("resetBtn").onclick = () => reset(true);
$("gridBtn").onclick=toggleGrid;
$("physicsBtn").onclick=()=>{physics.enabled=!physics.enabled;$("physicsBtn").textContent=physics.enabled?"🧲 Physics On":"🧲 Physics Off";toast(physics.enabled?"Physics on":"Physics off")};
$("collisionBtn").onclick=()=>{physics.collisions=!physics.collisions;$("collisionBtn").textContent=physics.collisions?"💥 Collisions On":"💥 Collisions Off";toast(physics.collisions?"Collisions on":"Collisions off")};
$("colorBtn").onclick=cycleColor;$("opaqueBtn").onclick=()=>setSelectedMaterial({opacity:.98,transmission:0});$("glassBtn").onclick=()=>setSelectedMaterial({opacity:.42,transmission:.35,roughness:.08});$("metalBtn").onclick=()=>setSelectedMaterial({metalness:.9,roughness:.22});
$("performanceBtn").onclick=()=>{performanceMode=!performanceMode;localStorage.setItem("handspace-performance",performanceMode?"1":"0");renderer.setPixelRatio(performanceMode?1:Math.min(devicePixelRatio,2));$("performanceBtn").textContent=performanceMode?"⚡ Performance":"✨ Quality";toast(performanceMode?"Performance mode":"Quality mode")};
$("previewBtn").onclick=()=>{cameraPreview=!cameraPreview;localStorage.setItem("handspace-preview",cameraPreview?"1":"0");video.classList.toggle("camera-hidden",!cameraPreview);$("previewBtn").textContent=cameraPreview?"🎥 Camera On":"🎥 Camera Off"};
$("recordBtn").onclick=()=>{if(recording){recording=false;$("recordBtn").textContent="🔴 Record";toast(`Recorded ${recordFrames.length} frames`)}else{recordFrames=[];recording=true;$("recordBtn").textContent="⏹ Stop";toast("Recording")}};
$("replayBtn").onclick=()=>{if(!recordFrames.length){toast("Record something first");return}replaying=true;replayIndex=0;toast("Replay started")};

$("saveBtn").onclick = () => {
  const primitiveObjects = objects.filter((o) => ["ico", "box", "torus", "tetra", "octa"].includes(o.userData.kind));
  const blob = new Blob([serialize(primitiveObjects,{grid:grid.visible,physics:physics.enabled,collisions:physics.collisions})], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "handspace-scene.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(objects.length === primitiveObjects.length ? "Scene saved" : "Primitives saved");
};

$("loadBtn").onclick = () => $("fileInput").click();
$("fileInput").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    objects.forEach((o) => scene.remove(o));
    objects = [];
    selection.clear();
    const data=parse(await f.text());
    data.objects.forEach((x) => {
      const o = add(x.kind, x.color, new THREE.Vector3(...x.position), x.id);
      o.rotation.fromArray(x.rotation || [0, 0, 0]);
      o.scale.fromArray(x.scale || [1, 1, 1]);
    });
    toast("Scene loaded");
  } catch (ex) {
    console.error("Scene load error:", ex);
    err.textContent = "Could not load scene: " + (ex?.message || ex);
    err.style.display = "block";
  }
  e.target.value = "";
};

$("modelBtn").onclick = () => $("modelInput").click();
$("modelInput").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  try {
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    root.position.set(0, 0, 0);
    root.scale.setScalar(1.6);
    root.userData = {
      id: crypto.randomUUID(),
      kind: "GLB",
      selected: false,
      grabber: null,
      velocity: new THREE.Vector3(),
      lastPos: root.position.clone(),
    };
    root.traverse((c) => {
      if (c.isMesh) {
        c.material = c.material?.clone?.() || new THREE.MeshStandardMaterial({ color: 0xffffff });
        c.material.transparent = true;
        c.material.opacity = 0.85;
      }
    });
    scene.add(root);
    objects.push(root);
    trails.add(root);
    selection.clear();
    selection.add(root);
    particles.burst(root.position, objectColor(root), 35);
    toast("GLB imported");
  } catch (ex) {
    console.error("GLB import error:", ex);
    err.textContent = "Could not import model: " + (ex?.message || ex);
    err.style.display = "block";
  } finally {
    URL.revokeObjectURL(url);
    e.target.value = "";
  }
};

function toast(t) {
  const x = $("toast");
  x.textContent = t;
  x.style.display = "block";
  clearTimeout(toast.t);
  toast.t = setTimeout(() => x.style.display = "none", 1300);
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  physics.update(objects, dt);
  particles.update(dt);
  trails.update();
  if(recording)recordFrames.push(snapshot());
  if(replaying){if(replayIndex<recordFrames.length)restoreFrame(recordFrames[replayIndex++]);else{replaying=false;toast("Replay finished")}}

  objects.forEach((o, i) => {
    if (o !== grabbed[0] && o !== grabbed[1] && !o.userData.grabber && !replaying) {
      o.rotation.x += 0.0012 + i * 0.00015;
      o.rotation.y += 0.0018;
    }
    if (o.userData.selected) {
      o.traverse((c) => {
        if (c.userData?.ring) c.rotation.z += 0.012;
      });
    }
  });

  if(!animate.f||now-animate.f.t>500){$("fps").textContent=`${Math.round((animate.f?.n||0)*1000/(now-(animate.f?.t||now)))||0} FPS`;animate.f={n:0,t:now}}else animate.f.n++;
  renderer.render(scene, camera);
}

function detect() {
  requestAnimationFrame(detect);
  if (!started) return;
  const hs = tracker.detect();
  if (hs !== null) process(hs);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

animate();
detect();
