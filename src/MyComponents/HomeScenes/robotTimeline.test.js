import {
  robotPose, solveArm, handPosition, legDrop, phaseAt, cascade, juggleHand, torsoToRobot, robotToTorso,
  PHASES, LOOP, RIG, BOX_LABELS, FIRST_CATCH, LAST_THROW, LAND_AT,
} from "./robotTimeline";

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const frames = (from = 0, to = LOOP, step = 1 / 60) => {
  const out = [];
  for (let t = from; t < to; t += step) out.push({ t, pose: robotPose(t) });
  return out;
};
/* where a palm really is in world space: FK in the torso frame → robot space → world */
const palm = (pose, side) => add(torsoToRobot(handPosition(side, side > 0 ? pose.armR : pose.armL), pose.lean, pose.roll), pose.root);

describe("arm IK and the torso frame", () => {
  it("puts the palm exactly on reachable targets, both arms", () => {
    [[0.24, 1.12, 0.5], [-0.24, 1.12, 0.5], [0.6, 1.17, 0.5], [-0.24, 1.17, 0.5], [0.45, 2.0, 0.5], [-0.8, 1.09, 0.55]]
      .forEach((t) => {
        const side = t[0] >= 0 ? 1 : -1;
        expect(dist(handPosition(side, solveArm(side, t)), t)).toBeLessThan(1e-6);
      });
  });

  it("torso ↔ robot space round-trips", () => {
    const p = [0.3, 2.1, 0.4];
    expect(dist(torsoToRobot(robotToTorso(p, -0.3, 0.12), -0.3, 0.12), p)).toBeLessThan(1e-9);
  });

  it("every hand target in the routine is in reach (the IK never has to stretch)", () => {
    frames(0, LOOP, 1 / 30).forEach(({ pose }) => {
      [1, -1].forEach((side) => {
        const target = add(side > 0 ? pose.hands.R : pose.hands.L, pose.root);
        expect(dist(palm(pose, side), target)).toBeLessThan(1e-6);
      });
    });
  });

  it("legs: standing drops nothing, crouching lowers the hips", () => {
    expect(legDrop(0)).toBeCloseTo(0, 10);
    expect(legDrop(0.5)).toBeGreaterThan(0);
  });
});

describe("the routine", () => {
  it("runs balance → slip → recover → juggle → finale → hold, covering the whole loop", () => {
    expect(PHASES.map(([n]) => n)).toEqual(["balance", "slip", "recover", "juggle", "finale", "hold"]);
    expect(PHASES[0][1]).toBe(0);
    expect(PHASES[PHASES.length - 1][2]).toBe(LOOP);
    expect(phaseAt(5).name).toBe("juggle");
  });

  it("has the five VMS boxes", () => {
    expect(BOX_LABELS).toEqual(["STOCK", "SALES", "GST", "DUES", "CASH"]);
    expect(robotPose(0).boxes).toHaveLength(5);
  });

  it("loops seamlessly: t and t + 12 are identical, and the end of the loop meets the start", () => {
    [0.4, 3.3, 5.5, 9.7, 11.5].forEach((t) => expect(robotPose(t + LOOP)).toEqual(robotPose(t)));
    const end = robotPose(LOOP - 1e-6);
    const start = robotPose(0);
    end.boxes.forEach((b, i) => expect(dist(b.pos, start.boxes[i].pos)).toBeLessThan(1e-3));
  });

  it("holds a straight stack between the palms at the start, wobbling more and more as it goes", () => {
    const p = robotPose(0);
    const ys = p.boxes.map((b) => b.pos[1]).sort((a, b) => a - b);
    ys.slice(1).forEach((y, k) => expect(y - ys[k]).toBeCloseTo(RIG.box, 6));   // stacked, touching
    const mid = (palm(p, 1)[0] + palm(p, -1)[0]) / 2;
    p.boxes.forEach((b) => expect(b.pos[0]).toBeCloseTo(mid, 6));
    const sway = (from, to) => Math.max(...frames(from, to).map(({ pose }) => Math.abs(Math.max(...pose.boxes.map((b) => b.pos[0])))));
    expect(sway(2.0, 3.0)).toBeGreaterThan(2 * sway(0, 1.0));
  });

  it("the slip throws every box high into the sky", () => {
    const peaks = [0, 1, 2, 3, 4].map((i) => Math.max(...frames(3.15, 6.6).map(({ pose }) => pose.boxes[i].pos[1])));
    peaks.forEach((y) => expect(y).toBeGreaterThan(5));
  });

  it("then catches all five, one after another, each one landing right in a palm", () => {
    const order = [...FIRST_CATCH].map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]);
    order.slice(1).forEach(([t], k) => expect(t - order[k][0]).toBeCloseTo(0.24, 6));
    FIRST_CATCH.forEach((tc, i) => {
      const p = robotPose(tc + 1e-6);
      const nearest = Math.min(dist(p.boxes[i].pos, palm(p, 1)), dist(p.boxes[i].pos, palm(p, -1)));
      expect(nearest).toBeLessThan(1e-3);
    });
  });

  it("while juggling, a box that is not flying is in a palm", () => {
    frames(4.1, 8.4, 1 / 50).forEach(({ t, pose }) => {
      pose.boxes.forEach((b, i) => {
        if (t < FIRST_CATCH[i]) return;              // still on its way down from the sky
        const c = cascade(i, t);
        if (c.inHand === 0) return;
        expect(dist(b.pos, palm(pose, c.inHand))).toBeLessThan(1e-3);
      });
    });
  });

  it("the juggling hands alternate throws every 0.24 s and the cascade is a real one (catch where the hand is)", () => {
    // ball 0 is thrown by the right hand at t = 0 + 2.4n and caught by the left one second later
    expect(dist(cascade(0, 4.8 + 1.0 - 1e-6).pos, juggleHand(-1, 4.8 + 1.0))).toBeLessThan(1e-3);
    expect(dist(cascade(0, 4.8 + 2.2 - 1e-6).pos, juggleHand(1, 4.8 + 2.2))).toBeLessThan(1e-3);
  });

  it("the finale lands the boxes on the stack one by one, a quarter second apart", () => {
    LAST_THROW.forEach((tt) => expect(tt).toBeGreaterThanOrEqual(8.4));
    [0, 1, 2, 3, 4].forEach((slot) => expect(LAND_AT(slot)).toBeCloseTo(10 + slot * 0.25, 6));
    const p = robotPose(11.0);
    const ys = p.boxes.map((b) => b.pos[1]).sort((a, b) => a - b);
    ys.slice(1).forEach((y, k) => expect(y - ys[k]).toBeCloseTo(RIG.box, 2));
  });

  it("no box ever goes through the floor", () => {
    frames().forEach(({ pose }) => pose.boxes.forEach((b) => expect(b.pos[1]).toBeGreaterThan(RIG.box / 2)));
  });

  it("nothing teleports between frames at 60 fps", () => {
    const all = frames();
    for (let k = 1; k < all.length; k++) {
      const a = all[k - 1].pose;
      const b = all[k].pose;
      a.boxes.forEach((box, i) => expect(dist(box.pos, b.boxes[i].pos)).toBeLessThan(0.3));
      expect(dist(a.root, b.root)).toBeLessThan(0.05);
    }
  });
});
