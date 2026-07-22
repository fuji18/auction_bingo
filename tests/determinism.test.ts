/**
 * 決定性の統合テスト。
 *
 * 本プロジェクトの全機能(リプレイ・シミュレーション・セーブ復元)は
 * 「同一 (config, seed, actions) から同一 state・events」に依存する。
 * ここではフルゲームを2回流し、state と events が完全一致することを検証する。
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../src/core/config';
import { reduce, createGame } from '../src/core/reduce';
import { playGame } from './support/driver';

const SEEDS = [1, 42, 123456789, 2026, 7];

describe('決定性', () => {
  it.each(SEEDS)(
    '同一シードから同一の state・events が再現される (seed=%i)',
    (seed) => {
      const a = playGame(DEFAULT_CONFIG, seed);
      const b = playGame(DEFAULT_CONFIG, seed);
      expect(b.finalState).toEqual(a.finalState);
      expect(b.events).toEqual(a.events);
      expect(b.actions).toEqual(a.actions);
    }
  );

  it('記録した actions を1回の reduce で再生しても同一結果になる', () => {
    const seed = 987654;
    const played = playGame(DEFAULT_CONFIG, seed);
    const replayed = reduce(createGame(DEFAULT_CONFIG, seed), played.actions);
    expect(replayed.state).toEqual(played.finalState);
    expect(replayed.events).toEqual(played.events);
  });

  it('reduce は入力 state を破壊しない', () => {
    const state = createGame(DEFAULT_CONFIG, 55);
    const snapshot = structuredClone(state);
    reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 1 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
    ]);
    expect(state).toEqual(snapshot);
  });
});
