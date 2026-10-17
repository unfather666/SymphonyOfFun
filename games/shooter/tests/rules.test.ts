// Proves rules.json is complete and in range, and that bad values fall back with a plain message. Area: logic/rules. 2026-10-17
import { describe, expect, test } from 'vitest';
import { RULE_LIMITS, parseRules } from '../logic/rules';
import { readJson } from './helpers';

describe('rules', () => {
  test('content/rules.json has every key, in range, nothing extra', () => {
    const { rules, errors } = parseRules(readJson('rules.json'));
    expect(errors).toEqual([]);
    expect(Object.keys(rules).sort()).toEqual(Object.keys(RULE_LIMITS).sort());
  });
  test('out of range, wrong type and missing values fall back and say so', () => {
    const { rules, errors } = parseRules({ player_speed: 9999, player_hp: 'lots', bogus: 1 });
    expect(rules.player_speed).toBe(90);
    expect(rules.player_hp).toBe(100);
    expect(errors).toContain('rules: "player_speed" is 9999, outside 20..300; using 90.');
    expect(errors).toContain('rules: "player_hp" must be a number; using 100.');
    expect(errors).toContain('rules: unknown key "bogus" ignored.');
    expect(errors.some((e) => e.includes('"dash_ms" is missing'))).toBe(true);
  });
  test('a non-object is refused whole', () => {
    expect(parseRules(null).errors[0]).toBe('rules: content/rules.json is not an object; using built-in fallbacks.');
  });
});
