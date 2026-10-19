/* The robot's routine, as plain maths — no three.js, so it can be tested on its own.
   robotPose(t) answers "where is every joint and every box at second t" for a 12s loop:

     BALANCE a stack of five boxes (STOCK · SALES · GST · DUES · CASH), wobbling more and more
     → SLIP — the stack flies up into the sky
     → CATCH every box, 0.24 s apart, straight into a five-box JUGGLE (a real cascade)
     → final high toss: the boxes drop back onto the stack, one by one → hold it, balanced → loop.

   Space: the robot's root starts at the origin, feet on y = 0, facing +z.
   Boxes are returned in WORLD space; the hands are aimed with two-bone IK
   (solveArm), which is what keeps every catch and carry in the palm. */

export const RIG = {
  waistY: 0.86,     // the torso pivots here (lean = pitch, roll = sideways)
  shoulderX: 0.44,  // ± from centre — broad, square shoulders
  shoulderY: 1.54,
  upper: 0.38,      // upper-arm length
  fore: 0.58,       // forearm length (to the palm)
  hipX: 0.22,
  hipY: 0.82,       // stubby legs + a big head = the cute proportions
  thigh: 0.3,
  shin: 0.52,
  box: 0.32,        // box edge
};

export const LOOP = 12;
export const BOX_LABELS = ["STOCK", "SALES", "GST", "DUES", "CASH"];
const N = BOX_LABELS.length;

/* ── the cascade ──
   Box i is thrown by the right hand, flies FLIGHT s, is caught by the left, carried
   DWELL s, thrown back, caught by the right, carried … one lap = PERIOD. Five boxes
   staggered PERIOD/5 means the two hands throw alternately every 0.24 s, and every
   catch lands exactly where the catching hand is (see the tests). */
const PERIOD = 2.4;
const FLIGHT = 1.0;
const DWELL = 0.2;
const HALF = FLIGHT + DWELL;          // = PERIOD / 2
const BEAT = PERIOD / N;              // one hand throws every BEAT
/* every hand height below is measured from the shoulder, so the routine scales with the body */
const SHOULDER = RIG.shoulderY;
const JUGGLE_Y = SHOULDER - 0.37;
const JUGGLE_Z = 0.5;
const ARC = 1.35;                     // how far above the hands a juggled box flies

/* ── the stack ── */
const STACK_DROP = 0.15;                              // bottom face of the stack sits this far below the palms
const HOLD_HAND = (side) => [side * 0.24, SHOULDER - 0.42, 0.5];  // palms against the bottom box
const STACK_ORDER = [0, 3, 1, 4, 2];                  // slot → box (the order they land in the finale)
const FLING = (side) => [side * 0.45, SHOULDER + 0.46, 0.5];   // stack flung up as the foot slips
const WIDE = (side) => [side * 0.8, SHOULDER - 0.45, 0.55];    // arms out for balance
const SLOT_OF = STACK_ORDER.reduce((m, box, slot) => { m[box] = slot; return m; }, []);

/* ── timeline ── */
const LAUNCH = 3.15;      // the stack leaves the hands
const JUGGLE_IN = 4.1;    // hands are on the juggling path from here
const FINALE_FROM = 8.4;  // each box's first throw from here is its last
const HANDS_FREE = 9.36;  // the last box has been thrown
const HOLD_READY = 9.9;   // hands are back under the stack
export const LAND_AT = (slot) => 10.0 + slot * 0.25;

export const PHASES = [
  ["balance", 0, 3.0],
  ["slip", 3.0, 3.6],
  ["recover", 3.6, JUGGLE_IN],
  ["juggle", JUGGLE_IN, HANDS_FREE],
  ["finale", HANDS_FREE, 11.0],
  ["hold", 11.0, LOOP],
];

/* ── helpers ── */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, s) => a + (b - a) * s;
const lerp3 = (a, b, s) => [lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s)];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const easeInOut = (s) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const easeOut = (s) => 1 - Math.pow(1 - s, 3);
const frac = (v) => v - Math.floor(v);
const mod = (v, m) => ((v % m) + m) % m;

export function phaseAt(time) {
  const t = mod(time, LOOP);
  const hit = PHASES.find(([, a, b]) => t >= a && t < b) || PHASES[PHASES.length - 1];
  const [name, a, b] = hit;
  return { name, t, s: clamp01((t - a) / (b - a)) };
}

/* ── legs ── */
export function legAngles(c) {
  return { hip: -0.9 * c, knee: 1.6 * c, ankle: -0.7 * c };
}
export function legDrop(c) {
  const { hip, knee } = legAngles(c);
  return RIG.thigh + RIG.shin - (RIG.thigh * Math.cos(hip) + RIG.shin * Math.cos(hip + knee));
}

/* ── arm IK ──
   The arm hangs along −y at rest; the elbow is a rotation e about x (negative =
   the forearm folds forward). The bend comes from the distance to the target
   (law of cosines); then the shoulder turns that bent arm onto the target with
   the shortest rotation, as a quaternion q = [x, y, z, w]. Any point within
   arm's length is reachable, sideways included. */
const restPalm = (e) => [0, -RIG.upper - RIG.fore * Math.cos(e), -RIG.fore * Math.sin(e)];

function quatBetween(a, b) {            // unit vectors → shortest-arc rotation
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let q;
  if (dot < -0.999999) {
    q = Math.abs(a[0]) > Math.abs(a[2]) ? [-a[1], a[0], 0, 0] : [0, -a[2], a[1], 0];
  } else {
    q = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0], 1 + dot];
  }
  const n = Math.hypot(...q);
  return q.map((v) => v / n);
}

export function rotateByQuat([x, y, z], [qx, qy, qz, qw]) {
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

export function solveArm(side, target) {
  const { upper: L1, fore: L2 } = RIG;
  let d = [target[0] - side * RIG.shoulderX, target[1] - RIG.shoulderY, target[2]];
  let len = Math.hypot(...d);
  const maxLen = L1 + L2 - 1e-3;
  const minLen = Math.abs(L1 - L2) + 0.05;
  if (len > maxLen || len < minLen) {
    const k = clamp(len, minLen, maxLen) / (len || 1);
    d = d.map((v) => v * k);
    len = Math.hypot(...d);
  }
  const e = -Math.acos(clamp((len * len - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
  const v = restPalm(e);
  const vl = Math.hypot(...v);
  const q = quatBetween(v.map((c) => c / vl), d.map((c) => c / len));
  return { q, e };
}

/* Forward kinematics for the same chain: where the palm ends up (torso space). */
export function handPosition(side, { q, e }) {
  const p = rotateByQuat(restPalm(e), q);
  return [side * RIG.shoulderX + p[0], RIG.shoulderY + p[1], p[2]];
}

/* ── torso frame ──
   The shoulders hang off the torso, which pivots at the waist with rotation
   (lean, 0, roll) = Rx(lean)·Rz(roll). Hand targets are moved into that frame
   before solving the arms, so the palms land exactly whatever the torso does. */
const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
export function torsoToRobot(p, lean, roll) {
  const q = rotX(rotZ([p[0], p[1] - RIG.waistY, p[2]], roll), lean);
  return [q[0], q[1] + RIG.waistY, q[2]];
}
export function robotToTorso(p, lean, roll) {
  const q = rotZ(rotX([p[0], p[1] - RIG.waistY, p[2]], -lean), -roll);
  return [q[0], q[1] + RIG.waistY, q[2]];
}

/* ── juggling hands ──
   Each hand loops a small scoop every BEAT: phase 0 = throw (inside, level),
   rising outward to the catch point, then dipping back in while carrying. */
const handPhase = (side, t) => frac((t - (side > 0 ? 0 : BEAT / 2)) / BEAT);
export const CATCH_PHASE = 1 - DWELL / BEAT;
export function scoop(side, phase) {
  const w = 2 * Math.PI * phase;
  return [side * (0.42 - 0.18 * Math.cos(w)), JUGGLE_Y + 0.12 * Math.sin(w), JUGGLE_Z];
}
export const juggleHand = (side, t) => scoop(side, handPhase(side, t));
const throwPoint = (side) => scoop(side, 0);
const catchPoint = (side) => scoop(side, CATCH_PHASE);

/* parabola from p to q over s ∈ [0,1], `h` above the straight line at the middle */
const arc = (p, q, s, h) => {
  const o = lerp3(p, q, s);
  o[1] += 4 * h * s * (1 - s);
  return o;
};

/* Box i in the cascade at time t (robot space). `inHand`: 1 right, −1 left, 0 flying.
   Spins are whole half-turns per flight, so a (same-on-every-face) box lands square. */
export function cascade(i, t) {
  const u = mod(t - i * BEAT, PERIOD);
  if (u < FLIGHT) {
    const s = u / FLIGHT;
    return { pos: arc(throwPoint(1), catchPoint(-1), s, ARC), rot: [s * Math.PI, 0, 0], inHand: 0 };
  }
  if (u < HALF) return { pos: juggleHand(-1, t), rot: [0, 0, 0], inHand: -1 };
  if (u < HALF + FLIGHT) {
    const s = (u - HALF) / FLIGHT;
    return { pos: arc(throwPoint(-1), catchPoint(1), s, ARC), rot: [s * Math.PI, 0, 0], inHand: 0 };
  }
  return { pos: juggleHand(1, t), rot: [0, 0, 0], inHand: 1 };
}

const catchTimeAfter = (i, after) => {
  const first = i * BEAT + FLIGHT;
  return first + Math.ceil((after - first) / HALF - 1e-9) * HALF;
};
const throwTimeAfter = (i, after) => {
  const first = i * BEAT;
  return first + Math.ceil((after - first) / HALF - 1e-9) * HALF;
};

/* After the slip the catches come 0.24 s apart (boxes 0, 3, 1, 4, 2); the last throws likewise. */
export const FIRST_CATCH = Array.from({ length: N }, (_, i) => catchTimeAfter(i, JUGGLE_IN + 0.4));
export const LAST_THROW = Array.from({ length: N }, (_, i) => throwTimeAfter(i, FINALE_FROM));
// throws alternate right, left, right … from i·BEAT; count them rather than compare floats
const LAST_THROW_SIDE = LAST_THROW.map((tt, i) => (Math.round((tt - i * BEAT) / HALF) % 2 === 0 ? 1 : -1));

/* ── stack ── the tilt θ bends the column a little more at every level */
function stackSlot(slot, base, theta) {
  let x = base[0];
  let y = base[1];
  let angle = 0;
  for (let k = 0; k <= slot; k++) {
    const a = theta * (1 + 0.25 * k);
    const h = k === slot ? RIG.box / 2 : RIG.box;
    x += Math.sin(a) * h;
    y += Math.cos(a) * h;
    angle = a;
  }
  return { pos: [x, y, base[2]], rot: [0, 0, -angle] };
}
const stackBase = (handR, handL) => add3(lerp3(handR, handL, 0.5), [0, -STACK_DROP, 0]);

/* 10 wobbles per loop, so the end of "hold" meets the start of "balance" */
const wobble = (t, amp) => amp * Math.sin((2 * Math.PI * t) / 1.2);

/* where each box let go of the stack — read from the pose itself, once */
let launchFrom = null;
function launchPos(i) {
  if (!launchFrom) launchFrom = robotPose(LAUNCH - 1e-6).boxes.map((b) => b.pos);
  return launchFrom[i];
}

/**
 * @returns {{ phase, root:number[], crouch, lean, roll, legs:{L,R}, armL, armR,
 *             head:{rot:number[]}, boxes:{pos:number[],rot:number[]}[] }}
 */
export function robotPose(time) {
  const { name, t, s } = phaseAt(time);

  const root = [0, 0, 0];
  let crouch = 0.08;
  let lean = 0;                // torso pitch (back is negative)
  let roll = 0;                // torso roll, countering the stack
  let legR = null;             // right-leg override (the slip), else both follow `crouch`
  let headRot = [-0.25, 0, 0];
  let theta = 0;               // stack tilt
  let stackHeld = true;        // the boxes ride the hands as a stack

  switch (name) {
    case "balance": {
      const amp = 0.04 + 0.18 * Math.pow(t / 3, 2);
      theta = wobble(t, amp);
      root[0] = -0.4 * theta;
      roll = -0.6 * theta;
      crouch = 0.08 + 0.12 * Math.abs(theta);
      headRot = [-0.45, -0.6 * theta, 0.4 * theta];
      break;
    }
    case "slip": {
      const k = easeOut(clamp01(s / 0.6));
      root[0] = 0.25 * k;
      crouch = 0.08 + 0.45 * k;
      // lean back only once the arms are going up, or the hands crowd the shoulders
      lean = -0.28 * Math.sin(Math.PI * Math.min(1, s * 1.2)) * easeInOut(clamp01((s - 0.1) / 0.25));
      legR = { hip: lerp(0, -1.0, k), knee: lerp(0, 0.25, k), ankle: lerp(0, 0.5, k) };   // the right foot shoots forward
      theta = -0.45 * clamp01(s / 0.25);
      headRot = [-0.75, 0, 0.15 * k];
      stackHeld = t < LAUNCH;
      break;
    }
    case "recover": {
      const k = easeInOut(s);
      root[0] = lerp(0.25, 0, k);
      crouch = lerp(0.53, 0.15, k);
      lean = 0;
      const stand = legAngles(crouch);
      legR = { hip: lerp(-1.0, stand.hip, k), knee: lerp(0.25, stand.knee, k), ankle: lerp(0.5, stand.ankle, k) };
      headRot = [-0.8 + 0.3 * k, 0, 0];
      stackHeld = false;
      break;
    }
    case "juggle":
      crouch = 0.15 + 0.035 * Math.sin((2 * Math.PI * t) / (BEAT / 2));
      roll = 0.05 * Math.sin((2 * Math.PI * t) / BEAT);
      headRot = [-0.38, 0.12 * Math.sin((2 * Math.PI * t) / PERIOD), 0];
      stackHeld = false;
      break;
    case "finale":
      crouch = lerp(0.15, 0.08, s);
      headRot = [lerp(-0.38, -0.7, Math.sin(Math.PI * s)), 0, 0];
      stackHeld = false;
      break;
    case "hold":
    default:
      theta = wobble(t, 0.04 * easeInOut(s));
      root[0] = -0.4 * theta;
      roll = -0.6 * theta;
      headRot = [-0.45 + 0.1 * Math.sin(Math.PI * s), 0, 0];
      break;
  }

  root[1] = -legDrop(crouch);
  const toWorld = (p) => add3(p, root);

  /* ── hands (robot space) ── */
  let handR;
  let handL;
  if (name === "balance" || name === "hold") {
    handR = HOLD_HAND(1);
    handL = HOLD_HAND(-1);
  } else if (name === "slip") {
    // the stack is flung up and back as the foot goes …
    const fling = Math.sin(Math.PI * clamp01(s / 0.5));
    handR = lerp3(HOLD_HAND(1), FLING(1), fling);
    handL = lerp3(HOLD_HAND(-1), FLING(-1), fling);
    // … then the arms go wide for balance
    const wide = easeInOut(clamp01((s - 0.5) / 0.5));
    handR = lerp3(handR, WIDE(1), wide);
    handL = lerp3(handL, WIDE(-1), wide);
  } else if (name === "recover") {
    const k = easeInOut(s);
    handR = lerp3(WIDE(1), juggleHand(1, t), k);
    handL = lerp3(WIDE(-1), juggleHand(-1, t), k);
  } else if (name === "juggle") {
    handR = juggleHand(1, t);
    handL = juggleHand(-1, t);
  } else {   // finale: the free hands come back under where the stack will land, giving a little as each box lands
    const k = easeInOut(clamp01((t - HANDS_FREE) / (HOLD_READY - HANDS_FREE)));
    const give = STACK_ORDER.reduce((g, _, slot) => {
      const d = t - LAND_AT(slot);
      return d >= 0 && d < 0.25 ? Math.max(g, Math.sin((Math.PI * d) / 0.25) * 0.05) : g;
    }, 0);
    handR = add3(lerp3(juggleHand(1, t), HOLD_HAND(1), k), [0, -give, 0]);
    handL = add3(lerp3(juggleHand(-1, t), HOLD_HAND(-1), k), [0, -give, 0]);
  }

  /* ── boxes (world space) ── */
  const base = stackBase(handR, handL);
  const onStack = (slot, th) => {
    const p = stackSlot(slot, base, th);
    return { pos: toWorld(p.pos), rot: p.rot };
  };

  const boxes = Array.from({ length: N }, (_, i) => {
    const slot = SLOT_OF[i];
    if (stackHeld) return onStack(slot, theta);

    // launched: from where it let go, high into the sky, down into a hand
    if (t < FIRST_CATCH[i]) {
      const to = toWorld(cascade(i, FIRST_CATCH[i]).pos);
      const k = clamp01((t - LAUNCH) / (FIRST_CATCH[i] - LAUNCH));
      return { pos: arc(launchPos(i), to, k, 4.6 + 0.3 * slot), rot: [k * 4 * Math.PI, k * Math.PI, 0] };
    }
    if (t < LAST_THROW[i]) {
      const c = cascade(i, t);
      return { pos: toWorld(c.pos), rot: c.rot };
    }
    // the finale: one high toss onto its slot of the rebuilt stack
    const land = LAND_AT(slot);
    if (t < land) {
      const from = toWorld(throwPoint(LAST_THROW_SIDE[i]));
      const to = toWorld(stackSlot(slot, stackBase(HOLD_HAND(1), HOLD_HAND(-1)), 0).pos);
      const k = (t - LAST_THROW[i]) / (land - LAST_THROW[i]);
      return { pos: arc(from, to, k, 2.4), rot: [k * 2 * Math.PI, k * Math.PI, 0] };
    }
    return onStack(slot, theta);
  });

  return {
    phase: name,
    root,
    crouch,
    lean,
    roll,
    legs: { L: legAngles(crouch), R: legR || legAngles(crouch) },
    armR: solveArm(1, robotToTorso(handR, lean, roll)),
    armL: solveArm(-1, robotToTorso(handL, lean, roll)),
    hands: { R: handR, L: handL },
    head: { rot: headRot },
    boxes,
  };
}
