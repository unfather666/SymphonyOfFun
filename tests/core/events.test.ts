import { describe, expect, test } from 'vitest';
import { EVENT_QUEUE_CAP, createEventBus } from '../../src/core/events/bus';

describe('event bus (rule 9)', () => {
  test('queues until flush, then delivers in order', () => {
    const bus = createEventBus();
    const got: number[] = [];
    bus.on('a:x', (p) => got.push(p.n as number));
    bus.emit('a:x', { n: 1 });
    bus.emit('a:x', { n: 2 });
    expect(got).toEqual([]);
    expect(bus.flush()).toBe(2);
    expect(got).toEqual([1, 2]);
  });
  test('emit inside a handler waits for the next flush', () => {
    const bus = createEventBus();
    const got: string[] = [];
    bus.on('a:first', () => {
      got.push('first');
      bus.emit('a:second');
    });
    bus.on('a:second', () => got.push('second'));
    bus.emit('a:first');
    bus.flush();
    expect(got).toEqual(['first']);
    bus.flush();
    expect(got).toEqual(['first', 'second']);
  });
  test('merge key replaces the queued payload', () => {
    const bus = createEventBus();
    const got: number[] = [];
    bus.on('a:hp', (p) => got.push(p.hp as number));
    bus.emit('a:hp', { hp: 5 }, 7);
    bus.emit('a:hp', { hp: 3 }, 7);
    bus.emit('a:hp', { hp: 9 }, 8);
    bus.flush();
    expect(got).toEqual([3, 9]);
  });
  test('full queue drops new events and warns once', () => {
    const warns: string[] = [];
    const bus = createEventBus((k) => warns.push(k));
    for (let i = 0; i < EVENT_QUEUE_CAP + 10; i++) bus.emit('a:x', { i });
    expect(bus.queued()).toBe(EVENT_QUEUE_CAP);
    expect(warns.filter((w) => w === 'event-queue-full').length).toBe(10);
  });
  test('payloads with live objects are refused', () => {
    const warns: string[] = [];
    const bus = createEventBus((k) => warns.push(k));
    bus.emit('a:x', { obj: {} as unknown as number });
    expect(bus.queued()).toBe(0);
    expect(warns).toEqual(['event-payload:a:x']);
  });
  test('unsubscribe stops delivery', () => {
    const bus = createEventBus();
    let n = 0;
    const off = bus.on('a:x', () => n++);
    bus.emit('a:x');
    bus.flush();
    off();
    bus.emit('a:x');
    bus.flush();
    expect(n).toBe(1);
  });
});
