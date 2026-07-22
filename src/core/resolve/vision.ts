/**
 * ステップ2続き: 予知の選択。kept を検証し、山札を再構成、cost を即時徴収する。
 */

import { shuffle } from '../rng';
import type { Action, GameState } from '../types';
import { updatePlayer } from './shared';
import type { Step } from './shared';

/** 不正(peeked に無い keep・予知成功者でない)なら no-op(null)。 */
export function applySelectVision(
  state: GameState,
  action: Extract<Action, { type: 'SELECT_VISION' }>
): Step | null {
  const peeked = state.visionPeek[action.playerId];
  if (!peeked || peeked.length === 0) return null;
  if (!peeked.includes(action.keep)) return null;

  // deck = [kept, ...shuffle(deck から peeked を除いたもの + peeked の残り)]
  const rest = [
    ...state.deck.slice(peeked.length),
    ...peeked.filter((v) => v !== action.keep),
  ];
  const [shuffled, rng] = shuffle(state.rng, rest);
  const deck = [action.keep, ...shuffled];

  const cost = state.config.skills.vision.cost;
  const players = updatePlayer(state.players, action.playerId, (p) => ({
    ...p,
    coins: p.coins - cost,
  }));

  const next: GameState = {
    ...state,
    deck,
    rng,
    players,
    reserved: { ...state.reserved, [action.playerId]: 0 },
    visionPeek: { ...state.visionPeek, [action.playerId]: [] },
  };

  return {
    state: next,
    events: [
      {
        type: 'VisionResolved',
        playerId: action.playerId,
        peeked,
        kept: action.keep,
      },
    ],
  };
}
