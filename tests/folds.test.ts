import { describe, expect, it } from 'vitest';
import { buildFrames, lesson } from '../src/folds';
import { area } from '../src/engine/geometry';
import { currentPolygon } from '../src/engine/paper';
import { tears } from '../src/engine/rigid';

describe('maple leaf folding sequence', () => {
  const frames = buildFrames();

  it('keeps a whole connected sheet throughout the implemented actions', () => {
    for (const [step, actions] of frames.entries()) {
      for (const [action, frame] of actions.entries()) {
        const label = `step ${step + 1}, action ${action + 1}`;
        expect(tears(frame.after), label).toBe(0);
        expect(frame.after.facets.reduce((sum, facet) => sum + area(facet.poly), 0), label).toBeCloseTo(1, 8);
        expect(frame.after.facets.every((facet) => currentPolygon(facet).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))), label).toBe(true);
        if (frame.faceBefore === frame.faceAfter) expect(frame.movedIds.length, label).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the flip separate and reaches the original diagram landmarks', () => {
    expect(lesson).toHaveLength(8);
    expect(frames[2]![0]!.before).toBe(frames[2]![0]!.after);
    expect(frames[2]![0]!.faceAfter).toBe(1);
    const tip = Math.SQRT1_2 / 2;
    const afterPetal = frames[4]![0]!.after;
    const points = afterPetal.facets.flatMap(currentPolygon);
    expect(points.some((point) => Math.hypot(point.x - tip, point.y - tip) < 1e-7)).toBe(true);
    const afterRepeat = frames[7]!.at(-1)!.after;
    expect(tears(afterRepeat)).toBe(0);
    expect(afterRepeat.facets.length).toBeGreaterThan(afterPetal.facets.length);
  });
});
