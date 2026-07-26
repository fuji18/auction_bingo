/**
 * セーブ復元の統合テスト。
 *
 * セーブは state 全体ではなく (seed, actions[]) だけを保存し、
 * 復元は reduce(createGame(config, seed), actions) で再計算する。
 * この再計算が保存時の state・events と一致すること、および
 * 復元後も同じ actions を追加適用すれば進行が続くことを検証する。
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../src/core/config';
import { createGame, reduce } from '../src/core/reduce';
import { playGame } from './support/driver';

const SEEDS = [3, 17, 250, 88888];

describe('セーブ復元', () => {
  it.each(SEEDS)(
    '(seed, actions) の再計算がフルゲーム結果に一致する (seed=%i)',
    (seed) => {
      const played = playGame(DEFAULT_CONFIG, seed);
      const restored = reduce(createGame(DEFAULT_CONFIG, seed), played.actions);
      expect(restored.state).toEqual(played.finalState);
      expect(restored.events).toEqual(played.events);
      expect(restored.state.phase).toBe('finished');
      expect(restored.state.result).not.toBeNull();
    }
  );

  it('途中まで復元してから続きを適用しても最終結果が一致する', () => {
    const seed = 424242;
    const played = playGame(DEFAULT_CONFIG, seed);
    const cut = Math.floor(played.actions.length / 2);

    // 前半だけ復元 → 後半を追加適用。
    const mid = reduce(
      createGame(DEFAULT_CONFIG, seed),
      played.actions.slice(0, cut)
    );
    const full = reduce(mid.state, played.actions.slice(cut));

    expect(full.state).toEqual(played.finalState);
  });
});
