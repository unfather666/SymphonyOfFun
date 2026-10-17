// The 3D view: pooled segment meshes, the car, chase camera. Reads the sim, never changes it.
import { Color, DoubleSide, Fog, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, type WebGLRenderer } from 'three';
import { clearGeo, flushGeo, makeGeo, paletteFloats, parts, type Geo } from './geo';
import { buildSegment, type SegmentAssets } from './segmentMesh';
import { hasSeg } from '../../logic/track';
import type { Sim } from '../../logic/sim';
import type { Rules, ThemeDef } from '../../logic/types';

export interface SceneOpts {
  rules: Rules;
  theme: ThemeDef;
  segLen: number;
  /** Parts tables by prop id. */
  propDefs: ReadonlyMap<string, readonly (readonly number[])[]>;
  /** Car body parts, one table per damage state. */
  carStates: readonly (readonly (readonly number[])[])[];
  archIndex: number;
}

export interface RacerScene {
  draw(sim: Sim, alpha: number, nowMs: number, shakeX: number, shakeY: number): void;
  drawCalls(): number;
  triangles(): number;
  dispose(): void;
}

const SEG_VERTS = 3072;

export function createScene(renderer: WebGLRenderer, o: SceneOpts): RacerScene {
  const rules = o.rules;
  const pal = paletteFloats(o.theme.palette);
  const sky = new Color(o.theme.palette[0]);
  const scene = new Scene();
  scene.background = sky;
  scene.fog = new Fog(sky, o.theme.fogNear, o.theme.fogFar);
  const camera = new PerspectiveCamera(rules.fovBase, 384 / 216, 0.3, o.theme.fogFar + 40);
  const material = new MeshBasicMaterial({ vertexColors: true, fog: true, side: DoubleSide });

  const assets: SegmentAssets = {
    rules, segLen: o.segLen, palette: pal, archIndex: o.archIndex,
    props: o.theme.props.map((id) => o.propDefs.get(id) ?? []),
  };
  const geos: Geo[] = [];
  const meshes: Mesh[] = [];
  const slotIndex = new Int32Array(rules.segmentPool).fill(-1);
  for (let i = 0; i < rules.segmentPool; i++) {
    const g = makeGeo(SEG_VERTS);
    const m = new Mesh(g.geometry, material);
    m.visible = false;
    scene.add(m);
    geos.push(g);
    meshes.push(m);
  }

  const carGroup = new Group();
  const carGeos: Geo[] = [];
  const carMeshes: Mesh[] = o.carStates.map((st) => {
    const g = makeGeo(36 * (st.length + 1));
    clearGeo(g);
    parts(g, 0, 0, 0, 0, st, pal);
    flushGeo(g);
    carGeos.push(g);
    const m = new Mesh(g.geometry, material);
    m.visible = false;
    carGroup.add(m);
    return m;
  });
  carGroup.rotation.order = 'YXZ';
  scene.add(carGroup);

  let camYaw = 0;
  let camReady = false;
  let fovNow = rules.fovBase;

  return {
    draw(sim, alpha, nowMs, shakeX, shakeY) {
      const car = sim.car;
      const mask = sim.track.mask;
      const carSeg = Math.floor(car.s / o.segLen);
      const lo = Math.max(0, carSeg - rules.behindBeats);
      const hi = carSeg + rules.lookaheadBeats;
      for (let i = 0; i < slotIndex.length; i++) meshes[i]!.visible = false;
      for (let idx = lo; idx <= hi; idx++) {
        if (!hasSeg(sim.track, idx)) continue;
        const slot = idx & mask;
        const seg = sim.track.ring[slot]!;
        if (slotIndex[slot] !== idx) {
          buildSegment(geos[slot]!, seg, assets);
          slotIndex[slot] = idx;
        }
        const m = meshes[slot]!;
        m.position.set(seg.x0, seg.y0, seg.z0);
        m.visible = true;
      }

      const x = car.px + (car.x - car.px) * alpha;
      const y = car.py + (car.y - car.py) * alpha;
      const z = car.pz + (car.z - car.pz) * alpha;
      const yaw = car.pyaw + (car.yaw - car.pyaw) * alpha;
      const pitch = car.ppitch + (car.pitch - car.ppitch) * alpha;
      const roll = car.proll + (car.roll - car.proll) * alpha;
      const state = car.health > 60 ? 0 : car.health > 25 ? 1 : 2;
      for (let i = 0; i < carMeshes.length; i++) carMeshes[i]!.visible = i === state;
      carGroup.position.set(x, y, z);
      carGroup.rotation.set(pitch, -yaw, roll);

      if (!camReady) {
        camYaw = yaw;
        camReady = true;
      } else camYaw += (yaw - camYaw) * rules.cameraLag;
      const fx = Math.sin(camYaw), fz = -Math.cos(camYaw);
      camera.position.set(x - fx * rules.cameraBack + shakeX * 0.02, y + rules.cameraUp + shakeY * 0.02, z - fz * rules.cameraBack);
      camera.lookAt(x + fx * 10, y + 1.2, z + fz * 10);
      const since = nowMs - sim.beat.edgeMs;
      const pulse = since >= 0 && since < 250 ? (1 - since / 250) ** 2 : 0;
      const fov = rules.fovBase + rules.fovPulse * pulse + Math.min(6, car.speed * 0.06);
      if (Math.abs(fov - fovNow) > 0.01) {
        fovNow = fov;
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    },
    drawCalls: () => renderer.info.render.calls,
    triangles: () => renderer.info.render.triangles,
    dispose() {
      for (const g of geos) g.geometry.dispose();
      for (const g of carGeos) g.geometry.dispose();
      material.dispose();
    },
  };
}
