import { centroid, containsPoint, type Vec } from './geometry';
import { currentPolygon, isFlipped } from './paper';
import { type Panel, type Vec3 } from './rigid';
import { occlusionShade, type SolvedScene } from './view3d';

interface Vertex {
  from: Vec3;
  to: Vec3;
  count: number;
  swing: number;
}

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, n: number): Vec3 => ({ x: a.x * n, y: a.y * n, z: a.z * n });

/** Locate an unfolded point on a previously solved panel. */
function pointOnPanel(panel: Panel, point: Vec): Vec3 {
  const poly = panel.facet.poly;
  const a = poly[0]!;
  for (let i = 1; i + 1 < poly.length; i++) {
    const b = poly[i]!, c = poly[i + 1]!;
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / d;
    const v = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / d;
    const w = 1 - u - v;
    if (Math.min(u, v, w) >= -1e-7) {
      return add(add(scale(panel.points[0]!, u), scale(panel.points[i]!, v)), scale(panel.points[i + 1]!, w));
    }
  }
  throw new Error('折叠面片无法对应到上一状态');
}

function normal(points: readonly Vec3[], fallback: Vec3): Vec3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    x += a.y * b.z - a.z * b.y;
    y += a.z * b.x - a.x * b.z;
    z += a.x * b.y - a.y * b.x;
  }
  const length = Math.hypot(x, y, z);
  return length < 1e-10 ? fallback : { x: x / length, y: y / length, z: z / length };
}

/** Build one continuous motion from the displayed pose to the next solved pose. */
export function prepareTransition(before: SolvedScene, after: SolvedScene, movedIds: readonly number[], size: number): (progress: number) => SolvedScene {
  const moved = new Set(movedIds);
  const vertices = new Map<string, Vertex>();
  const origins = new Map<number, Panel>();
  const keys = new Map<number, string[]>();
  const still = after.panels.filter((panel) => !moved.has(panel.facet.id));
  const keyOf = (p: Vec): string => `${Math.round(p.x * 1e8)}:${Math.round(p.y * 1e8)}`;

  for (const panel of after.panels) {
    const id = panel.facet.id;
    const origin = before.panels.find((p) => containsPoint(p.facet.poly, centroid(panel.facet.poly)));
    if (!origin) throw new Error('折叠面片缺少上一状态');
    origins.set(id, origin);
    let swing = 0;
    if (moved.has(id)) {
      const targetCentre = centroid(currentPolygon(panel.facet));
      const targetNeighbour = still.find((p) => containsPoint(currentPolygon(p.facet), targetCentre));
      const previousCentre = centroid(currentPolygon(origin.facet));
      const previousNeighbour = before.panels.find((p) => p !== origin &&
        containsPoint(currentPolygon(p.facet), previousCentre));
      const difference = targetNeighbour
        ? panel.facet.z - targetNeighbour.facet.z
        : previousNeighbour ? origin.facet.z - previousNeighbour.facet.z : 1;
      swing = difference < 0 ? -1 : 1;
    }
    const panelKeys = panel.facet.poly.map((point, i) => {
      const key = keyOf(point);
      const from = pointOnPanel(origin, point);
      const to = panel.points[i]!;
      const previous = vertices.get(key);
      if (previous) {
        previous.from = add(previous.from, from);
        previous.to = add(previous.to, to);
        previous.count++;
        previous.swing += swing;
      } else vertices.set(key, { from, to, count: 1, swing });
      return key;
    });
    keys.set(id, panelKeys);
  }
  for (const vertex of vertices.values()) {
    vertex.from = scale(vertex.from, 1 / vertex.count);
    vertex.to = scale(vertex.to, 1 / vertex.count);
  }

  return (progress: number): SolvedScene => {
    const t = Math.max(0, Math.min(1, progress));
    const angle = Math.PI * t;
    const along = (1 - Math.cos(angle)) / 2;
    const points = new Map<string, Vec3>();
    for (const [key, vertex] of vertices) {
      const d = { x: vertex.to.x - vertex.from.x, y: vertex.to.y - vertex.from.y, z: vertex.to.z - vertex.from.z };
      const planar = Math.hypot(d.x, d.y);
      const arc = vertex.swing === 0 || planar < 1e-12 ? 0 : Math.sign(vertex.swing) * Math.sin(angle) / 2;
      // The arc is perpendicular to the full displacement, including any
      // height difference between solved endpoints. Its radius is half that
      // displacement, so equal time intervals sweep equal angles.
      points.set(key, { x: vertex.from.x + d.x * along - d.x * d.z / (planar || 1) * arc,
        y: vertex.from.y + d.y * along - d.y * d.z / (planar || 1) * arc,
        z: vertex.from.z + d.z * along + planar * arc });
    }
    const panels = after.panels.map((panel) => {
      const placed = keys.get(panel.facet.id)!.map((key) => points.get(key)!);
      return { ...panel, points: placed, normal: normal(placed, panel.normal) };
    });
    const byId = new Map(panels.map((panel) => [panel.facet.id, panel]));
    const edges = after.edges.map((edge) => {
      const panel = edge.facetId === undefined ? undefined : byId.get(edge.facetId);
      return panel && edge.aIndex !== undefined && edge.bIndex !== undefined
        ? { ...edge, a: panel.points[edge.aIndex]!, b: panel.points[edge.bIndex]! } : edge;
    });
    const rank: Record<number, number> = {}, stackDirection: Record<number, number> = {};
    let reach = before.reach;
    for (const panel of panels) {
      const id = panel.facet.id, origin = origins.get(id)!;
      rank[id] = origin.facet.z + (panel.facet.z - origin.facet.z) * along;
      const directionFacet = t < 0.5 ? origin.facet : panel.facet;
      stackDirection[id] = isFlipped(directionFacet) ? -1 : 1;
      for (const p of panel.points) reach = Math.max(reach, Math.hypot(p.x - before.centre.x, p.y - before.centre.y, p.z - before.centre.z));
    }
    return { ...after, panels, edges, rank, stackDirection, shade: occlusionShade(panels, size),
      centre: before.centre, reach, settled: false };
  };
}
