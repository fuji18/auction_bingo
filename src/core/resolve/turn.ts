/**
 * ステップ0: ターン開始。income 加算・coinCap 切り捨て・トークン回転・target 公開。
 */

import type { GameState, PlayerId } from '../types';
import type { Step } from './shared';

/**
 * createGame(初回)と checkEnd(継続)の両方から呼ぶ。log は呼び出し側が events を積む。
 *
 * income は「前ターンの解決直後」に支給されるため、前ターンを持たない初回(turn 1)は
 * 支給しない(grantIncome=false)。プレイヤーはターン1を initialCoins ちょうどで始める
 * (docs/product-requirements.md「初期コイン 15枚 で開始し、毎ターン開始時に 1枚 支給」)。
 */
export function startTurn(state: GameState, grantIncome: boolean): Step {
  const { incomePerTurn, coinCap } = state.config.economy;
  const income = grantIncome ? incomePerTurn : 0;
  const capped: PlayerId[] = [];
  const players = state.players.map((p) => {
    const raw = p.coins + income;
    if (raw > coinCap) {
      capped.push(p.id);
      return { ...p, coins: coinCap };
    }
    return { ...p, coins: raw };
  });

  const n = state.players.length;
  const tokenIndex = (state.tokenIndex + 1) % n;
  const target = state.deck[0];
  const deck = state.deck.slice(1);

  const emptyReserved = { p0: 0, p1: 0, p2: 0 } as Record<PlayerId, number>;
  const emptyPeek = { p0: [], p1: [], p2: [] } as Record<PlayerId, number[]>;

  const next: GameState = {
    ...state,
    players,
    turn: state.turn + 1,
    phase: 'submitting',
    tokenIndex,
    target,
    deck,
    reserved: emptyReserved,
    submissions: [],
    visionPeek: emptyPeek,
    auctionWinner: null,
    candidates: [],
  };

  return {
    state: next,
    events: [
      { type: 'TurnStarted', turn: next.turn, income, capped },
      { type: 'TargetRevealed', target },
    ],
  };
}
