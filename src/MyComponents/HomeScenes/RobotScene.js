import React, { useRef } from "react";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import useThreeScene from "./useThreeScene";
import { robotPose, RIG, BOX_LABELS } from "./robotTimeline";

/* ── The VMS juggler ──
   A short, broad-shouldered helmet bot (white shell, black visor with blue eyes,
   headset and mic, blue trim, chunky boots) balancing STOCK · SALES · GST · DUES · CASH —
   it slips, the boxes fly, and it saves every one by juggling them back into a stack.
   Built from primitives; every joint and box comes from robotPose(t). */

const BLUE = 0x3b82f6;
const BLUE_GLOW = 0x60a5fa;
const BOX_TINT = ["#22d3ee", "#22c55e", "#a78bfa", "#f472b6", "#f59e0b"];

/* The robot keeps its own colourful stage in both app themes (see .hc-split-media--robot). */
const STAGE = { floor: 0xf5f3ff, rimA: 0xf472b6, rimB: 0x22d3ee };

function canvasTexture(THREE, w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* cardboard, a coloured band and the label — the same on every face, so a box looks right however it lands */
function boxTexture(THREE, label, tint) {
  return canvasTexture(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = "#c99a68";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "90,55,25" : "245,215,175"},${Math.random() * 0.12})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = tint;
    g.fillRect(0, h * 0.36, w, h * 0.28);
    g.fillStyle = "#ffffff";
    g.font = `800 ${label.length > 4 ? 46 : 58}px Inter, Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label, w / 2, h / 2 + 2);
    g.strokeStyle = "rgba(60,35,15,0.35)";
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
  });
}

/* a tapered limb turned on a lathe: [radius, y] pairs from the joint down */
const lathe = (THREE, pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 40);

function buildRobot(THREE) {
  const M = {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xf3f5f8, metalness: 0.05, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.28 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b2230, metalness: 0.4, roughness: 0.48 }),
    blue: new THREE.MeshStandardMaterial({ color: BLUE, metalness: 0.25, roughness: 0.4 }),
    screen: new THREE.MeshPhysicalMaterial({ color: 0x05070c, metalness: 0.25, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.04 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: BLUE_GLOW, emissiveIntensity: 2.4 }),
  };
  const mesh = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 5, r);
  const ring = (r, tube, mat = M.blue) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 40), mat);

  const root = new THREE.Group();

  /* ── legs: stubby, all white, straight into chunky boots with blue soles ── */
  const legs = {};
  [-1, 1].forEach((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * RIG.hipX, RIG.hipY, 0);
    root.add(hip);
    hip.add(mesh(new THREE.SphereGeometry(0.12, 20, 14), M.shell));
    const thigh = mesh(new THREE.CapsuleGeometry(0.12, RIG.thigh - 0.2, 6, 16), M.shell);
    thigh.position.y = -RIG.thigh / 2;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -RIG.thigh;
    hip.add(knee);
    knee.add(mesh(new THREE.SphereGeometry(0.12, 20, 14), M.shell));
    const shin = mesh(lathe(THREE, [[0.001, 0.02], [0.12, 0], [0.15, -0.12], [0.17, -0.3], [0.16, -0.38], [0.001, -0.39]]), M.shell);
    knee.add(shin);
    const boot = mesh(rbox(0.32, 0.14, 0.46, 0.06), M.shell);
    boot.position.set(0, -RIG.shin + 0.07, 0.06);
    knee.add(boot);
    const sole = mesh(rbox(0.33, 0.04, 0.47, 0.02), M.blue);
    sole.position.set(0, -RIG.shin + 0.02, 0.06);
    knee.add(sole);
    legs[side] = { hip, knee };
  });

  /* ── pelvis + torso (pivots at the waist): broad chest, blue belt, glowing badge ── */
  const pelvis = mesh(rbox(0.5, 0.2, 0.34, 0.08), M.dark);
  pelvis.position.y = RIG.hipY + 0.03;
  root.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = RIG.waistY;
  root.add(torso);
  const belt = mesh(rbox(0.6, 0.1, 0.4, 0.05), M.blue);
  belt.position.y = 0.07;
  torso.add(belt);
  const chest = mesh(rbox(0.82, 0.52, 0.48, 0.18), M.shell);
  chest.position.y = 0.38;
  torso.add(chest);
  const plate = mesh(rbox(0.36, 0.2, 0.06, 0.05), M.dark);
  plate.position.set(0, 0.42, 0.24);
  torso.add(plate);
  const badge = ring(0.05, 0.014);
  badge.position.set(0, 0.42, 0.275);
  torso.add(badge);
  const badgeCore = mesh(new THREE.CircleGeometry(0.03, 20), M.glow, false);
  badgeCore.position.set(0, 0.42, 0.276);
  torso.add(badgeCore);
  [-0.11, 0.11].forEach((x) => {
    const led = mesh(new THREE.CircleGeometry(0.014, 12), M.glow, false);
    led.position.set(x, 0.42, 0.276);
    torso.add(led);
  });
  const neck = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 20), M.dark);
  neck.position.y = 0.7;
  torso.add(neck);

  /* ── arms: broad shoulder pads → dark upper arm → white gauntlet → blue mitt ── */
  const arms = {};
  [-1, 1].forEach((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * RIG.shoulderX, RIG.shoulderY - RIG.waistY, 0);
    torso.add(shoulder);
    shoulder.add(mesh(new THREE.SphereGeometry(0.12, 22, 16), M.dark));
    const pad = mesh(rbox(0.3, 0.16, 0.36, 0.08), M.shell);
    pad.position.set(side * 0.03, 0.08, 0);
    shoulder.add(pad);
    const padTrim = mesh(rbox(0.31, 0.03, 0.37, 0.015), M.blue);
    padTrim.position.set(side * 0.03, 0.01, 0);
    shoulder.add(padTrim);
    const upper = mesh(new THREE.CapsuleGeometry(0.07, RIG.upper - 0.14, 6, 16), M.dark);
    upper.position.y = -RIG.upper / 2;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -RIG.upper;
    shoulder.add(elbow);
    elbow.add(mesh(new THREE.SphereGeometry(0.08, 18, 12), M.blue));
    const gauntlet = mesh(lathe(THREE, [[0.001, -0.04], [0.1, -0.05], [0.135, -0.13], [0.13, -0.4], [0.105, -0.46], [0.001, -0.46]]), M.shell);
    elbow.add(gauntlet);
    const band = ring(0.134, 0.012);
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.38;
    elbow.add(band);

    const hand = new THREE.Group();
    hand.position.y = -RIG.fore;
    elbow.add(hand);
    const palm = mesh(new THREE.SphereGeometry(0.08, 18, 12), M.blue);
    palm.scale.set(1.15, 0.9, 0.95);
    hand.add(palm);
    for (let f = 0; f < 4; f++) {
      const finger = mesh(new THREE.CapsuleGeometry(0.024, 0.07, 4, 8), M.blue);
      finger.position.set(-0.06 + f * 0.04, -0.08, 0.02);
      finger.rotation.x = 0.5;
      hand.add(finger);
    }
    const thumb = mesh(new THREE.CapsuleGeometry(0.026, 0.05, 4, 8), M.blue);
    thumb.position.set(-side * 0.085, -0.02, 0.05);
    thumb.rotation.z = side * 0.9;
    hand.add(thumb);
    arms[side] = { shoulder, elbow };
  });

  /* ── head: a big rounded-square helmet (the cute part), visor screen, blue eyes and brows,
        headset with a mic, a short antenna and a blue crest ── */
  const head = new THREE.Group();
  head.position.y = 1.16;
  torso.add(head);
  head.add(mesh(rbox(0.92, 0.8, 0.8, 0.3), M.shell));
  const visor = mesh(rbox(0.74, 0.46, 0.08, 0.15), M.screen);
  visor.position.set(0, -0.02, 0.38);
  head.add(visor);
  const eyes = [-1, 1].map((side) => {
    const eye = mesh(rbox(0.11, 0.15, 0.02, 0.05), M.glow, false);
    eye.position.set(side * 0.15, 0.0, 0.425);
    head.add(eye);
    const brow = mesh(rbox(0.13, 0.025, 0.02, 0.01), M.glow, false);
    brow.position.set(side * 0.15, 0.12, 0.425);
    brow.rotation.z = side * 0.18;            // a slight, confident frown
    head.add(brow);
    return eye;
  });
  const smile = mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 20, Math.PI), M.glow, false);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.12, 0.425);
  head.add(smile);
  [-1, 1].forEach((side) => {
    const can = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 28), M.blue);
    can.rotation.z = Math.PI / 2;
    can.position.set(side * 0.47, -0.02, 0);
    head.add(can);
    const canGlow = mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 28), M.glow, false);
    canGlow.rotation.y = Math.PI / 2;
    canGlow.position.set(side * 0.515, -0.02, 0);
    head.add(canGlow);
  });
  // mic boom from the right ear-can round to the mouth
  const boom = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.5, -0.06, 0.05), new THREE.Vector3(0.48, -0.2, 0.3), new THREE.Vector3(0.28, -0.26, 0.45),
  ]);
  head.add(mesh(new THREE.TubeGeometry(boom, 24, 0.014, 8, false), M.dark));
  const mic = mesh(new THREE.SphereGeometry(0.035, 12, 10), M.blue);
  mic.position.copy(boom.getPoint(1));
  head.add(mic);
  const crest = mesh(rbox(0.1, 0.06, 0.62, 0.03), M.blue);
  crest.position.set(0, 0.41, -0.02);
  head.add(crest);
  const stalk = mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.18, 8), M.dark);
  stalk.position.set(0, 0.52, -0.2);
  head.add(stalk);
  const antTip = mesh(new THREE.SphereGeometry(0.04, 14, 10), M.glow, false);
  antTip.position.set(0, 0.63, -0.2);
  head.add(antTip);

  return { root, torso, arms, legs, head, eyes, M };
}

function buildRobotScene({ THREE, renderer, scene, camera, pointer }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x6d28d9, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3.5, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 7, bottom: -2, near: 1, far: 24 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rimA = new THREE.PointLight(STAGE.rimA, 10, 12, 2);
  rimA.position.set(-3, 3.8, -2.6);
  scene.add(rimA);
  const rimB = new THREE.PointLight(STAGE.rimB, 10, 12, 2);
  rimB.position.set(3.2, 2.4, -3);
  scene.add(rimB);

  // a soft white stage disc that sits on the colourful backdrop
  const floorMat = new THREE.MeshStandardMaterial({ color: STAGE.floor, metalness: 0.1, roughness: 0.45, transparent: true, opacity: 0.92 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.9, 72), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const lineMat = new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.35 });
  [[1.15, 1.18], [1.72, 1.75]].forEach(([a, b]) => {
    const l = new THREE.Mesh(new THREE.RingGeometry(a, b, 96), lineMat);
    l.rotation.x = -Math.PI / 2;
    l.position.y = 0.003;
    scene.add(l);
  });

  /* the five boxes */
  const boxGeo = new RoundedBoxGeometry(RIG.box, RIG.box, RIG.box, 3, 0.03);
  const boxes = BOX_LABELS.map((label, i) => {
    const m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ map: boxTexture(THREE, label, BOX_TINT[i]), roughness: 0.8 }));
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  });

  const robot = buildRobot(THREE);
  scene.add(robot.root);

  const target = new THREE.Vector3(0, 1.4, 0.2);

  renderer.toneMappingExposure = 1.0;

  const update = (t) => {
    const pose = robotPose(t);
    const { root, torso, arms, legs, head, eyes } = robot;

    root.position.set(pose.root[0], pose.root[1], pose.root[2]);
    torso.rotation.set(pose.lean, 0, pose.roll);
    [[1, pose.armR], [-1, pose.armL]].forEach(([side, arm]) => {
      arms[side].shoulder.quaternion.set(arm.q[0], arm.q[1], arm.q[2], arm.q[3]);
      arms[side].elbow.rotation.x = arm.e;
    });
    legs[-1].hip.rotation.x = pose.legs.L.hip;
    legs[-1].knee.rotation.x = pose.legs.L.knee;
    legs[1].hip.rotation.x = pose.legs.R.hip;
    legs[1].knee.rotation.x = pose.legs.R.knee;
    head.rotation.set(pose.head.rot[0], pose.head.rot[1], pose.head.rot[2]);

    const blink = (t % 3.3) < 0.12 ? 0.15 : 1;
    eyes.forEach((e) => { e.scale.y = blink; });

    pose.boxes.forEach((b, i) => {
      boxes[i].position.set(b.pos[0], b.pos[1], b.pos[2]);
      boxes[i].rotation.set(b.rot[0], b.rot[1], b.rot[2]);
    });

    const az = 0.16 + 0.14 * Math.sin(t * 0.16) + pointer.x * 0.35;
    const dist = 6.8;
    camera.position.set(target.x + Math.sin(az) * dist, 1.85 + pointer.y * 0.5, target.z + Math.cos(az) * dist);
    camera.lookAt(target);
  };

  // reduced motion: freeze mid-juggle, all five boxes in the air
  return { update, stillTime: 6.1 };
}

export default function RobotScene({ className = "" }) {
  const hostRef = useRef(null);
  const status = useThreeScene(hostRef, buildRobotScene, { fov: 32 });
  return (
    <div
      ref={hostRef}
      className={`hc-scene hc-scene--${status}${className ? ` ${className}` : ""}`}
      data-testid="robot-scene"
      role="img"
      aria-label="A VMS robot balancing five boxes — stock, sales, GST, dues and cash — slips, and juggles every one back into place"
    />
  );
}
