import './style.css';
import { buildFrames, lesson, type Frame } from './folds';
import { createScene, type SceneStyle } from './engine/scene3d';
import { createSheetSolver, type SolveRequest } from './engine/solver';
import { type PaperState } from './engine/paper';
import { type Orbit } from './engine/view3d';

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
};

const sceneElement = element<HTMLDivElement>('scene');
const scene = createScene(sceneElement);
const solver = createSheetSolver();
const frames = buildFrames();
const progress = element<HTMLInputElement>('progress');
const play = element<HTMLButtonElement>('play');
const prev = element<HTMLButtonElement>('prev');
const next = element<HTMLButtonElement>('next');
const cards = element<HTMLDivElement>('steps');
const style: SceneStyle = {
  front: '#d77a58', back: '#f5d9c0', ink: '#5e382c',
  thickness: 0.001, shadow: false, perspective: false,
};

let completed = 0;
let state: PaperState = frames[0]![0]!.before;
let face = 0;
let orbitYaw = 0;
let orbitPitch = 0;
let zoom = 1;
let active = false;
let paused = false;
let automatic = false;
let run = 0;
let animationId = 0;
let stateSerial = 0;
const stateIds = new WeakMap<PaperState, string>();
const idOf = (sheet: PaperState): string => {
  let id = stateIds.get(sheet);
  if (!id) { id = `paper-${++stateSerial}`; stateIds.set(sheet, id); }
  return id;
};
const orbit = (): Orbit => ({
  yaw: Math.PI / 4 + face * Math.PI + orbitYaw,
  pitch: 0.16 + face * (Math.PI - 0.32) + orbitPitch,
  roll: 0,
  zoom,
});

let pending: { request: SolveRequest; generation: number } | null = null;
let solving = false;
function show(request: SolveRequest): void {
  pending = { request, generation: run };
  if (solving) return;
  solving = true;
  void (async () => {
    while (pending) {
      const job = pending;
      pending = null;
      try {
        const result = await solver.solve(job.request);
        if (job.generation === run) scene.update(result, style, orbit(), undefined, new Set());
      } catch (error) {
        console.error('折纸视图计算失败', error);
        element('stage-step').textContent = '3D 视图计算失败，请刷新重试';
      }
    }
    solving = false;
  })();
}
function showState(sheet: PaperState, animation?: SolveRequest['animation']): void {
  show({ stateId: idOf(sheet), state: sheet, opening: Math.PI / 60,
    thickness: style.thickness, ...(animation ? { animation } : {}) });
}

function updateUI(): void {
  const visible = active ? completed + 1 : completed;
  const step = visible > 0 ? lesson[visible - 1] : undefined;
  element('step-tag').textContent = step ? `STEP ${String(visible).padStart(2, '0')} / 34` : 'PREPARATION';
  element('step-number').innerHTML = `${String(visible).padStart(2, '0')} <span>/ 34</span>`;
  element('step-title').textContent = step?.title ?? '准备一张方纸';
  element('step-description').textContent = step?.description ?? '点击播放，或选择下一步。你可以随时拖动纸张，换个角度观察。';
  element('step-hint').textContent = step?.hint ?? '纸张的两面使用不同颜色，方便分辨翻面和纸层。';
  element('stage-step').textContent = active ? `正在折叠 · ${String(visible).padStart(2, '0')} / 34` : completed === 0 ? '准备开始' : `已完成 · ${String(completed).padStart(2, '0')} / 34`;
  element('count').innerHTML = `${String(completed).padStart(2, '0')} <i>/</i> 34`;
  element('completed').textContent = String(completed);
  progress.value = String(completed);
  prev.disabled = completed === 0 && !active;
  next.disabled = completed >= lesson.length && !active;
  const isRunning = active && !paused;
  play.setAttribute('aria-label', isRunning ? '暂停' : '播放');
  play.title = isRunning ? '暂停' : '播放';
  element('play-icon').textContent = isRunning ? 'Ⅱ' : '▶';
  cards.querySelectorAll<HTMLButtonElement>('.step-card').forEach((card, index) => {
    card.classList.toggle('active', visible === index + 1);
    card.setAttribute('aria-current', visible === index + 1 ? 'step' : 'false');
    const caption = card.querySelector('.step-card-caption');
    if (caption) caption.textContent = index < completed ? '已完成 · 点击查看' : '点击查看完成状态';
  });
}

function seek(target: number): void {
  run++;
  active = false;
  paused = false;
  automatic = false;
  completed = Math.max(0, Math.min(lesson.length, target));
  const last = completed > 0 ? frames[completed - 1]!.at(-1)! : null;
  state = last?.after ?? frames[0]![0]!.before;
  face = last?.faceAfter ?? 0;
  showState(state);
  updateUI();
}

function waitAnimation(duration: number, generation: number, draw: (progress: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    let elapsed = 0;
    let last: number | undefined;
    const tick = (now: number): void => {
      if (generation !== run) { resolve(false); return; }
      const delta = last === undefined ? 0 : Math.min(80, now - last);
      last = now;
      if (!paused) {
        elapsed += delta;
        const t = Math.min(1, elapsed / duration);
        draw(t * t * (3 - 2 * t));
        if (t >= 1) { resolve(true); return; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function animateFrame(frame: Frame, generation: number): Promise<boolean> {
  if (frame.faceBefore !== frame.faceAfter) {
    showState(frame.before);
    const ok = await waitAnimation(1050, generation, (t) => {
      face = frame.faceBefore + (frame.faceAfter - frame.faceBefore) * t;
      scene.reorbit(orbit(), undefined);
    });
    if (!ok) return false;
  } else if (frame.movedIds.length) {
    const id = ++animationId;
    const ok = await waitAnimation(completed === 0 ? 850 : 1500, generation, (t) => {
      showState(frame.after, { id, previousId: idOf(frame.before), previous: frame.before,
        movedIds: frame.movedIds, progress: t });
    });
    if (!ok) return false;
  }
  state = frame.after;
  face = frame.faceAfter;
  showState(state);
  return true;
}

async function runNext(): Promise<void> {
  if (active || completed >= lesson.length) { automatic = false; updateUI(); return; }
  active = true;
  paused = false;
  const generation = ++run;
  updateUI();
  for (const frame of frames[completed]!) {
    if (!await animateFrame(frame, generation)) return;
  }
  if (generation !== run) return;
  completed++;
  active = false;
  updateUI();
  if (automatic && completed < lesson.length) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (automatic && generation === run) void runNext();
  } else if (completed === lesson.length) {
    automatic = false;
    updateUI();
  }
}

play.addEventListener('click', () => {
  if (active) {
    paused = !paused;
    automatic = !paused;
    updateUI();
    return;
  }
  if (completed === lesson.length) seek(0);
  automatic = true;
  void runNext();
});
prev.addEventListener('click', () => seek(active ? completed : completed - 1));
next.addEventListener('click', () => {
  if (active) seek(completed + 1);
  else { automatic = false; void runNext(); }
});
progress.addEventListener('input', () => seek(Number(progress.value)));
element('reset-view').addEventListener('click', () => {
  orbitYaw = 0; orbitPitch = 0; zoom = 1;
  scene.reorbit(orbit(), undefined);
});

cards.innerHTML = lesson.map((step, index) => `<button class="step-card" type="button" data-step="${index + 1}"><span class="step-card-number">${String(index + 1).padStart(2, '0')}</span><span class="step-card-title">${step.title}<span class="step-card-caption">点击查看完成状态</span></span></button>`).join('');
cards.addEventListener('click', (event) => {
  const card = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-step]');
  if (card) seek(Number(card.dataset.step));
});

let pointer: { x: number; y: number } | null = null;
scene.canvas.addEventListener('pointerdown', (event) => {
  pointer = { x: event.clientX, y: event.clientY };
  scene.canvas.setPointerCapture(event.pointerId);
});
scene.canvas.addEventListener('pointermove', (event) => {
  if (!pointer) return;
  orbitYaw += (event.clientX - pointer.x) * 0.008;
  orbitPitch += (event.clientY - pointer.y) * 0.008;
  pointer = { x: event.clientX, y: event.clientY };
  scene.reorbit(orbit(), undefined);
});
const releasePointer = (): void => { pointer = null; };
scene.canvas.addEventListener('pointerup', releasePointer);
scene.canvas.addEventListener('pointercancel', releasePointer);
scene.canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  zoom = Math.max(0.5, Math.min(4, zoom * Math.exp(-event.deltaY * 0.001)));
  scene.reorbit(orbit(), undefined);
}, { passive: false });
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); prev.click(); }
  if (event.key === 'ArrowRight') { event.preventDefault(); next.click(); }
  if (event.key === ' ') { event.preventDefault(); play.click(); }
});

new ResizeObserver(() => {
  scene.resize();
  scene.reorbit(orbit(), undefined);
}).observe(sceneElement);
scene.resize();
showState(state);
updateUI();
window.addEventListener('beforeunload', () => { solver.dispose(); scene.dispose(); });
