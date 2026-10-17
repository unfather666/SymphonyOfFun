// Kinematic car: speed, lane, hop, health. Reads the track, never draws.
import { segAt, poseAt, newPose } from './track';
import type { Track } from './track';
import { STEP_S, type DriveInput, type Pose, type Rules } from './types';

export interface Car {
  /** Arc distance along the track (m). */
  s: number;
  /** -1..1 across the road (road edge at ±1). */
  lane: number;
  speed: number;
  /** Height above the road and vertical speed. */
  h: number;
  vh: number;
  airborne: boolean;
  health: number;
  syncStacks: number;
  syncUntilMs: number;
  boostUntilMs: number;
  /** Top-speed multiplier while boosting. */
  boostMul: number;
  /** Steering is locked to slideSteer until this time (puddles). */
  slideUntilMs: number;
  slideSteer: number;
  /** Last steering input, remembered for slides. */
  lastSteer: number;
  offroad: boolean;
  /** Set when the car went over an edge or into a gap; the sim turns it into a death. */
  fell: boolean;
  /** Set for one step when the car touched down. */
  landed: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  px: number;
  py: number;
  pz: number;
  pyaw: number;
  ppitch: number;
  proll: number;
  plane: number;
}

export function newCar(): Car {
  return {
    s: 0, lane: 0, speed: 0, h: 0, vh: 0, airborne: false, health: 100, syncStacks: 0, syncUntilMs: 0, boostUntilMs: 0, boostMul: 1, slideUntilMs: 0, slideSteer: 0, lastSteer: 0,
    offroad: false, fell: false, landed: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, px: 0, py: 0, pz: 0, pyaw: 0, ppitch: 0, proll: 0, plane: 0,
  };
}

export interface CarEnv {
  track: Track;
  rules: Rules;
  maxSpeed: number;
  /** Multiplier on rules.gravity (moon < 1). */
  gravity: number;
}

const scratch: Pose = newPose();

export function carMaxSpeed(car: Car, env: CarEnv, nowMs: number): number {
  const sync = nowMs < car.syncUntilMs ? car.syncStacks * env.rules.syncBonusPerStack : 0;
  const boost = nowMs < car.boostUntilMs ? car.boostMul : 1;
  return env.maxSpeed * (1 + sync) * boost;
}

/** Copy the current pose to the "previous" fields so draw can interpolate. */
export function savePrev(car: Car): void {
  car.px = car.x;
  car.py = car.y;
  car.pz = car.z;
  car.pyaw = car.yaw;
  car.ppitch = car.pitch;
  car.proll = car.roll;
  car.plane = car.lane;
}

/** Put the world pose on the car from s, lane and h. */
export function placeCar(car: Car, env: CarEnv): void {
  const p = poseAt(env.track, car.s, scratch);
  const lat = car.lane * env.rules.halfRoadM;
  car.x = p.x + Math.cos(p.yaw) * lat;
  car.z = p.z + Math.sin(p.yaw) * lat;
  car.y = p.y + car.h;
  car.yaw = p.yaw;
  car.pitch = car.airborne ? p.pitch + Math.atan2(car.vh, Math.max(car.speed, 5)) * 0.5 : p.pitch;
}

export function stepCar(car: Car, inp: DriveInput, nowMs: number, env: CarEnv): void {
  const r = env.rules;
  const len = env.track.ctx.segLen;
  car.landed = false;
  const maxV = carMaxSpeed(car, env, nowMs);

  if (inp.accel) car.speed += r.accel * Math.min(1, Math.max(0, 1.2 - car.speed / maxV)) * STEP_S;
  else car.speed -= r.coastDecel * STEP_S;
  if (inp.brake) car.speed -= r.brakeDecel * STEP_S;
  if (car.offroad) car.speed -= r.offroadDecel * STEP_S;
  if (car.speed > maxV) car.speed = Math.max(maxV, car.speed - 6 * STEP_S);
  if (car.speed < 0) car.speed = 0;

  const rate = r.steerRate * (inp.brake ? r.brakeSteerBoost : 1);
  const steer = nowMs < car.slideUntilMs ? car.slideSteer : inp.steer;
  car.lastSteer = inp.steer;
  car.lane += steer * rate * STEP_S;
  if (car.lane > r.laneHardLimit) car.lane = r.laneHardLimit;
  else if (car.lane < -r.laneHardLimit) car.lane = -r.laneHardLimit;

  car.s += car.speed * STEP_S;
  const seg = segAt(env.track, Math.floor(car.s / len));

  if (inp.jumpPressed && !car.airborne && seg.ramp) {
    car.airborne = true;
    car.vh = r.jumpSpeed;
    car.h = 0.001;
  }
  if (car.airborne) {
    car.vh -= r.gravity * env.gravity * STEP_S;
    car.h += car.vh * STEP_S;
    if (car.h <= 0) {
      car.h = 0;
      car.vh = 0;
      car.airborne = false;
      car.landed = true;
    }
  }

  const limit = seg.halfWidth + (r.laneEdgeLimit - 1);
  car.offroad = Math.abs(car.lane) > limit;
  if (!car.airborne && (seg.gap || (seg.drop && car.offroad))) car.fell = true;

  const target = -steer * 0.14;
  car.roll += (target - car.roll) * 0.2;
  placeCar(car, env);
}
