/**
 * シード付き乱数(mulberry32 相当)。
 *
 * 決定性の基礎。`Math.random()` は状態を外部に持ちシードを固定できないため使わない
 * (docs/development-guidelines.md「最優先の規約 — 決定性」)。状態(`RngState`)を
 * 引数で受け取り、消費後の新しい状態を返す純粋関数として実装する。
 *
 * value は (seed, counter) だけの関数であり、逐次実装の mulberry32 を
 * counter ベースの閉形式に変形している(内部状態 a は毎回 0x6D2B79F5 加算で
 * 進むため、counter 回消費後は a = seed + counter * 0x6D2B79F5 mod 2^32)。
 *
 * seed は整数を前提とする(createGame が整数 seed を供給する)。非整数を渡すと
 * 32bit 切り詰めのタイミングが逐次実装とずれ、教科書的 mulberry32 と値列が異なる。
 */

import type { RngState } from './types';

const MULBERRY_INCREMENT = 0x6d2b79f5;

/** 次の乱数 [0,1) と、消費後の RngState を返す。 */
export function next(rng: RngState): [value: number, next: RngState] {
  const counter = rng.counter + 1;
  // Math.imul(counter, K) は counter * K mod 2^32 = 逐次加算 mod 2^32 と一致する。
  const a = (rng.seed + Math.imul(counter, MULBERRY_INCREMENT)) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { seed: rng.seed, counter }];
}

/** [0, maxExclusive) の整数と、消費後の RngState を返す。 */
export function nextInt(
  rng: RngState,
  maxExclusive: number
): [value: number, next: RngState] {
  if (maxExclusive <= 0) {
    throw new Error(
      `nextInt: maxExclusive は 1 以上である必要があります(受領: ${maxExclusive})`
    );
  }
  const [value, nextRng] = next(rng);
  return [Math.floor(value * maxExclusive), nextRng];
}

/**
 * Fisher-Yates シャッフル。入力配列は破壊せず、シャッフル済みの新配列と
 * 消費後の RngState を返す。乱数の消費順序(末尾から先頭)を固定する。
 */
export function shuffle<T>(
  rng: RngState,
  items: readonly T[]
): [shuffled: T[], next: RngState] {
  const result = [...items];
  let cur = rng;
  for (let i = result.length - 1; i > 0; i--) {
    let j: number;
    [j, cur] = nextInt(cur, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return [result, cur];
}
