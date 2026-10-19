import React, { useRef } from "react";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import useThreeScene from "./useThreeScene";
import { BELTS, BELT_SPAN, parcelX, parcelSize, scanPulse, coinState } from "./stockFlow";

/* ── Hero background: VMS stock flow ──
   Stock rides in on the front belt, sales ride out on the back one, both
   through scanner arches; every sale throws up a ₹ coin. Warehouse racks
   stand in the fog behind. The positions come from stockFlow.js. */

const BELT_LEN = BELT_SPAN + 6;
const SCANNER_X = { in: -3.2, out: 3.2 };
const COINS = 6;

/* dark: a black warehouse with glowing rails; light: a bright white one, same layout */
const THEMES = {
  dark:  { bg: 0x000000, floor: 0x05070b, floorMetal: 0.55, metal: 0x1a2130, metalLight: 0x5b6577, hemi: 0.22, key: 1.05,
           dust: 0x7dd3fc, dustOpacity: 0.55, sheetAdd: true, exposure: 1.05 },
  light: { bg: 0xf6f6f4, floor: 0xe9ecef, floorMetal: 0.1, metal: 0x9aa3b0, metalLight: 0xc3c9d2, hemi: 1.0, key: 1.7,
           dust: 0x64748b, dustOpacity: 0.35, sheetAdd: false, exposure: 1.0 },
};

function canvasTexture(THREE, w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* cardboard with packing tape and a barcode label */
function parcelTexture(THREE) {
  return canvasTexture(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = "#a9794b";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {               // fibre speckle
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "60,35,15" : "230,200,160"},${Math.random() * 0.12})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = "rgba(225,196,150,0.55)";       // tape
    g.fillRect(0, h * 0.44, w, h * 0.12);
    g.fillStyle = "#f4f1ea";                      // label
    g.fillRect(w * 0.56, h * 0.64, w * 0.36, h * 0.26);
    g.fillStyle = "#111";
    let x = w * 0.59;
    while (x < w * 0.89) {                        // barcode
      const bw = 1 + Math.floor(Math.random() * 3);
      g.fillRect(x, h * 0.68, bw, h * 0.14);
      x += bw + 1 + Math.floor(Math.random() * 3);
    }
    g.font = "700 15px Inter, Arial, sans-serif";
    g.fillText("VMS", w * 0.6, h * 0.875);
  });
}

/* dark rubber with chevrons pointing along +u */
function beltTexture(THREE, color) {
  const tex = canvasTexture(THREE, 256, 128, (g, w, h) => {
    g.fillStyle = "#0b0e14";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.globalAlpha = 0.35;
    g.lineWidth = 7;
    for (let x = -64; x < w; x += 64) {
      g.beginPath();
      g.moveTo(x + 10, 18);
      g.lineTo(x + 40, h / 2);
      g.lineTo(x + 10, h - 18);
      g.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function coinTexture(THREE) {
  return canvasTexture(THREE, 128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "#ffe7a1");
    grad.addColorStop(1, "#d4a017");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(120,80,0,0.6)";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 10, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#8a5a00";
    g.font = "800 72px Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("₹", w / 2, h / 2 + 4);
  });
}

function buildStockFlow({ THREE, renderer, scene, camera, pointer }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();
  scene.fog = new THREE.Fog(0x000000, 14, 32);

  const metal = new THREE.MeshStandardMaterial({ color: 0x1a2130, metalness: 0.8, roughness: 0.35, envMapIntensity: 0.6 });
  const metalLight = new THREE.MeshStandardMaterial({ color: 0x5b6577, metalness: 0.9, roughness: 0.3, envMapIntensity: 0.6 });
  const cardboard = new THREE.MeshStandardMaterial({ map: parcelTexture(THREE), roughness: 0.85, metalness: 0, envMapIntensity: 0.4 });

  /* lights */
  const hemi = new THREE.HemisphereLight(0x9fb8ff, 0x05060a, 0.22);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(-6, 11, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 10, bottom: -10, near: 1, far: 40 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key);

  /* floor: glossy dark slab with a faint grid */
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x05070b, metalness: 0.55, roughness: 0.38, envMapIntensity: 0.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const makeGrid = (major, minor, opacity) => {
    const g = new THREE.GridHelper(90, 90, major, minor);
    g.material.transparent = true;
    g.material.opacity = opacity;
    g.position.y = 0.003;
    scene.add(g);
    return g;
  };
  const grids = { dark: makeGrid(0x1d4ed8, 0x0f1b33, 0.28), light: makeGrid(0x94a3b8, 0xcbd5e1, 0.5) };

  /* belts */
  const parcelGeo = new THREE.BoxGeometry(1, 1, 1);
  const belts = BELTS.map((belt) => {
    const g = new THREE.Group();
    g.position.z = belt.z;
    scene.add(g);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(BELT_LEN, 0.5, 1.5), metal);
    frame.position.y = 0.55;
    frame.castShadow = true;
    frame.receiveShadow = true;
    g.add(frame);
    for (let x = -BELT_LEN / 2 + 1; x < BELT_LEN / 2; x += 3) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 1.3), metalLight);
      leg.position.set(x, 0.15, 0);
      leg.castShadow = true;
      g.add(leg);
    }

    const tex = beltTexture(THREE, belt.color);
    tex.repeat.set((BELT_LEN / 1.4) * belt.dir, 1);    // a negative repeat mirrors the chevrons
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(BELT_LEN, 0.04, 1.3),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 })
    );
    surface.position.y = 0.82;
    surface.receiveShadow = true;
    g.add(surface);

    const railMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: belt.color, emissiveIntensity: 1.6 });
    [-0.7, 0.7].forEach((z) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(BELT_LEN, 0.05, 0.05), railMat);
      rail.position.set(0, 0.86, z);
      g.add(rail);
    });

    const parcels = Array.from({ length: belt.count }, (_, i) => {
      const [w, h, d] = parcelSize(i + (belt.dir > 0 ? 0 : 50));
      const p = new THREE.Mesh(parcelGeo, cardboard);
      p.scale.set(w, h, Math.min(d, 1.1));
      p.position.y = 0.84 + h / 2;
      p.rotation.y = ((i * 37) % 9 - 4) * 0.03;
      p.castShadow = true;
      p.receiveShadow = true;
      g.add(p);
      return p;
    });

    /* scanner arch */
    const sx = SCANNER_X[belt.key];
    [-0.9, 0.9].forEach((z) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 0.16), metal);
      post.position.set(sx, 1.15, z);
      post.castShadow = true;
      g.add(post);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 2.0), metal);
    beam.position.set(sx, 2.3, 0);
    beam.castShadow = true;
    g.add(beam);
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: belt.color, emissiveIntensity: 1 });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.7), stripMat);
    strip.position.set(sx, 2.16, 0);
    g.add(strip);
    const sheetMat = new THREE.MeshBasicMaterial({
      color: belt.color, transparent: true, opacity: 0.06, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.3), sheetMat);
    sheet.rotation.y = Math.PI / 2;
    sheet.position.set(sx, 1.5, 0);
    g.add(sheet);
    const lamp = new THREE.PointLight(belt.color, 4, 7, 2);
    lamp.position.set(sx, 1.9, 0);
    g.add(lamp);

    return { belt, tex, parcels, stripMat, sheetMat, lamp };
  });

  /* ₹ coins rising from the sale scanner */
  const outBelt = BELTS.find((b) => b.key === "out");
  const coinFace = coinTexture(THREE);
  const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 40);
  const coins = Array.from({ length: COINS }, () => {
    const edge = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 1, roughness: 0.22, transparent: true });
    const face = new THREE.MeshStandardMaterial({ map: coinFace, metalness: 0.85, roughness: 0.25, transparent: true });
    const c = new THREE.Mesh(coinGeo, [edge, face, face]);
    c.rotation.x = Math.PI / 2;
    scene.add(c);
    return { mesh: c, mats: [edge, face] };
  });

  /* warehouse racks in the fog */
  const rackBoxes = [];
  [-9.5, 0, 9.5].forEach((rx) => {
    const rack = new THREE.Group();
    rack.position.set(rx, 0, -10);
    scene.add(rack);
    [-2.6, 2.6].forEach((x) => [-0.55, 0.55].forEach((z) => {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 0.12), metalLight);
      up.position.set(x, 2.2, z);
      rack.add(up);
    }));
    [0.5, 1.6, 2.7, 3.8].forEach((y, row) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.08, 1.25), metal);
      shelf.position.y = y;
      shelf.receiveShadow = true;
      rack.add(shelf);
      for (let k = 0; k < 4; k++) {
        const [w, h, d] = parcelSize(rx * 10 + row * 4 + k + 100);
        rackBoxes.push({ x: rx - 1.9 + k * 1.25, y: y + 0.04 + (h * 0.8) / 2, z: -10, s: [w * 0.9, h * 0.8, Math.min(d, 1)] });
      }
    });
  });
  const rackMesh = new THREE.InstancedMesh(parcelGeo, cardboard, rackBoxes.length);
  const m4 = new THREE.Matrix4();
  rackBoxes.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion(), new THREE.Vector3(...b.s));
    rackMesh.setMatrixAt(i, m4);
  });
  rackMesh.castShadow = true;
  scene.add(rackMesh);

  /* drifting dust */
  const DUST = 200;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 32;
    dustPos[i * 3 + 1] = Math.random() * 7;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 1;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  const lookAt = new THREE.Vector3(0, 3.4, 0);

  const update = (t, dt) => {
    belts.forEach(({ belt, tex, parcels, stripMat, sheetMat, lamp }) => {
      const xs = parcels.map((p, i) => {
        const x = parcelX(belt, i, t);
        p.position.x = x;
        return x;
      });
      // the chevrons move with the parcels (one texture tile = 1.4 units)
      tex.offset.x = -(t * belt.speed) / 1.4;
      const pulse = scanPulse(xs, SCANNER_X[belt.key]);
      sheetMat.opacity = 0.05 + 0.4 * pulse;
      stripMat.emissiveIntensity = 1 + 3 * pulse;
      lamp.intensity = 3 + 22 * pulse;
    });

    coins.forEach(({ mesh, mats }, i) => {
      const c = coinState(i, t, COINS);
      mesh.position.set(SCANNER_X.out + c.x, c.y, outBelt.z);
      mesh.rotation.z = c.spin;
      mats.forEach((m) => { m.opacity = c.opacity; });
    });

    const pos = dustGeo.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let y = pos.getY(i) + dt * 0.12;
      if (y > 7) y -= 7;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    camera.position.set(Math.sin(t * 0.07) * 2.2 + pointer.x * 1.4, 6.4 + pointer.y * 0.5, 15.5);
    camera.lookAt(lookAt);
  };

  const setTheme = (name) => {
    const th = THEMES[name] || THEMES.dark;
    scene.fog.color.setHex(th.bg);
    floorMat.color.setHex(th.floor);
    floorMat.metalness = th.floorMetal;
    metal.color.setHex(th.metal);
    metalLight.color.setHex(th.metalLight);
    hemi.intensity = th.hemi;
    key.intensity = th.key;
    dustMat.color.setHex(th.dust);
    dustMat.opacity = th.dustOpacity;
    grids.dark.visible = name !== "light";
    grids.light.visible = name === "light";
    // additive light vanishes on white, so the laser sheets go solid-tinted in light mode
    belts.forEach(({ sheetMat }) => {
      sheetMat.blending = th.sheetAdd ? THREE.AdditiveBlending : THREE.NormalBlending;
      sheetMat.needsUpdate = true;
    });
    renderer.toneMappingExposure = th.exposure;
  };

  return { update, setTheme, stillTime: 2.2 };
}

export default function StockFlowScene({ className = "" }) {
  const hostRef = useRef(null);
  const status = useThreeScene(hostRef, buildStockFlow, { fov: 38 });
  return (
    <div
      ref={hostRef}
      className={`hc-scene hc-scene--${status}${className ? ` ${className}` : ""}`}
      data-testid="stockflow-scene"
      aria-hidden="true"
    />
  );
}
