/**
 * ステップ1: 提出の検証と記録。ステップ2: 全員提出後の予知競合解決。
 */

import type {
  Action,
  GameEvent,
  GameState,
  PlayerId,
  Submission,
} from '../types';
import { openAuction } from './auction';
import { findSubmission, firstInTokenOrder, skillCost } from './shared';
import type { Step } from './shared';

/**
 * ステップ1: 提出の検証と記録。不正(コスト超過・負入札・予約超過)は no-op。
 */
export function applySubmit(
  state: GameState,
  action: Extract<Action, { type: 'SUBMIT' }>
): Step {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { state, events: [] };
  if (findSubmission(state.submissions, action.playerId)) {
    return { state, events: [] }; // 二重提出は拒否
  }

  const cost = skillCost(state.config, action.skill);
  if (cost > player.coins) return { state, events: [] };
  if (action.bid < 0) return { state, events: [] };
  if (action.bid > player.coins - cost) return { state, events: [] };
  if (!Number.isInteger(action.bid)) return { state, events: [] };

  const submission: Submission = {
    playerId: action.playerId,
    skill: action.skill,
    bid: action.bid,
  };
  const next: GameState = {
    ...state,
    submissions: [...state.submissions, submission],
    reserved: { ...state.reserved, [action.playerId]: cost },
  };
  return {
    state: next,
    events: [
      {
        type: 'Submitted',
        playerId: action.playerId,
        skill: action.skill,
        bid: action.bid,
      },
    ],
  };
}

/**
 * ステップ2: 全員提出後の予知競合解決。予知成功者がいれば phase=vision で停止、
 * いなければ開札(openAuction)まで進める。
 */
export function resolveAfterSubmit(state: GameState): Step {
  const buyers = state.submissions
    .filter((s) => s.skill === 'vision')
    .map((s) => s.playerId);

  const events: GameEvent[] = [];
  let s = state;
  let visionWinner: PlayerId | null = null;

  if (buyers.length === 1) {
    visionWinner = buyers[0];
  } else if (buyers.length >= 2) {
    visionWinner = firstInTokenOrder(s, buyers);
    const refunded = buyers.filter((id) => id !== visionWinner);
    const cost = state.config.skills.vision.cost;
    const reserved = { ...s.reserved };
    for (const id of refunded) reserved[id] = 0;
    s = { ...s, reserved };
    events.push({
      type: 'VisionConflict',
      buyers,
      winner: visionWinner,
      refunded,
    });
    for (const id of refunded) {
      events.push({
        type: 'SkillRefunded',
        playerId: id,
        amount: cost,
        reason: 'vision-conflict',
      });
    }
  }

  if (visionWinner !== null) {
    const peek = state.config.skills.vision.peek;
    const peeked = s.deck.slice(0, Math.min(peek, s.deck.length));
    // 山札が空だと覗く対象が無く、applySelectVision が受理できず vision フェーズで
    // スタックする。DEFAULT_CONFIG(maxTurns×1枚消費 < プール40枚)では deck が
    // 空になる前に決着するため到達しないが、config 調整時のデッドロックを避けるため
    // peeked が空なら予知は不発として開札へ進める(効果は次ターンにしか出ないため
    // 今ターンの進行に影響しない)。
    if (peeked.length > 0) {
      const next: GameState = {
        ...s,
        phase: 'vision',
        visionPeek: { ...s.visionPeek, [visionWinner]: peeked },
      };
      return { state: next, events };
    }
  }

  const auction = openAuction(s);
  return { state: auction.state, events: [...events, ...auction.events] };
}
