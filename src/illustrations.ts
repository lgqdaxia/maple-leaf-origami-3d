import { ShapeUtils, Vector2 } from "three";
import { IDENTITY } from "./engine/geometry";
import type { Panel, Vec3 } from "./engine/rigid";
import type { SolvedScene } from "./engine/view3d";

/** These are diagram-derived teaching poses, not physical paper states. */
export const lateSteps = [
  [
    "盖过一层纸",
    "把中间露出的纸层盖入内侧，整理成细长菱形。",
    "隐藏层采用近似示意，重点观察盖入的方向。",
  ],
  [
    "翻到正面",
    "把整个模型翻过来，保持长尖角朝上。",
    "翻面后，从底部右侧开始做旋转折。",
  ],
  [
    "右侧底部旋转折",
    "打开右下方的内层纸袋，让纸角沿折线向外旋转。",
    "先打开纸袋，再把里面的纸角引出来。",
  ],
  [
    "展开旋转折",
    "继续把右侧纸角转出，观察纸袋展开的中间状态。",
    "原图第 12 步是旋转折过程中的视图。",
  ],
  [
    "抬起右侧叶瓣",
    "沿谷折线把右侧纸角向上折，形成第一片侧叶。",
    "侧叶的尖端向右上方，根部仍留在中线。",
  ],
  [
    "在左侧重复",
    "在左侧重复旋转折和谷折，展开另一片侧叶。",
    "两片大侧叶的角度和大小尽量对称。",
  ],
  [
    "压开下方小纸角",
    "打开侧叶下方的小纸袋，把两只小纸角压平。",
    "这些小纸角会成为枫叶下面的两片短叶瓣。",
  ],
  [
    "翻到背面",
    "翻过整个模型，露出需要收细的下方长纸角。",
    "把已经做好的侧叶轻轻避开。",
  ],
  [
    "将三分之一折向左",
    "把下方纸角的三分之一折向左，在连接处压折。",
    "这一段开始把较宽的纸角收成叶柄。",
  ],
  [
    "重复收细",
    "在另一侧重复同样的收折，让下方纸角继续变窄。",
    "保持中线位置，避免整根纸角偏向一边。",
  ],
  [
    "收折下一层",
    "折起下一片纸层，在纸层连接处继续压折。",
    "图示用展开的小三角片表现需要收进的纸层。",
  ],
  [
    "再次重复",
    "继续折起对应的纸层，把多余的宽度收向根部。",
    "长纸角逐渐形成细长的柄。",
  ],
  [
    "藏入内侧",
    "把根部的小纸角收进内部纸袋，整理叠层。",
    "藏入后的根部应更紧凑，侧叶保持展开。",
  ],
  [
    "折起主叶瓣",
    "沿谷折线整理上方主纸片，在根部压平。",
    "中央主叶瓣从宽三角逐渐整理成细长形。",
  ],
  [
    "翻回正面",
    "把模型翻回正面，确认五个叶瓣和细长叶柄的位置。",
    "现在已经能辨认出枫叶的整体结构。",
  ],
  [
    "反折内侧边角",
    "把中央根部的内侧纸角反折，整理侧叶与主叶的连接。",
    "反折的纸角收在内侧，外轮廓保持利落。",
  ],
  [
    "折起内部尖角",
    "把主叶瓣里面的尖角向上谷折。",
    "只移动内部尖角，外侧主叶片保持平整。",
  ],
  [
    "在叶尖做褶折",
    "在上方尖角处做一组褶折，留下后续整形的折痕。",
    "褶折由一条谷折和一条山折配合形成。",
  ],
  [
    "展开预折",
    "展开刚做过的褶折，保留折痕作为定位。",
    "展开后仍能看到叶尖附近的折痕。",
  ],
  [
    "内外挤折",
    "沿预折痕把两侧向内外挤折，形成主叶片的肩部。",
    "上方尖角保留，两侧肩角向内收。",
  ],
  [
    "反折两侧肩角",
    "把两侧小肩角反折，整理主叶的上缘。",
    "这两处折叠形成中央叶片的折线轮廓。",
  ],
  [
    "将小角藏入纸袋",
    "把肩部的小纸角塞到内部纸袋后面。",
    "内藏后的正面只露出清晰的主叶片。",
  ],
  [
    "整理三个叶尖",
    "在主叶尖和左右两片大侧叶处重复旋转折，形成尖角。",
    "三个主要叶尖都应露出分明的折线。",
  ],
  [
    "叶柄兔耳折",
    "在根部做兔耳折，把长柄暂时折向侧上方。",
    "观察两条折线如何把叶柄的根部收细。",
  ],
  [
    "双兔耳折回叶柄",
    "再做双兔耳折，把叶柄折回下方。",
    "叶柄回到中线下方，根部保持紧凑。",
  ],
  [
    "整形，完成枫叶",
    "整理主叶和侧叶的边缘，收细叶柄，再轻轻弯出自然弧度。",
    "五个叶瓣、三个主要尖角和弯曲叶柄共同构成最终枫叶。",
  ],
].map(([title, description, hint]) => ({
  title,
  description,
  hint,
  approximate: true,
}));

type P = readonly [number, number, number?];
interface Shape {
  id: string;
  points: P[];
  ridge?: P[];
  edges?: boolean;
}
interface Pose {
  face: number;
  shapes: Shape[];
}
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
const mixPoint = (a: P, b: P, t: number): P => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2] ?? 0, b[2] ?? 0, t),
];

export function illustrationFace(step: number): number {
  return step < 10 || (step >= 16 && step < 23) ? 1 : 0;
}

/** Build the two ridged halves of a lobe, with the outline kept explicit. */
function lobe(id: string, left: P[], right: P[], ridgeHeight: number): Shape[] {
  const root = left[0]!;
  const tip = left.at(-1)!;
  const ridge = [
    root,
    mixPoint(root, tip, 0.32),
    mixPoint(root, tip, 0.65),
    tip,
  ].map(
    (p, i) =>
      [p[0], p[1], (p[2] ?? 0) + (i === 0 || i === 3 ? 0 : ridgeHeight)] as P,
  );
  return [
    {
      id: `${id}-left`,
      points: [...left, ...ridge.slice(1, -1).reverse()],
      ridge,
    },
    {
      id: `${id}-right`,
      points: [...right, ...ridge.slice(1, -1).reverse()],
      ridge,
    },
  ];
}

const mainKite: P[] = [
  [0, 0],
  [-0.05, 0.12],
  [-0.105, 0.255],
  [-0.2071, 0.5],
  [-0.14, 0.66],
  [-0.07, 0.83],
  [0, 1],
];
const mainTriangle: P[] = [
  [0, 0.35],
  [-0.07, 0.42],
  [-0.14, 0.48],
  [-0.2071, 0.5],
  [-0.14, 0.66],
  [-0.07, 0.83],
  [0, 1],
];
const mainSpear: P[] = [
  [0, 0.35],
  [-0.075, 0.49],
  [-0.145, 0.7],
  [-0.145, 0.72],
  [-0.1, 0.82],
  [-0.05, 0.91],
  [0, 1],
];
const mainShoulder: P[] = [
  [0, 0.35],
  [-0.145, 0.53],
  [-0.145, 0.83],
  [-0.1, 0.82],
  [-0.07, 0.88],
  [-0.035, 0.88],
  [0, 0.96],
];
const mainFinished: P[] = [
  [0, 0.35],
  [-0.145, 0.53],
  [-0.145, 0.86],
  [-0.1, 0.83],
  [-0.046, 0.94],
  [-0.034, 0.932],
  [0, 1.035],
];

function blade(
  id: string,
  side: number,
  root: P,
  tip: P,
  width: number,
  shaped: number,
  depth = 0,
): Shape[] {
  const dx = tip[0] - root[0],
    dy = tip[1] - root[1],
    length = Math.hypot(dx, dy);
  const nx = length > 1e-7 ? -dy / length : 0,
    ny = length > 1e-7 ? dx / length : 0;
  const point = (along: number, across: number): P => [
    root[0] + dx * along + nx * across * width,
    root[1] + dy * along + ny * across * width,
    (root[2] ?? 0) + depth * Math.sin(Math.PI * along),
  ];
  const left = [
    point(0, 0),
    point(0.4, -1),
    point(0.7, -1),
    point(lerp(0.8, 0.69, shaped), lerp(-0.65, -0.45, shaped)),
    point(1, 0),
  ];
  const right = [
    point(0, 0),
    point(0.4, 1),
    point(0.64, 0.9),
    point(lerp(0.82, 0.76, shaped), lerp(0.5, 0.37, shaped)),
    point(1, 0),
  ];
  return lobe(id + side, left, right, Math.min(0.015, width * 0.28));
}

function poseAt(step: number): Pose {
  const n = Math.max(8, Math.min(34, step));
  const shapes: Shape[] = [];
  let left = mainKite;
  if (n >= 16) left = mainTriangle;
  if (n >= 22) left = mainSpear;
  if (n === 26)
    left = mainSpear.map((p, i) => (i >= 5 ? [p[0], p[1] - 0.1, p[2]] : p));
  if (n >= 28) left = mainShoulder;
  if (n >= 31) left = mainFinished;
  const mainShape = n >= 28 ? clamp((n - 28) / 6) : 0;
  if (n >= 28 && n < 31)
    left = mainShoulder.map((p, i) => mixPoint(p, mainFinished[i]!, mainShape));
  const right = left.map(([x, y, z]) => [-x, y, z] as P);
  shapes.push(...lobe("main", left, right, n === 34 ? 0.019 : 0.008));

  // The lower paper remains broad until it is progressively packed into a stem.
  const widths = [0, 0.2071, 0.15, 0.1, 0.055, 0.032, 0.013];
  const tailWidth = n < 16 ? 0.2071 : n <= 20 ? widths[n - 15]! : 0.013;
  const tailShift = n === 17 ? -0.035 : n === 19 ? 0.022 : 0;
  const tail: P[] = [
    [0, 0.5, -0.007],
    [-tailWidth, 0.5, -0.007],
    [tailShift - tailWidth * 0.12, 0.13, -0.004],
    [0, 0, -0.004],
    [tailShift + tailWidth * 0.12, 0.13, -0.004],
    [tailWidth, 0.5, -0.007],
  ];
  shapes.push({
    id: "tail",
    points: n <= 21 ? tail : tail.map(() => [0, 0.35, -0.007] as P),
  });

  const shaped = n >= 31 ? clamp((n - 30) / 4) : 0;
  for (const side of [-1, 1]) {
    const opened = side === 1 ? n >= 11 : n >= 14;
    let tip: P = [side * 0.015, 0.52, -0.01];
    let width = 0.008;
    if (opened) {
      if (n === 11) tip = [side * 0.26, 0.23, 0.12];
      else if (n === 12) tip = [side * 0.37, 0.28, 0.015];
      else tip = [side * (n >= 31 ? 0.44 : 0.39), n >= 31 ? 0.63 : 0.57, 0];
      width = n >= 31 ? 0.065 : 0.06;
    }
    const root: P = [0, 0.35, n >= 16 && n <= 22 ? -0.015 : 0.003];
    shapes.push(
      ...blade(
        "side",
        side,
        root,
        tip,
        width,
        shaped,
        n === 34 ? side * 0.009 : 0.005,
      ),
    );
    const shortScale = n >= 15 ? 1 : 0;
    shapes.push(
      ...blade(
        "lower",
        side,
        [0, 0.35, 0.002],
        [side * 0.21 * shortScale, 0.35 - 0.085 * shortScale, -0.002],
        0.041 * shortScale,
        shaped,
      ),
    );
  }

  // The back-side packing folds are shown as a small fan, then tucked away.
  const fan = n >= 17 && n <= 20 ? (n < 19 ? 0.7 : 1) : n === 21 ? 0.3 : 0;
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const x = side * (0.07 + (i % 2) * 0.055) * fan;
    shapes.push({
      id: `packing-${i}`,
      points: [
        [0, 0.35, 0.006],
        [x, 0.31 - (i % 2) * 0.07 * fan, 0.012 + 0.006 * fan],
        [x * 0.65, 0.4, 0.008],
      ],
    });
  }

  // A small internal flap records the tip folds before it is tucked behind.
  const tabSize = n >= 25 && n <= 29 ? (n === 27 ? 0.1 : 0.075) : 0;
  const tabBase = n < 28 ? 0.73 : 0.81;
  const tabTip = n === 26 ? tabBase - tabSize : tabBase + tabSize;
  shapes.push({
    id: "inside-tip",
    points: [
      [-0.043 * (tabSize > 0 ? 1 : 0), tabBase, 0.012],
      [0, tabTip, 0.022],
      [0.043 * (tabSize > 0 ? 1 : 0), tabBase, 0.012],
    ],
  });

  const stemActive = n >= 19 ? 1 : 0;
  const rootY = 0.35;
  const length = 0.415 * stemActive;
  const angle = n === 32 ? 1.35 : 0;
  const curl = n === 34 ? 1 : 0;
  const stemWidth = n < 34 ? 0.012 : 0.0065;
  const stem: P[] = [];
  const stemRidge: P[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = length * t * Math.sin(angle) + 0.055 * curl * t * t;
    const y = rootY - length * t * Math.cos(angle);
    const z = -0.003 + 0.018 * curl * t * t;
    const w = stemWidth * lerp(1, 0.32, t) * stemActive;
    stem.push([x - w, y, z]);
    stemRidge.push([x, y, z + 0.002]);
  }
  for (let i = 12; i >= 0; i--) {
    const t = i / 12;
    const x = length * t * Math.sin(angle) + 0.055 * curl * t * t;
    const y = rootY - length * t * Math.cos(angle);
    stem.push([
      x + stemWidth * lerp(1, 0.32, t) * stemActive,
      y,
      -0.003 + 0.018 * curl * t * t,
    ]);
  }
  shapes.push({ id: "stem", points: stem, ridge: stemRidge });
  return { face: illustrationFace(n), shapes };
}

function world(p: P, face: number): Vec3 {
  const angle = face * Math.PI,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const x = p[0] * c + (p[2] ?? 0) * s,
    y = p[1];
  return {
    x: (y + x) * Math.SQRT1_2,
    y: (y - x) * Math.SQRT1_2,
    z: -p[0] * s + (p[2] ?? 0) * c,
  };
}
const distance = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Render a diagram pose directly; no physics-solver result is claimed. */
export function illustratedScene(step: number, progress = 1): SolvedScene {
  const before = poseAt(Math.max(8, step - 1)),
    after = poseAt(step);
  const t = clamp(progress);
  const beforeById = new Map(before.shapes.map((shape) => [shape.id, shape]));
  const afterById = new Map(after.shapes.map((shape) => [shape.id, shape]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])];
  const shapes = ids.map((id) => {
    const from = beforeById.get(id),
      to = afterById.get(id);
    const shape = to ?? from!;
    const collapse = shape.points[0]!;
    return {
      ...shape,
      points: shape.points.map((p, k) =>
        mixPoint(from?.points[k] ?? collapse, to?.points[k] ?? collapse, t),
      ),
      ridge: shape.ridge?.map((p, k) =>
        mixPoint(from?.ridge?.[k] ?? collapse, to?.ridge?.[k] ?? collapse, t),
      ),
    };
  });
  const face = lerp(before.face, after.face, t);
  const panels: Panel[] = [];
  const edges: SolvedScene["edges"][number][] = [];
  let id = 1000;
  for (const shape of shapes) {
    const contour = shape.points.map((p) => new Vector2(p[0], p[1]));
    const points = shape.points.map((p) => world(p, face));
    const panelCount = panels.length;
    for (const sourceTriangle of ShapeUtils.triangulateShape(contour, [])) {
      const triangle = [...sourceTriangle];
      let vertices = triangle.map((i) => points[i]!);
      const a = shape.points[triangle[0]!]!,
        b = shape.points[triangle[1]!]!,
        c = shape.points[triangle[2]!]!;
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) {
        [triangle[1], triangle[2]] = [triangle[2]!, triangle[1]!];
        vertices = triangle.map((i) => points[i]!);
      }
      const a3 = vertices[0]!,
        b3 = vertices[1]!,
        c3 = vertices[2]!;
      const ab = { x: b3.x - a3.x, y: b3.y - a3.y, z: b3.z - a3.z },
        ac = { x: c3.x - a3.x, y: c3.y - a3.y, z: c3.z - a3.z };
      const normal = {
        x: ab.y * ac.z - ab.z * ac.y,
        y: ab.z * ac.x - ab.x * ac.z,
        z: ab.x * ac.y - ab.y * ac.x,
      };
      const size = Math.hypot(normal.x, normal.y, normal.z);
      if (size < 1e-10) continue;
      const facetId = id++;
      panels.push({
        facet: {
          id: facetId,
          poly: triangle.map((i) => ({
            x: shape.points[i]![0],
            y: shape.points[i]![1],
          })),
          transform: IDENTITY,
          z: 0,
        },
        points: vertices,
        normal: { x: normal.x / size, y: normal.y / size, z: normal.z / size },
      });
    }
    if (panels.length === panelCount) continue;
    if (shape.edges !== false)
      points.forEach((a, i) => {
        const b = points[(i + 1) % points.length]!;
        if (distance(a, b) > 1e-6) edges.push({ a, b });
      });
    shape.ridge?.forEach((p, i) => {
      if (i === 0) return;
      const a = world(shape.ridge![i - 1]!, face),
        b = world(p, face);
      if (distance(a, b) > 1e-6) edges.push({ a, b });
    });
  }
  return {
    panels,
    edges,
    shade: {},
    rank: {},
    settled: t === 1,
    anchorId: undefined,
    centre: world([0, 0.485, 0], face),
    reach: 0.59,
  };
}
