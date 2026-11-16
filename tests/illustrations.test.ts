import { describe, expect, it } from "vitest";
import {
  illustratedScene,
  illustrationFace,
  lateSteps,
} from "../src/illustrations";

describe("complete diagram-derived sequence", () => {
  it("has a usable 3D pose at every late step and throughout transitions", () => {
    expect(lateSteps).toHaveLength(26);
    for (let step = 9; step <= 34; step++) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const scene = illustratedScene(step, progress);
        expect(
          scene.panels.length,
          `step ${step}, progress ${progress}`,
        ).toBeGreaterThan(5);
        expect(
          scene.panels.every(
            (panel) =>
              panel.points.length === 3 &&
              panel.points.every(
                (p) =>
                  Number.isFinite(p.x) &&
                  Number.isFinite(p.y) &&
                  Number.isFinite(p.z),
              ),
          ),
        ).toBe(true);
        expect(
          scene.panels.every(
            (panel) =>
              Math.abs(
                Math.hypot(panel.normal.x, panel.normal.y, panel.normal.z) - 1,
              ) < 1e-6,
          ),
        ).toBe(true);
      }
    }
  });

  it("finishes with wide side lobes, a raised tip and a curved narrow stem", () => {
    const scene = illustratedScene(34);
    const points = scene.panels
      .flatMap((p) => p.points)
      .map((p) => ({
        x: (p.x - p.y) * Math.SQRT1_2,
        y: (p.x + p.y) * Math.SQRT1_2,
        z: p.z,
      }));
    expect(Math.min(...points.map((p) => p.x))).toBeLessThan(-0.43);
    expect(Math.max(...points.map((p) => p.x))).toBeGreaterThan(0.43);
    expect(Math.max(...points.map((p) => p.y))).toBeGreaterThan(1);
    const stemTip = points.filter((p) => p.y < -0.06);
    expect(stemTip.length).toBeGreaterThan(0);
    expect(stemTip.every((p) => p.x > 0.04)).toBe(true);
    expect(illustrationFace(34)).toBe(0);
  });
});
