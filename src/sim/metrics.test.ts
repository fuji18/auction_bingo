/**
 * metrics の集計・相関・抽出の検証。KPI の閾値そのものは検証しない
 * (バランス調整で変動するため。閾値は run.ts の WARN 表示に留める)。
 */

import { describe, it, expect } from 'vitest';
import type { PlayerId } from '../core/types';
import { DEFAULT_CONFIG } from '../core/config';
import { pearson, extractGame, summarize } from './metrics';
import type { RawGame } from './metrics';
import { playOne } from './play';
import { createAgent } from '../agents/registry';

describe('pearson', () => {
  it('完全正相関は 1', () => {
    const pts = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ];
    expect(pearson(pts)).toBeCloseTo(1, 10);
  });

  it('完全負相関は -1', () => {
    const pts = [
      { x: 1, y: 6 },
      { x: 2, y: 4 },
      { x: 3, y: 2 },
    ];
    expect(pearson(pts)).toBeCloseTo(-1, 10);
  });

  it('既知データセットの相関を再現する', () => {
    // x=[1,2,3,4,5], y=[2,4,5,4,5] の r ≈ 0.7745966692
    const xs = [1, 2, 3, 4, 5];
    const ys = [2, 4, 5, 4, 5];
    const pts = xs.map((x, i) => ({ x, y: ys[i] }));
    expect(pearson(pts)).toBeCloseTo(0.7745966692, 8);
  });

  it('片方が定数(分散0)なら 0 を返す', () => {
    const pts = [
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ];
    expect(pearson(pts)).toBe(0);
  });

  it('空配列は 0', () => {
    expect(pearson([])).toBe(0);
  });
});

/** テスト用の RawGame を作る(未指定は 0 埋め)。 */
function rawGame(over: Partial<RawGame> = {}): RawGame {
  return {
    endedByBingo: true,
    finishTurn: 18,
    winCredit: { p0: 0, p1: 0, p2: 0 },
    auctionWins: { p0: 0, p1: 0, p2: 0 },
    submittedTotal: 0,
    submittedWithSkill: 0,
    lateBySkill: { none: 0, shift: 0, vision: 0, greed: 0 },
    lateTotal: 0,
    passCount: 0,
    chooseTotal: 0,
    ...over,
  };
}

const SLOTS: Record<PlayerId, string> = {
  p0: 'leo',
  p1: 'sara',
  p2: 'hoarder',
};

describe('summarize', () => {
  it('ビンゴ発生率・平均決着ターン・スキル使用率・パス率を算出する', () => {
    const games = [
      rawGame({
        endedByBingo: true,
        finishTurn: 16,
        submittedTotal: 48,
        submittedWithSkill: 24,
        chooseTotal: 16,
        passCount: 2,
      }),
      rawGame({
        endedByBingo: false,
        finishTurn: 20,
        submittedTotal: 60,
        submittedWithSkill: 12,
        chooseTotal: 20,
        passCount: 0,
      }),
    ];
    const m = summarize(games, SLOTS);
    expect(m.games).toBe(2);
    expect(m.bingoRate).toBe(0.5);
    expect(m.avgFinishTurn).toBe(18);
    expect(m.skillUsageRate).toBeCloseTo((24 + 12) / (48 + 60), 10);
    expect(m.passRate).toBeCloseTo(2 / 36, 10);
  });

  it('スロット別勝率を引き分け按分込みで算出し、支配的戦略の勝率が最大値になる', () => {
    const games = [
      rawGame({ winCredit: { p0: 1, p1: 0, p2: 0 } }),
      rawGame({ winCredit: { p0: 1, p1: 0, p2: 0 } }),
      // 引き分け(p1,p2 で 0.5 ずつ)
      rawGame({ winCredit: { p0: 0, p1: 0.5, p2: 0.5 } }),
    ];
    const m = summarize(games, SLOTS);
    const byId = Object.fromEntries(
      m.strategyWinRates.map((s) => [s.playerId, s])
    );
    expect(byId.p0.winRate).toBeCloseTo(2 / 3, 10);
    expect(byId.p0.agent).toBe('leo');
    expect(byId.p1.winRate).toBeCloseTo(0.5 / 3, 10);
    expect(byId.p2.winRate).toBeCloseTo(0.5 / 3, 10);
    expect(m.dominantStrategyWinRate).toBeCloseTo(2 / 3, 10);
  });

  it('落札回数と勝率の相関を game×player の点で算出する', () => {
    // 落札が多い者ほど勝つ関係を作ると r > 0 になる。
    const games = [
      rawGame({
        auctionWins: { p0: 5, p1: 1, p2: 0 },
        winCredit: { p0: 1, p1: 0, p2: 0 },
      }),
      rawGame({
        auctionWins: { p0: 4, p1: 2, p2: 0 },
        winCredit: { p0: 1, p1: 0, p2: 0 },
      }),
    ];
    const m = summarize(games, SLOTS);
    expect(m.auctionWinCorrelation).toBeGreaterThan(0);
    expect(m.auctionWinCorrelation).toBeLessThanOrEqual(1);
  });

  it('終盤スキル比率をスキル別に、支配度をスキル購入内割合で算出する', () => {
    const games = [
      rawGame({
        lateTotal: 10,
        lateBySkill: { none: 4, shift: 1, vision: 4, greed: 1 },
      }),
    ];
    const m = summarize(games, SLOTS);
    expect(m.lateSkillShare.none).toBeCloseTo(0.4, 10);
    expect(m.lateSkillShare.vision).toBeCloseTo(0.4, 10);
    // スキル購入 6 件のうち vision 4 件 → 支配度 4/6
    expect(m.lateSkillDominance).toBeCloseTo(4 / 6, 10);
  });

  it('空入力でも例外なく 0 を返す', () => {
    const m = summarize([], SLOTS);
    expect(m.games).toBe(0);
    expect(m.bingoRate).toBe(0);
    expect(m.passRate).toBe(0);
    expect(m.dominantStrategyWinRate).toBe(0);
  });
});

describe('extractGame(実対局の不変条件)', () => {
  it('baseline 同士の 1 対局から一貫した生データを抽出する', () => {
    const agents = {
      p0: createAgent('hoarder'),
      p1: createAgent('allIn'),
      p2: createAgent('random'),
    };
    const state = playOne(agents, DEFAULT_CONFIG, 42);
    expect(state.phase).toBe('finished');
    const raw = extractGame(state);

    // 各ターン全員(3人)が提出する。
    expect(raw.submittedTotal).toBe(3 * raw.finishTurn);
    // 各ターンちょうど 1 回の落札 → 落札総数 = 決着ターン数。
    const totalWins =
      raw.auctionWins.p0 + raw.auctionWins.p1 + raw.auctionWins.p2;
    expect(totalWins).toBe(raw.finishTurn);
    // 各ターンちょうど 1 回の数字選択(パス含む)。
    expect(raw.chooseTotal).toBe(raw.finishTurn);
    // 決着ターンは result.turn と一致。
    expect(raw.finishTurn).toBe(state.result!.turn);
    // 終盤の提出数は全提出数を超えない。
    expect(raw.lateTotal).toBeLessThanOrEqual(raw.submittedTotal);
    expect(raw.passCount).toBeLessThanOrEqual(raw.chooseTotal);
  });

  it('同一シード・同一 Agent は決定的に同じ生データを返す', () => {
    const build = () => ({
      p0: createAgent('leo'),
      p1: createAgent('sara'),
      p2: createAgent('hoarder'),
    });
    const a = extractGame(playOne(build(), DEFAULT_CONFIG, 7));
    const b = extractGame(playOne(build(), DEFAULT_CONFIG, 7));
    expect(a).toEqual(b);
  });

  it('finished 前の state を渡すと throw する', () => {
    // createGame 直後は submitting。
    const agents = {
      p0: createAgent('hoarder'),
      p1: createAgent('hoarder'),
      p2: createAgent('hoarder'),
    };
    const finished = playOne(agents, DEFAULT_CONFIG, 1);
    const notFinished = { ...finished, phase: 'submitting' as const };
    expect(() => extractGame(notFinished)).toThrow();
  });
});
