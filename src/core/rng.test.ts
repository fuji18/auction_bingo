import { describe, it, expect } from 'vitest';
import type { RngState } from './types';
import { next, nextInt, shuffle } from './rng';

const seedState = (seed: number): RngState => ({ seed, counter: 0 });

describe('next', () => {
  it('同一 state から同一の value と nextRng を返す(決定的)', () => {
    const rng = seedState(42);
    const [v1, r1] = next(rng);
    const [v2, r2] = next(rng);
    expect(v1).toBe(v2);
    expect(r1).toEqual(r2);
  });

  it('counter を 1 進めた RngState を返す(seed は不変)', () => {
    const [, r] = next({ seed: 7, counter: 3 });
    expect(r).toEqual({ seed: 7, counter: 4 });
  });

  it('value が [0,1) に収まる', () => {
    let rng = seedState(123);
    for (let i = 0; i < 1000; i++) {
      const [v, nextRng] = next(rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      rng = nextRng;
    }
  });

  it('異なる seed からは異なる列になる', () => {
    const [a] = next(seedState(1));
    const [b] = next(seedState(2));
    expect(a).not.toBe(b);
  });

  it('消費順序の回帰: 固定 seed の先頭数値がスナップショットと一致する', () => {
    // 乱数の消費順序が変わるとこの値が壊れる(決定性の番人)。
    let rng = seedState(2026);
    const seq: number[] = [];
    for (let i = 0; i < 5; i++) {
      const [v, nextRng] = next(rng);
      seq.push(Number(v.toFixed(10)));
      rng = nextRng;
    }
    expect(seq).toEqual([
      0.4554076993, 0.308496146, 0.6611574492, 0.6184752183, 0.1522801018,
    ]);
  });
});

describe('nextInt', () => {
  it('[0, maxExclusive) に収まる', () => {
    let rng = seedState(99);
    for (let i = 0; i < 1000; i++) {
      const [n, nextRng] = nextInt(rng, 8);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(8);
      rng = nextRng;
    }
  });

  it('maxExclusive <= 0 で throw する', () => {
    expect(() => nextInt(seedState(1), 0)).toThrow();
    expect(() => nextInt(seedState(1), -3)).toThrow();
  });

  it('決定的(同一 state → 同一結果)', () => {
    const rng = seedState(5);
    expect(nextInt(rng, 100)).toEqual(nextInt(rng, 100));
  });
});

describe('shuffle', () => {
  it('入力配列を破壊しない', () => {
    const original = [1, 2, 3, 4, 5];
    const snapshot = [...original];
    shuffle(seedState(3), original);
    expect(original).toEqual(snapshot);
  });

  it('要素を保存する(順列である)', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const [shuffled] = shuffle(seedState(77), items);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it('決定的(同一 state → 同一並び・同一 nextRng)', () => {
    const items = ['a', 'b', 'c', 'd'];
    const [s1, r1] = shuffle(seedState(11), items);
    const [s2, r2] = shuffle(seedState(11), items);
    expect(s1).toEqual(s2);
    expect(r1).toEqual(r2);
  });

  it('要素数 - 1 回だけ rng を消費する(末尾から先頭)', () => {
    const [, r] = shuffle(seedState(0), [1, 2, 3, 4, 5]);
    expect(r.counter).toBe(4);
  });

  it('空配列・単一要素では rng を消費しない', () => {
    const rng = seedState(0);
    expect(shuffle(rng, [])).toEqual([[], rng]);
    expect(shuffle(rng, [9])).toEqual([[9], rng]);
  });
});
