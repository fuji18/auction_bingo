/**
 * ステップ5・6: 数字選択・マーク・精算。
 */

import { markNumber } from '../board';
import type { Action, GameEvent, GameState, PlayerId } from '../types';
import { findSubmission } from './shared';
import type { Step } from './shared';

/** 不正(落札者でない・候補外の value)なら no-op(null)。 */
export function applyChoose(
  state: GameState,
  action: Extract<Action, { type: 'CHOOSE' }>
): Step | null {
  if (action.playerId !== state.auctionWinner) return null;
  if (action.value !== null && !state.candidates.includes(action.value))
    return null;

  const events: GameEvent[] = [
    { type: 'NumberChosen', playerId: action.playerId, value: action.value },
  ];

  // ステップ5: マーク(保持者全員)。
  let players = state.players;
  if (action.value !== null) {
    const value = action.value;
    const markedBy: PlayerId[] = [];
    players = players.map((p) => {
      const has = p.board.some((col) =>
        col.some((cell) => cell.value === value)
      );
      if (has) {
        markedBy.push(p.id);
        return { ...p, board: markNumber(p.board, value) };
      }
      return p;
    });
    events.push({ type: 'Marked', value, markedBy });
  }

  // ステップ6: 精算。
  const winner = state.auctionWinner;
  const winnerSub = findSubmission(state.submissions, winner);
  const paid = winnerSub?.bid ?? 0;
  const winnerSkill = winnerSub?.skill ?? null;
  const { distributionDivisor, coinCap } = state.config.economy;
  const perLoser = Math.floor(paid / distributionDivisor);

  const received: Record<PlayerId, number> = { p0: 0, p1: 0, p2: 0 };
  const refundEvents: GameEvent[] = [];
  let distributed = 0;

  players = players.map((p) => {
    if (p.id === winner) {
      // 落札額 + 落札時のみ shift/greed cost を徴収(vision は既に徴収済み)。
      let coins = p.coins - paid;
      if (winnerSkill === 'shift' || winnerSkill === 'greed') {
        coins -= state.config.skills[winnerSkill].cost;
      }
      return { ...p, coins };
    }
    // 敗者: floor(paid/divisor) を受領(coinCap クランプ)。実受領を記録する。
    const gained = Math.min(p.coins + perLoser, coinCap) - p.coins;
    received[p.id] = gained;
    distributed += gained;
    const sub = findSubmission(state.submissions, p.id);
    if (sub && (sub.skill === 'shift' || sub.skill === 'greed')) {
      // 落札できなかった shift/greed の予約を解除して返金(コインは未徴収なので予約解除のみ)。
      refundEvents.push({
        type: 'SkillRefunded',
        playerId: p.id,
        amount: state.config.skills[sub.skill].cost,
        reason: 'lost-auction',
      });
    }
    return gained > 0 ? { ...p, coins: p.coins + gained } : p;
  });

  const toBank = paid - distributed;

  const next: GameState = {
    ...state,
    players,
    reserved: { p0: 0, p1: 0, p2: 0 },
  };

  events.push({ type: 'Settled', payer: winner, paid, received, toBank });
  events.push(...refundEvents);

  return { state: next, events };
}
