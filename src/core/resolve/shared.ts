/**
 * ターン解決ヘルパが共有する型とユーティリティ。
 *
 * reduce.ts が肥大化(>500行)したため、7ステップの純粋関数を resolve/ に分割した。
 * 公開エクスポート(createGame / reduce / legalActions)は reduce.ts に集約し、
 * ここと各ステップモジュールは reduce.ts からのみ使う内部実装とする。
 */

import type { BalanceConfig } from '../config';
import type {
  GameEvent,
  GameState,
  PlayerId,
  PlayerState,
  SkillId,
  Submission,
} from '../types';

/** reduce 内部で受け渡す (state, その処理で発生した events) の対。 */
export interface Step {
  state: GameState;
  events: GameEvent[];
}

/** P0 は 3 人固定。座席 index 0/1/2 が p0/p1/p2。 */
export const PLAYER_IDS: readonly PlayerId[] = ['p0', 'p1', 'p2'];
export const PLAYER_NAMES: Record<PlayerId, string> = {
  p0: 'あなた',
  p1: 'レオ',
  p2: 'サラ',
};
export const PLAYER_KINDS: Record<PlayerId, PlayerState['kind']> = {
  p0: 'human',
  p1: 'cpu',
  p2: 'cpu',
};

/** スキルの範囲拡張。偏向=±1、強奪=±2、それ以外=0。 */
export function skillRange(skill: SkillId | null): number {
  if (skill === 'shift') return 1;
  if (skill === 'greed') return 2;
  return 0;
}

/** スキル代。null は 0。 */
export function skillCost(
  config: BalanceConfig,
  skill: SkillId | null
): number {
  return skill ? config.skills[skill].cost : 0;
}

/** 数字プール全体の下限・上限(列範囲の和 = 1..40)。 */
export function numberBounds(
  config: BalanceConfig
): [min: number, max: number] {
  const mins = config.board.columns.map((c) => c[0]);
  const maxs = config.board.columns.map((c) => c[1]);
  return [Math.min(...mins), Math.max(...maxs)];
}

/** トークン保持者(座席 tokenIndex)を先頭とする時計回りの座席順。 */
export function tokenOrder(tokenIndex: number, n: number): number[] {
  return Array.from({ length: n }, (_, k) => (tokenIndex + k) % n);
}

/** candidates のうち tokenOrder 順で最初に見つかる者。競合・タイブレークの権利者決定に使う。 */
export function firstInTokenOrder(
  state: GameState,
  candidates: PlayerId[]
): PlayerId {
  const ids = state.players.map((p) => p.id);
  for (const seat of tokenOrder(state.tokenIndex, state.players.length)) {
    if (candidates.includes(ids[seat])) return ids[seat];
  }
  // 呼び出し側が candidates を非空で渡すため到達しない。
  return candidates[0];
}

/** id の PlayerState だけを差し替えた新しい配列(他は参照を使い回す)。 */
export function updatePlayer(
  players: PlayerState[],
  id: PlayerId,
  fn: (p: PlayerState) => PlayerState
): PlayerState[] {
  return players.map((p) => (p.id === id ? fn(p) : p));
}

export function findSubmission(
  submissions: Submission[],
  id: PlayerId
): Submission | undefined {
  return submissions.find((s) => s.playerId === id);
}
