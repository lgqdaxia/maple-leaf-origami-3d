import "./style.css";
import { buildFrames, lesson, type Frame } from "./folds";
import { createScene, type SceneStyle } from "./engine/scene3d";
import { createSheetSolver, type SolveRequest } from "./engine/solver";
import { type PaperState } from "./engine/paper";
import { type Orbit, type SolvedScene } from "./engine/view3d";
import { prepareTransition } from "./engine/transition";
import { illustratedScene, illustrationFace, lateSteps } from "./illustrations";

const steps = [...lesson, ...lateSteps];

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
};

const sceneElement = element<HTMLDivElement>("scene");
const scene = createScene(sceneElement);
const solver = createSheetSolver();
const frames = buildFrames();
const progress = element<HTMLInputElement>("progress");
const play = element<HTMLButtonElement>("play");
const prev = element<HTMLButtonElement>("prev");
const next = element<HTMLButtonElement>("next");
const cards = element<HTMLDivElement>("steps");
const style: SceneStyle = {
  front: "#d77a58",
  back: "#f5d9c0",
  ink: "#5e382c",
  thickness: 0.001,
  shadow: false,
  perspective: false,
};
const illustrationStyle: SceneStyle = {
  ...style,
  front: "#c5643f",
  back: "#e8ab79",
  thickness: 0,
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
  if (!id) {
    id = `paper-${++stateSerial}`;
    stateIds.set(sheet, id);
  }
  return id;
};
const orbit = (): Orbit => ({
  yaw: Math.PI / 4 + face * Math.PI + orbitYaw,
  pitch: 0.16 + face * (Math.PI - 0.32) + orbitPitch,
  roll: 0,
  zoom,
});

let displayed: SolvedScene | null = null;
let displayRevision = 0;
let displayReady: Promise<void> = Promise.resolve();
const requestFor = (sheet: PaperState): SolveRequest => ({
  stateId: idOf(sheet),
  state: sheet,
  opening: Math.PI / 60,
  thickness: style.thickness,
});
function present(result: SolvedScene, appearance: SceneStyle): void {
  displayed = result;
  scene.update(result, appearance, orbit(), undefined, new Set());
}
function showState(sheet: PaperState): void {
  const revision = ++displayRevision;
  displayReady = solver
    .solve(requestFor(sheet))
    .then((result) => {
      if (revision === displayRevision) present(result, style);
    })
    .catch((error: unknown) => {
      console.error("折纸视图计算失败", error);
      element("stage-step").textContent = "3D 视图计算失败，请刷新重试";
    });
}

function updateUI(): void {
  const visible = active ? completed + 1 : completed;
  const step = visible > 0 ? steps[visible - 1] : undefined;
  element("step-tag").textContent = step
    ? `STEP ${String(visible).padStart(2, "0")} / 34`
    : "PREPARATION";
  element("step-number").innerHTML =
    `${String(visible).padStart(2, "0")} <span>/ 34</span>`;
  element("step-title").textContent = step?.title ?? "准备一张方纸";
  element("step-description").textContent =
    step?.description ??
    "点击播放，或选择下一步。你可以随时拖动纸张，换个角度观察。";
  element("step-hint").textContent =
    step?.hint ?? "纸张的两面使用不同颜色，方便分辨翻面和纸层。";
  element("stage-step").textContent = active
    ? `正在折叠 · ${String(visible).padStart(2, "0")} / 34`
    : completed === 0
      ? "准备开始"
      : completed === 34
        ? "枫叶完成 · 34 / 34"
        : `已完成 · ${String(completed).padStart(2, "0")} / 34`;
  element("pose-type").textContent =
    visible > 8 ? "3D 关键帧示意" : "折痕几何演示";
  element("count").innerHTML =
    `${String(completed).padStart(2, "0")} <i>/</i> 34`;
  element("completed").textContent = String(completed);
  progress.value = String(completed);
  prev.disabled = completed === 0 && !active;
  next.disabled = active || completed >= steps.length;
  const isRunning = active && !paused;
  play.setAttribute("aria-label", isRunning ? "暂停" : "播放");
  play.title = isRunning ? "暂停" : "播放";
  element("play-icon").textContent = isRunning ? "Ⅱ" : "▶";
  cards
    .querySelectorAll<HTMLButtonElement>(".step-card")
    .forEach((card, index) => {
      card.classList.toggle("active", visible === index + 1);
      card.setAttribute(
        "aria-current",
        visible === index + 1 ? "step" : "false",
      );
      const caption = card.querySelector(".step-card-caption");
      if (caption)
        caption.textContent =
          index < completed ? "已完成 · 点击查看" : "点击查看完成状态";
    });
}

function seek(target: number): void {
  run++;
  active = false;
  paused = false;
  automatic = false;
  completed = Math.max(0, Math.min(steps.length, target));
  if (completed > lesson.length) {
    face = illustrationFace(completed);
    displayRevision++;
    displayReady = Promise.resolve();
    present(illustratedScene(completed), illustrationStyle);
    updateUI();
    return;
  }
  const last = completed > 0 ? frames[completed - 1]!.at(-1)! : null;
  state = last?.after ?? frames[0]![0]!.before;
  face = last?.faceAfter ?? 0;
  showState(state);
  updateUI();
}

function waitAnimation(
  duration: number,
  generation: number,
  draw: (progress: number) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    let elapsed = 0;
    let last: number | undefined;
    const tick = (now: number): void => {
      if (generation !== run) {
        resolve(false);
        return;
      }
      const delta = last === undefined ? 0 : Math.min(80, now - last);
      last = now;
      if (!paused) {
        elapsed += delta;
        const t = Math.min(1, elapsed / duration);
        draw(t);
        if (t >= 1) {
          resolve(true);
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function animateFrame(
  frame: Frame,
  generation: number,
): Promise<boolean> {
  if (frame.faceBefore !== frame.faceAfter) {
    const ok = await waitAnimation(1600, generation, (t) => {
      face = frame.faceBefore + (frame.faceAfter - frame.faceBefore) * t;
      scene.reorbit(orbit(), undefined);
    });
    if (!ok) return false;
  } else if (frame.movedIds.length) {
    if (!displayed) return false;
    const result = await solver.solve({
      ...requestFor(frame.after),
      animation: {
        id: ++animationId,
        previousId: idOf(frame.before),
        previous: frame.before,
        movedIds: frame.movedIds,
        progress: 1,
      },
    });
    if (generation !== run) return false;
    const target: SolvedScene = { ...result, settled: true };
    const at = prepareTransition(
      displayed,
      target,
      frame.movedIds,
      frame.after.size,
    );
    const ok = await waitAnimation(1600, generation, (t) => {
      scene.update(at(t), style, orbit(), undefined, new Set());
    });
    if (!ok) return false;
    present(target, style);
  }
  state = frame.after;
  face = frame.faceAfter;
  return true;
}

async function runNext(): Promise<void> {
  if (active || completed >= steps.length) {
    automatic = false;
    updateUI();
    return;
  }
  active = true;
  paused = false;
  const generation = ++run;
  updateUI();
  await displayReady;
  if (generation !== run) return;
  if (completed < lesson.length) {
    for (const frame of frames[completed]!) {
      if (!(await animateFrame(frame, generation))) return;
    }
  } else {
    const target = completed + 1;
    const fromFace = illustrationFace(completed),
      toFace = illustrationFace(target);
    // The first eight steps and the later teaching poses use different models.
    // Blend this one handover so the paper does not change in a single frame.
    let bridge: HTMLCanvasElement | undefined;
    if (completed === lesson.length) {
      bridge = document.createElement("canvas");
      bridge.width = scene.canvas.width;
      bridge.height = scene.canvas.height;
      bridge.getContext("2d")?.drawImage(scene.canvas, 0, 0);
      Object.assign(bridge.style, { position: "absolute", inset: "0", pointerEvents: "none" });
      sceneElement.append(bridge);
    }
    const ok = await waitAnimation(
      target === 34 ? 2200 : 1500,
      generation,
      (t) => {
        face = fromFace + (toFace - fromFace) * t;
        present(illustratedScene(target, t), illustrationStyle);
        if (bridge) bridge.style.opacity = String(1 - t);
      },
    );
    bridge?.remove();
    if (!ok) return;
    face = toFace;
    present(illustratedScene(target), illustrationStyle);
  }
  if (generation !== run) return;
  completed++;
  active = false;
  updateUI();
  if (automatic && completed < steps.length) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (automatic && generation === run) void runNext();
  } else if (completed === steps.length) {
    automatic = false;
    updateUI();
  }
}

play.addEventListener("click", () => {
  if (active) {
    paused = !paused;
    updateUI();
    return;
  }
  if (completed === steps.length) seek(0);
  automatic = true;
  void runNext();
});
prev.addEventListener("click", () => seek(active ? completed : completed - 1));
next.addEventListener("click", () => {
  if (!active) {
    automatic = false;
    void runNext();
  }
});
progress.addEventListener("input", () => seek(Number(progress.value)));
element("reset-view").addEventListener("click", () => {
  orbitYaw = 0;
  orbitPitch = 0;
  zoom = 1;
  scene.reorbit(orbit(), undefined);
});

cards.innerHTML = steps
  .map(
    (step, index) =>
      `<button class="step-card" type="button" data-step="${index + 1}"><span class="step-card-number">${String(index + 1).padStart(2, "0")}</span><span class="step-card-title">${step.title}<span class="step-card-caption">点击查看完成状态</span></span></button>`,
  )
  .join("");
cards.addEventListener("click", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-step]",
  );
  if (card) seek(Number(card.dataset.step));
});

let pointer: { x: number; y: number } | null = null;
scene.canvas.addEventListener("pointerdown", (event) => {
  pointer = { x: event.clientX, y: event.clientY };
  scene.canvas.setPointerCapture(event.pointerId);
});
scene.canvas.addEventListener("pointermove", (event) => {
  if (!pointer) return;
  orbitYaw += (event.clientX - pointer.x) * 0.008;
  orbitPitch += (event.clientY - pointer.y) * 0.008;
  pointer = { x: event.clientX, y: event.clientY };
  scene.reorbit(orbit(), undefined);
});
const releasePointer = (): void => {
  pointer = null;
};
scene.canvas.addEventListener("pointerup", releasePointer);
scene.canvas.addEventListener("pointercancel", releasePointer);
scene.canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    zoom = Math.max(0.5, Math.min(4, zoom * Math.exp(-event.deltaY * 0.001)));
    scene.reorbit(orbit(), undefined);
  },
  { passive: false },
);
document.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLButtonElement
  )
    return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    prev.click();
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    next.click();
  }
  if (event.key === " ") {
    event.preventDefault();
    play.click();
  }
});

new ResizeObserver(() => {
  scene.resize();
  scene.reorbit(orbit(), undefined);
}).observe(sceneElement);
scene.resize();
element("show-finished").addEventListener("click", () => {
  seek(34);
  element("stage").scrollIntoView({ behavior: "smooth", block: "center" });
});
element("restart").addEventListener("click", () => {
  seek(0);
  automatic = true;
  void runNext();
});
element("download-model").addEventListener("click", async () => {
  const button = element<HTMLButtonElement>("download-model");
  button.disabled = true;
  button.textContent = "正在生成…";
  try {
    await (await import("./export")).downloadMaple();
  } catch (error) {
    console.error("模型导出失败", error);
    element("pose-type").textContent = "模型导出失败，请重试";
  } finally {
    button.disabled = false;
    button.textContent = "下载枫叶 GLB ↓";
  }
});
const requested = Number(
  new URLSearchParams(location.search).get("step") ?? 34,
);
seek(Number.isFinite(requested) ? Math.floor(requested) : 34);
window.addEventListener("beforeunload", () => {
  solver.dispose();
  scene.dispose();
});
