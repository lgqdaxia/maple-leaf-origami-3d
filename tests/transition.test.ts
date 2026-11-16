import { describe, expect, it } from 'vitest';
import { Triangle, Vector3 } from 'three';
import { buildFrames } from '../src/folds';
import { SolveCore, type SolveRequest } from '../src/engine/solver';
import { prepareTransition } from '../src/engine/transition';
import { stackRank, type SolvedScene } from '../src/engine/view3d';
import { illustratedScene } from '../src/illustrations';
import { centroid, containsPoint } from '../src/engine/geometry';
import type { PaperState } from '../src/engine/paper';
import type { Vec3 } from '../src/engine/rigid';

const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const request = (state: PaperState, stateId: string): SolveRequest => ({
  stateId, state, opening: Math.PI / 60, thickness: 0.001,
});
const greatestMovement = (a: SolvedScene, b: SolvedScene): number => Math.max(
  ...a.panels.flatMap((panel, i) => panel.points.map((point, j) => distance(point, b.panels[i]!.points[j]!))),
);

describe('continuous folding poses', () => {
  it('keeps every action continuous and arrives at its solved target', () => {
    for (const [step, actions] of buildFrames().entries()) {
      for (const [action, frame] of actions.entries()) {
        if (!frame.movedIds.length) continue;
        const label = `step ${step + 1}, action ${action + 1}`;
        const solver = new SolveCore();
        const before = solver.solve(request(frame.before, 'before'));
        const after = solver.solve(request(frame.after, 'after'));
        const transition = prepareTransition(before, after, frame.movedIds, frame.after.size);
        let previous = transition(0);
        for (const panel of previous.panels) {
          const source = before.panels.find((candidate) => containsPoint(candidate.facet.poly, centroid(panel.facet.poly)))!;
          panel.facet.poly.forEach((vertex, i) => {
            const original = source.facet.poly.findIndex((point) => Math.hypot(point.x - vertex.x, point.y - vertex.y) < 1e-8);
            if (original >= 0) expect(distance(panel.points[i]!, source.points[original]!), label).toBeLessThan(1e-6);
          });
        }
        for (let i = 1; i <= 60; i++) {
          const next = transition(i / 60);
          expect(greatestMovement(previous, next), label).toBeLessThan(0.05);
          previous = next;
        }
        expect(greatestMovement(previous, after), label).toBeLessThan(1e-7);
      }
    }
  });

  it('moves a simple fold through equal angles at equal time intervals', () => {
    const frame = buildFrames()[0]![0]!;
    const solver = new SolveCore();
    const before = solver.solve(request(frame.before, 'before'));
    const after = solver.solve(request(frame.after, 'after'));
    const at = prepareTransition(before, after, frame.movedIds, frame.after.size);
    const start = at(0), end = at(1);
    let selected: [number, number] = [0, 0], largest = 0;
    start.panels.forEach((panel, i) => panel.points.forEach((point, j) => {
      const travelled = distance(point, end.panels[i]!.points[j]!);
      if (travelled > largest) { largest = travelled; selected = [i, j]; }
    }));
    const points = Array.from({ length: 9 }, (_, i) => at(i / 8).panels[selected[0]]!.points[selected[1]]!);
    const segments = points.slice(1).map((point, i) => distance(points[i]!, point));
    expect(Math.max(...segments) - Math.min(...segments)).toBeLessThan(0.001);
  });

  it('uses layer order even when the overlapping area excludes a facet centre', () => {
    const state = buildFrames()[7]!.at(-1)!.after;
    const rank = stackRank(state);
    for (const facet of state.facets) expect(rank[facet.id]).toBe(facet.z);
  });

  it('starts each later teaching pose at the preceding pose, including flips', () => {
    const points = (scene: SolvedScene): Vec3[] => scene.panels.flatMap((panel) => [...panel.points]);
    const distanceToSurface = (point: Vec3, scene: SolvedScene): number => {
      const source = new Vector3(point.x, point.y, point.z), closest = new Vector3();
      return Math.min(...scene.panels.map((panel) => {
        const vertices = panel.points.map((p) => new Vector3(p.x, p.y, p.z));
        return new Triangle(vertices[0], vertices[1], vertices[2]).closestPointToPoint(source, closest).distanceTo(source);
      }));
    };
    for (let step = 10; step <= 34; step++) {
      const before = illustratedScene(step - 1), start = illustratedScene(step, 0);
      for (const point of points(before)) {
        expect(distanceToSurface(point, start), `step ${step}`).toBeLessThan(1e-6);
      }
      for (const point of points(start)) {
        expect(distanceToSurface(point, before), `step ${step}`).toBeLessThan(1e-6);
      }
    }
  });
});
