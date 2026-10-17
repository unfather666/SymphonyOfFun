// Flying pieces and smoke as instanced cubes (two draw calls). Reads the pools, never changes them.
import { BoxGeometry, Color, InstancedMesh, MeshBasicMaterial, Object3D, type Scene } from 'three';
import type { Pool } from '../../logic/pieces';

const SMOKE_LIFE_MS = 900;

export interface PieceViews {
  update(pieces: Pool, smoke: Pool, nowMs: number): void;
  dispose(): void;
}

/** `palette` is the theme's 16 colours as '#rrggbb'; piece colour ids index it. Caps are the pool capacities. */
export function createPieceViews(scene: Scene, palette: readonly string[], piecesCap: number, smokeCap: number): PieceViews {
  const box = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ fog: true });
  const pieces = new InstancedMesh(box, material, piecesCap);
  const smoke = new InstancedMesh(box, new MeshBasicMaterial({ color: 0x8a8a96, fog: true }), smokeCap);
  pieces.frustumCulled = false;
  smoke.frustumCulled = false;
  pieces.count = 0;
  smoke.count = 0;
  scene.add(pieces, smoke);
  const colours = palette.map((c) => new Color(c));
  const dummy = new Object3D();

  return {
    update(p, s, nowMs) {
      for (let i = 0; i < p.n; i++) {
        dummy.position.set(p.x[i]!, p.y[i]!, p.z[i]!);
        dummy.rotation.set(p.rot[i]!, p.rot[i]! * 0.7, 0);
        dummy.scale.setScalar(p.size[i]!);
        dummy.updateMatrix();
        pieces.setMatrixAt(i, dummy.matrix);
        pieces.setColorAt(i, colours[p.col[i]!] ?? colours[0]!);
      }
      pieces.count = p.n;
      pieces.instanceMatrix.needsUpdate = true;
      if (pieces.instanceColor) pieces.instanceColor.needsUpdate = true;
      for (let i = 0; i < s.n; i++) {
        const age = 1 - Math.max(0, s.expire[i]! - nowMs) / SMOKE_LIFE_MS;
        dummy.position.set(s.x[i]!, s.y[i]!, s.z[i]!);
        dummy.rotation.set(0, age * 3, 0);
        dummy.scale.setScalar(s.size[i]! * (0.5 + age));
        dummy.updateMatrix();
        smoke.setMatrixAt(i, dummy.matrix);
      }
      smoke.count = s.n;
      smoke.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      box.dispose();
      material.dispose();
      (smoke.material as MeshBasicMaterial).dispose();
      pieces.dispose();
      smoke.dispose();
    },
  };
}
