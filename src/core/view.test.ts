import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { createBoard } from './board';
import type { GameEvent, GameState, PlayerId, PlayerState } from './types';
import { toPublicView, toSecretView } from './view';

/** DEFAULT_CONFIG から最小の GameState を組む(reduce 未実装のため手組み)。 */
function makeState(overrides: Partial<GameState> = {}): GameState {
  const ids: PlayerId[] = ['p0', 'p1', 'p2'];
  const names = ['あなた', 'レオ', 'サラ'];
  const players: PlayerState[] = ids.map((id, i) => {
    const [board] = createBoard(DEFAULT_CONFIG, { seed: 100 + i, counter: 0 });
    return {
      id,
      name: names[i],
      kind: i === 0 ? 'human' : 'cpu',
      board,
      coins: 15,
    };
  });
  return {
    config: DEFAULT_CONFIG,
    rng: { seed: 1, counter: 0 },
    turn: 1,
    phase: 'submitting',
    deck: [11, 22, 33, 5, 17],
    target: 7,
    players,
    tokenIndex: 0,
    reserved: { p0: 0, p1: 0, p2: 0 },
    submissions: [],
    visionPeek: { p0: [], p1: [], p2: [] },
    auctionWinner: null,
    candidates: [],
    log: [],
    result: null,
    ...overrides,
  };
}

describe('toPublicView', () => {
  it('deck の中身ではなく枚数のみを渡す', () => {
    const state = makeState({ deck: [1, 2, 3, 4] });
    const pub = toPublicView(state);
    expect(pub.deckSize).toBe(4);
    expect(pub).not.toHaveProperty('deck');
  });

  it('reserved を各プレイヤーへ射影する', () => {
    const state = makeState({ reserved: { p0: 4, p1: 0, p2: 6 } });
    const pub = toPublicView(state);
    expect(pub.players.map((p) => p.reserved)).toEqual([4, 0, 6]);
  });

  it('config / turn / target / tokenIndex をそのまま渡す', () => {
    const state = makeState({ turn: 5, target: 20, tokenIndex: 2 });
    const pub = toPublicView(state);
    expect(pub.turn).toBe(5);
    expect(pub.target).toBe(20);
    expect(pub.tokenIndex).toBe(2);
    expect(pub.config).toBe(DEFAULT_CONFIG);
  });

  it('players に coins と board を含み、submissions は含めない', () => {
    const pub = toPublicView(makeState());
    expect(pub.players).toHaveLength(3);
    for (const p of pub.players) {
      expect(p.board).toBeDefined();
      expect(typeof p.coins).toBe('number');
      expect(p).not.toHaveProperty('submissions');
      expect(p).not.toHaveProperty('visionPeek');
    }
  });
});

describe('toSecretView', () => {
  it('本人の visionPeek のみを渡す', () => {
    const state = makeState({
      visionPeek: { p0: [11, 22, 33], p1: [7], p2: [] },
    });
    const sec = toSecretView(state, 'p0');
    expect(sec.playerId).toBe('p0');
    expect(sec.visionPeek).toEqual([11, 22, 33]);
  });

  it('予知していないターンは null を返す', () => {
    const state = makeState({ visionPeek: { p0: [], p1: [], p2: [] } });
    expect(toSecretView(state, 'p1').visionPeek).toBeNull();
  });
});

describe('toPublicView.history', () => {
  /** 1 ターン分の開札済みイベント列を組む。 */
  function resolvedTurn(turn: number): GameEvent[] {
    return [
      { type: 'TurnStarted', turn, income: 1, capped: [] },
      { type: 'TargetRevealed', target: 7 * turn },
      { type: 'Submitted', playerId: 'p0', skill: null, bid: 3 },
      { type: 'Submitted', playerId: 'p1', skill: 'greed', bid: 5 },
      { type: 'Submitted', playerId: 'p2', skill: null, bid: 0 },
      { type: 'AuctionResolved', winner: 'p1', bid: 5, tiebreak: false },
      { type: 'NumberChosen', playerId: 'p1', value: 9 },
      { type: 'Marked', value: 9, markedBy: ['p1'] },
    ];
  }

  it('開札済みターンを PublicTurnRecord に再構成する', () => {
    const state = makeState({ log: resolvedTurn(1) });
    const [rec] = toPublicView(state).history;
    expect(rec).toEqual({
      turn: 1,
      target: 7,
      submissions: [
        { playerId: 'p0', skill: null, bid: 3 },
        { playerId: 'p1', skill: 'greed', bid: 5 },
        { playerId: 'p2', skill: null, bid: 0 },
      ],
      winner: 'p1',
      chosen: 9,
    });
  });

  it('複数ターンを順に並べる', () => {
    const state = makeState({
      log: [...resolvedTurn(1), ...resolvedTurn(2)],
    });
    expect(toPublicView(state).history.map((r) => r.turn)).toEqual([1, 2]);
  });

  it('パス(NumberChosen value=null)を chosen=null で表す', () => {
    const log: GameEvent[] = [
      { type: 'TurnStarted', turn: 1, income: 1, capped: [] },
      { type: 'TargetRevealed', target: 7 },
      { type: 'Submitted', playerId: 'p0', skill: null, bid: 2 },
      { type: 'AuctionResolved', winner: 'p0', bid: 2, tiebreak: false },
      { type: 'NumberChosen', playerId: 'p0', value: null },
    ];
    const [rec] = toPublicView(makeState({ log })).history;
    expect(rec.winner).toBe('p0');
    expect(rec.chosen).toBeNull();
  });

  it('開札前(submitting 中)のターンは history に出さない', () => {
    const log: GameEvent[] = [
      ...resolvedTurn(1),
      // 開札前の次ターン: 提出済みだが AuctionResolved なし
      { type: 'TurnStarted', turn: 2, income: 1, capped: [] },
      { type: 'TargetRevealed', target: 14 },
      { type: 'Submitted', playerId: 'p0', skill: 'vision', bid: 4 },
    ];
    const history = toPublicView(makeState({ log })).history;
    expect(history.map((r) => r.turn)).toEqual([1]);
  });
});
