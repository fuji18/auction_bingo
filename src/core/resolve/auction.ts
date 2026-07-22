/**
 * ステップ3・4: 開札と落札者決定、候補算出。phase=choosing で停止する。
 */

import type { GameState, PlayerId } from '../types';
import {
  findSubmission,
  firstInTokenOrder,
  numberBounds,
  skillRange,
} from './shared';
import type { Step } from './shared';

export function openAuction(state: GameState): Step {
  const maxBid = Math.max(...state.submissions.map((s) => s.bid));
  const top = state.submissions
    .filter((s) => s.bid === maxBid)
    .map((s) => s.playerId);

  let winner: PlayerId;
  let tiebreak: boolean;
  if (top.length === 1) {
    winner = top[0];
    tiebreak = false;
  } else {
    winner = firstInTokenOrder(state, top);
    tiebreak = true;
  }

  const winnerSub = findSubmission(state.submissions, winner);
  const range = skillRange(winnerSub?.skill ?? null);
  const [min, max] = numberBounds(state.config);
  const candidates: number[] = [];
  for (let v = state.target - range; v <= state.target + range; v++) {
    if (v >= min && v <= max) candidates.push(v);
  }

  const next: GameState = {
    ...state,
    phase: 'choosing',
    auctionWinner: winner,
    candidates,
  };

  return {
    state: next,
    events: [{ type: 'AuctionResolved', winner, bid: maxBid, tiebreak }],
  };
}
