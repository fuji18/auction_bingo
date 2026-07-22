/**
 * KPI 集計(純粋関数)。決着済み GameState → 1 ゲーム分の生データ、生データ配列 → KPI。
 *
 * PRD「成功指標(KPI)」のプライマリー 7 項目を計算する:
 *   ビンゴ発生率 / スキル使用率 / 落札回数と勝率の相関(ピアソン r) /
 *   支配的戦略の勝率 / 平均決着ターン / 終盤(残り5ターン)のスキル選択比率 / パス率
 *
 * 閾値そのものの合否判定はここでは行わない(バランス調整で変動するため。run.ts が
 * 目標レンジと WARN を表示する)。
 */

import type { GameState, PlayerId, SkillId } from '../core/types';

/** 提出時のスキル選択カテゴリ(スキル無しを含む)。 */
export type SkillKey = 'none' | SkillId;

/** P0 は 3 人固定(PRD)。 */
const PLAYER_IDS: PlayerId[] = ['p0', 'p1', 'p2'];

const emptyByPlayer = (): Record<PlayerId, number> => ({ p0: 0, p1: 0, p2: 0 });

/** 1 ゲーム分の集計元データ(加算可能な素の数値のみ)。 */
export interface RawGame {
  /** ビンゴ決着(タイムアップでない)か。 */
  endedByBingo: boolean;
  /** 決着ターン(= result.turn)。 */
  finishTurn: number;
  /** 勝ち分。勝者は 1/勝者数、それ以外は 0(引き分けを按分)。 */
  winCredit: Record<PlayerId, number>;
  /** 落札回数。 */
  auctionWins: Record<PlayerId, number>;
  /** 全提出数。 */
  submittedTotal: number;
  /** スキルを購入した提出数(skill !== null)。 */
  submittedWithSkill: number;
  /** 終盤(残り5ターン)の提出をスキル別に分類。 */
  lateBySkill: Record<SkillKey, number>;
  /** 終盤の提出総数。 */
  lateTotal: number;
  /** パス(NumberChosen.value === null)回数。 */
  passCount: number;
  /** 数字選択(パス含む)回数。 */
  chooseTotal: number;
}

/** KPI 集計結果。 */
export interface Metrics {
  games: number;
  /** ビンゴ発生率(0..1)。目標 ≥ 0.95。 */
  bingoRate: number;
  /** スキル使用率(0..1)。目標 0.40..0.60。 */
  skillUsageRate: number;
  /** 落札回数と勝率のピアソン相関。目標 ≥ 0.3。 */
  auctionWinCorrelation: number;
  /** スロット別勝率。 */
  strategyWinRates: { playerId: PlayerId; agent: string; winRate: number }[];
  /** 支配的戦略の勝率(スロット別勝率の最大)。目標 < 0.5。 */
  dominantStrategyWinRate: number;
  /** 平均決着ターン。目標 16..20。 */
  avgFinishTurn: number;
  /** 終盤の各カテゴリが終盤提出全体に占める割合(0..1)。 */
  lateSkillShare: Record<SkillKey, number>;
  /** 終盤にスキルを買った提出のうち、単一スキルの最大割合(0..1)。目標 ≤ 0.7。 */
  lateSkillDominance: number;
  /** パス率(0..1)。目標 0.01..0.15。 */
  passRate: number;
}

/**
 * ピアソンの積率相関係数。分散 0(片方が定数)のときは相関未定義のため 0 を返す。
 */
export function pearson(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n === 0) return 0;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const { x, y } of points) {
    sx += x;
    sy += y;
    sxy += x * y;
    sxx += x * x;
    syy += y * y;
  }
  const cov = n * sxy - sx * sy;
  const varX = n * sxx - sx * sx;
  const varY = n * syy - sy * sy;
  const denom = Math.sqrt(varX * varY);
  if (denom === 0) return 0;
  return cov / denom;
}

/**
 * 決着済み GameState から 1 ゲーム分の生データを抽出する。log を 1 回だけ走査する。
 * finished 前の state を渡すと throw する。
 */
export function extractGame(state: GameState): RawGame {
  const result = state.result;
  if (state.phase !== 'finished' || result === null) {
    throw new Error(
      'extractGame は決着済み(finished)の GameState を要求します'
    );
  }
  const finishTurn = result.turn;

  const winCredit = emptyByPlayer();
  const share = result.winners.length > 0 ? 1 / result.winners.length : 0;
  for (const w of result.winners) winCredit[w] = share;

  const auctionWins = emptyByPlayer();
  let submittedTotal = 0;
  let submittedWithSkill = 0;
  const lateBySkill: Record<SkillKey, number> = {
    none: 0,
    shift: 0,
    vision: 0,
    greed: 0,
  };
  let lateTotal = 0;
  let passCount = 0;
  let chooseTotal = 0;

  // 終盤 = 残り5ターン = turn > finishTurn - 5。TurnStarted で現ターンを追跡する。
  let curTurn = 0;
  const lateThreshold = finishTurn - 5;

  for (const ev of state.log) {
    switch (ev.type) {
      case 'TurnStarted':
        curTurn = ev.turn;
        break;
      case 'Submitted': {
        submittedTotal++;
        if (ev.skill !== null) submittedWithSkill++;
        if (curTurn > lateThreshold) {
          lateTotal++;
          lateBySkill[ev.skill ?? 'none']++;
        }
        break;
      }
      case 'AuctionResolved':
        auctionWins[ev.winner]++;
        break;
      case 'NumberChosen':
        chooseTotal++;
        if (ev.value === null) passCount++;
        break;
      default:
        break;
    }
  }

  return {
    endedByBingo: result.kind === 'bingo' || result.kind === 'draw-bingo',
    finishTurn,
    winCredit,
    auctionWins,
    submittedTotal,
    submittedWithSkill,
    lateBySkill,
    lateTotal,
    passCount,
    chooseTotal,
  };
}

/**
 * 生データ配列から KPI を集計する。`agentBySlot` はスロット別勝率のラベル付けに使う。
 */
export function summarize(
  games: RawGame[],
  agentBySlot: Record<PlayerId, string>
): Metrics {
  const n = games.length;

  let bingo = 0;
  let skillUse = 0;
  let submitted = 0;
  let turnSum = 0;
  let pass = 0;
  let choose = 0;
  let lateTotal = 0;
  const winCredit = emptyByPlayer();
  const lateBySkill: Record<SkillKey, number> = {
    none: 0,
    shift: 0,
    vision: 0,
    greed: 0,
  };
  const corrPoints: { x: number; y: number }[] = [];

  for (const g of games) {
    if (g.endedByBingo) bingo++;
    skillUse += g.submittedWithSkill;
    submitted += g.submittedTotal;
    turnSum += g.finishTurn;
    pass += g.passCount;
    choose += g.chooseTotal;
    lateTotal += g.lateTotal;
    for (const pid of PLAYER_IDS) {
      winCredit[pid] += g.winCredit[pid];
      corrPoints.push({ x: g.auctionWins[pid], y: g.winCredit[pid] });
    }
    for (const key of Object.keys(lateBySkill) as SkillKey[]) {
      lateBySkill[key] += g.lateBySkill[key];
    }
  }

  const strategyWinRates = PLAYER_IDS.map((pid) => ({
    playerId: pid,
    agent: agentBySlot[pid],
    winRate: n > 0 ? winCredit[pid] / n : 0,
  }));
  const dominantStrategyWinRate = strategyWinRates.reduce(
    (m, s) => Math.max(m, s.winRate),
    0
  );

  const lateSkillShare: Record<SkillKey, number> = {
    none: 0,
    shift: 0,
    vision: 0,
    greed: 0,
  };
  for (const key of Object.keys(lateSkillShare) as SkillKey[]) {
    lateSkillShare[key] = lateTotal > 0 ? lateBySkill[key] / lateTotal : 0;
  }
  const lateSkillBuys =
    lateBySkill.shift + lateBySkill.vision + lateBySkill.greed;
  const lateSkillDominance =
    lateSkillBuys > 0
      ? Math.max(lateBySkill.shift, lateBySkill.vision, lateBySkill.greed) /
        lateSkillBuys
      : 0;

  return {
    games: n,
    bingoRate: n > 0 ? bingo / n : 0,
    skillUsageRate: submitted > 0 ? skillUse / submitted : 0,
    auctionWinCorrelation: pearson(corrPoints),
    strategyWinRates,
    dominantStrategyWinRate,
    avgFinishTurn: n > 0 ? turnSum / n : 0,
    lateSkillShare,
    lateSkillDominance,
    passRate: choose > 0 ? pass / choose : 0,
  };
}
