import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { buildMesh } from "./engine/scene3d";
import { illustratedScene } from "./illustrations";

export async function downloadMaple(): Promise<void> {
  const finalScene = illustratedScene(34);
  const built = buildMesh(
    finalScene,
    {
      front: "#c5643f",
      back: "#e8ab79",
      ink: "#683e2e",
      thickness: 0,
      perspective: false,
      shadow: false,
    },
    new Set(),
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(built.positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(built.normals, 3));
  geometry.setAttribute("color", new BufferAttribute(built.colours, 3));
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "Maple leaf — diagram-derived illustrative model";
  const model = new Group();
  model.name = "Brian Chan maple leaf study";
  model.add(mesh);
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array(
        finalScene.edges.flatMap(({ a, b }) => [
          a.x,
          a.y,
          a.z + 0.0005,
          b.x,
          b.y,
          b.z + 0.0005,
        ]),
      ),
      3,
    ),
  );
  const lineMaterial = new LineBasicMaterial({
    color: "#683e2e",
    transparent: true,
    opacity: 0.55,
  });
  const creases = new LineSegments(lineGeometry, lineMaterial);
  creases.name = "Folded edges and veins";
  model.add(creases);
  model.rotation.z = Math.PI / 4;
  model.position.y = -0.35;
  const binary = await new GLTFExporter().parseAsync(model, { binary: true });
  if (!(binary instanceof ArrayBuffer)) throw new Error("GLB export failed.");
  const url = URL.createObjectURL(
    new Blob([binary], { type: "model/gltf-binary" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "maple-leaf.glb";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  geometry.dispose();
  material.dispose();
  lineGeometry.dispose();
  lineMaterial.dispose();
}
