import { line, perpendicularBisector, sideOf, vec, type Vec } from './engine/geometry';
import { bottomLayers, createPaper, topLayers, type FoldOptions, type PaperState } from './engine/paper';
import { applyStep, movedBetween, type FoldPart, type FoldStep } from './engine/sequence';
import { petalDoubledFlap } from './petal';

export type LessonAction = { kind: 'fold'; fold: FoldStep } | { kind: 'flip' } | { kind: 'petal'; ids?: readonly [number, number, number, number] };
export interface LessonStep {
  title: string;
  description: string;
  hint: string;
  actions: LessonAction[];
}

const foldLine = (a: Vec, b: Vec, moving: Vec, options: FoldOptions = {}): FoldPart => ({
  line: line(a, b),
  side: sideOf(line(a, b), moving),
  options,
});
const bring = (from: Vec, to: Vec, options: FoldOptions = {}): FoldPart => {
  const crease = perpendicularBisector(from, to);
  return { line: crease, side: sideOf(crease, from), options };
};
const group = (first: FoldPart, ...also: FoldPart[]): FoldStep => ({ ...first, also });
const action = (fold: FoldStep): LessonAction => ({ kind: 'fold', fold });
const p = vec;
const A = p(0, 0), B = p(1, 0), C = p(1, 1), D = p(0, 1);
const H = p(0, 0.5), E = p(0.5, 0), centre = p(0.5, 0.5);
const diagonal = Math.SQRT1_2;
const uv = (u: number, v: number): Vec => p((u - v) * diagonal, (u + v) * diagonal);
const Q4 = [p(0, 0.5), p(0.5, 0.5), p(0.5, 1), p(0, 1)];

// The preliminary and petal bases follow Origamio's crane construction.
// Each grouped operation records the crease geometry and layer selection.
const squareBase = group(
  bring(B, A),
  bring(D, A),
  foldLine(A, centre, H, { region: [A, centre, D] }),
  foldLine(A, centre, E, { region: [A, centre, D] }),
);
const frontPetal = group(
  bring(E, uv(0.5, 0), { layers: topLayers(2) }),
  bring(H, uv(0.5, 0), { layers: topLayers(2) }),
  bring(A, uv(1, 0), { region: Q4 }),
);

export const lesson: LessonStep[] = [
  {
    title: '折出初始方形',
    description: '先压出对角线，再把两侧向中间收合，得到一个开口朝下的方形基本型。',
    hint: '注意：两侧需要向内收，四个角在底部重合。',
    actions: [
      action(bring(D, B)), action(bring(B, D, { layers: topLayers(1) })),
      action(bring(C, A)), action(bring(A, C, { layers: topLayers(1) })),
      action(squareBase),
    ],
  },
  {
    title: '花瓣折',
    description: '打开正面的纸层，把下方的角向上提，同时让两侧沿折痕向中线收合。',
    hint: '只处理正面这一层，背面的方形基本型留在原处。',
    actions: [action(frontPetal)],
  },
  {
    title: '翻面',
    description: '将整个模型左右翻到背面，尖端仍然朝上。',
    hint: '这是整体翻面，不产生新的折痕。',
    actions: [{ kind: 'flip' }],
  },
  {
    title: '压折右侧纸层',
    description: '打开右侧的纸袋，沿中线向左压平，形成较窄的对称纸层。',
    hint: '只移动背面右侧的纸层，左侧留在原处。',
    actions: [action(group(
      bring(E, H, { region: [A, E, centre], placement: 'bottom' }),
      bring(E, uv(diagonal - 0.5, 0), { region: [E, B, centre], placement: 'bottom' }),
      bring(H, uv(diagonal - 0.5, 0), { region: [A, E, centre], placement: 'bottom' }),
    ))],
  },
  {
    title: '再做一次花瓣折',
    description: '提起刚刚压开的纸尖，两侧沿折痕向内收，形成一片较小的菱形。',
    hint: '上下两层的折线并不相同；可旋转视角观察纸袋内部。',
    actions: [{ kind: 'petal' }],
  },
  {
    title: '将小尖角折回',
    description: '把刚提起的小尖角沿横向折痕向下折回。',
    hint: '只折最外面的小尖角，下面的长尖角保持不动。',
    actions: [action(bring(uv(0.5, 0), uv(diagonal - 0.5, 0), {
      layers: bottomLayers(1),
      region: [p(2 * ((1 - diagonal) / 2), 0), p(1 - 2 * ((1 - diagonal) / 2), 0), centre],
      placement: 'bottom',
    }))],
  },
  {
    title: '将纸层折回右侧',
    description: '把左边刚完成的纸层沿竖直中线翻回右侧。',
    hint: '翻动刚刚处理过的一组纸层，下面的大纸层保持原位。',
    actions: [action(bring(H, E, { region: [A, E, centre], placement: 'bottom' }))],
  },
  {
    title: '在左侧重复',
    description: '在左侧重复压折、花瓣折和折回的动作。',
    hint: '与刚才右侧的动作互为镜像。',
    actions: [action(group(
      bring(H, E, { region: [B, p(1, 0.5), centre], placement: 'bottom' }),
      bring(H, uv(diagonal - 0.5, 0), { region: [p(1, 0.5), C, centre], placement: 'bottom' }),
      bring(E, uv(diagonal - 0.5, 0), { region: [B, p(1, 0.5), centre], placement: 'bottom' }),
    )),
    { kind: 'petal', ids: [24, 25, 7, 2] },
    action(bring(uv(0.5, 0), uv(diagonal - 0.5, 0), {
      layers: bottomLayers(1),
      region: [p(1, 1 - diagonal), p(1, diagonal), centre],
      placement: 'bottom',
    })),
    action(bring(E, H, { region: [B, p(1, 0.5), centre], placement: 'bottom' }))],
  },
];

export interface Frame {
  before: PaperState;
  after: PaperState;
  movedIds: readonly number[];
  faceBefore: number;
  faceAfter: number;
}

export function buildFrames(steps: LessonStep[] = lesson): Frame[][] {
  let state = createPaper();
  let face = 0;
  return steps.map((step) => step.actions.map((part) => {
    const before = state;
    const faceBefore = face;
    let movedIds: readonly number[] = [];
    if (part.kind === 'flip') face = 1 - face;
    else if (part.kind === 'petal') {
      state = petalDoubledFlap(state, part.ids);
      movedIds = movedBetween(before, state);
    } else {
      const result = applyStep(state, part.fold);
      state = result.state;
      movedIds = result.movedIds;
    }
    return { before, after: state, movedIds, faceBefore, faceAfter: face };
  }));
}
