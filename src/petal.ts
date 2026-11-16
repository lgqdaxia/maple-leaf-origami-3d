import {
  apply, applyToLine, centroid, chord, clipPolygon, compose, invert, line,
  reflection, sideOf, vec,
} from './engine/geometry';
import { type Facet, type PaperState } from './engine/paper';

/**
 * Petal the doubled flap made in step 4. Its two visible faces end at the
 * short edge; the paper under each one reaches the bottom corner. Those
 * two layers must therefore fold on different kite creases.
 */
export function petalDoubledFlap(
  initial: PaperState,
  ids: readonly [number, number, number, number] = [15, 14, 0, 4],
): PaperState {
  const A = vec(0, 0);
  const r = (1 - Math.SQRT1_2) / 2;
  const C = vec(r, r);
  const left = vec(r, Math.SQRT1_2 / 2);
  const right = vec(Math.SQRT1_2 / 2, r);
  const leftCorner = vec(0, 2 * r);
  const rightCorner = vec(2 * r, 0);
  const hinge = line(left, right);
  const kite = [line(C, left), line(C, right), line(A, left), line(A, right)];
  const creaseList = [...initial.creases];
  let nextId = initial.nextId;

  function split(facets: Facet[], cut: ReturnType<typeof line>): Facet[] {
    return facets.flatMap((facet) => {
      const local = applyToLine(invert(facet.transform), cut);
      const result = clipPolygon(facet.poly, local);
      if (!result.positive.length || !result.negative.length) return [facet];
      const segment = chord(facet.poly, local);
      if (segment) creaseList.push({ a: segment[0], b: segment[1] });
      return [
        { ...facet, poly: result.positive },
        { ...facet, id: nextId++, poly: result.negative },
      ];
    });
  }

  const facets: Facet[] = [];
  for (const original of initial.facets) {
    const id = original.id;
    if (!ids.includes(id)) {
      facets.push(original);
      continue;
    }
    const top = id === ids[0] || id === ids[1];
    const isLeft = id === ids[0] || id === ids[2];
    const cut = kite[top ? (isLeft ? 0 : 1) : (isLeft ? 2 : 3)]!;
    let pieces = [original];
    if (top) pieces = split(pieces, hinge);
    pieces = split(pieces, cut);
    for (const facet of pieces) {
      const point = apply(facet.transform, centroid(facet.poly));
      const belowHinge = point.x + point.y < 0.5 - 1e-8;
      const outsideKite = sideOf(cut, point) === sideOf(cut, isLeft ? leftCorner : rightCorner);
      let transform = facet.transform;
      let z = facet.z;
      if (top && belowHinge) {
        if (outsideKite) transform = compose(reflection(cut), transform);
        transform = compose(reflection(hinge), transform);
        z = -4 + (isLeft ? 0 : 0.1);
      } else if (!top && outsideKite) {
        transform = compose(reflection(cut), transform);
        z = -2 + (isLeft ? 0 : 0.1);
      }
      facets.push({ ...facet, transform, z });
    }
  }
  return { ...initial, facets, creases: creaseList, nextId, foldCount: initial.foldCount + 1 };
}
