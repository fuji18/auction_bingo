/**
 * テスト専用のビルダ(agents のテストからのみ import する)。dist には含まれない
 * (main.ts から到達しないため)。ここで公開ビュー・盤面・完全対局ドライバを組み立てる。
 */

import { createGame, reduce } from '../core/reduce';
import { toPublicView, toSecretView } from '../core/view';
import { DEFAULT_CONFIG } from '../core/config';
import type {
  Board,
  Cell,
  GameState,
  PlayerId,
  PublicView,
  SecretView,
} from '../core/types';
import type { Agent } from './types';

/** value(=col*5+row+1)を持つ 5x5 の未マーク盤面。中央は FREE(marked)。 */
export function emptyBoard(): Board {
  const b: Board = [];
  for (let c = 0; c < 5; c++) {
    const col: Cell[] = [];
    for (let r = 0; r < 5; r++) {
      if (c === 2 && r === 2) col.push({ value: 'FREE', marked: true });
      else col.push({ value: c * 5 + r + 1, marked: false });
    }
    b.push(col);
  }
  return b;
}

/** [col,row] のセルを marked にした新しい盤面。 */
export function mark(board: Board, coords: [number, number][]): Board {
  const next = board.map((col) => col.map((cell) => ({ ...cell })));
  for (const [c, r] of coords) next[c][r].marked = true;
  return next;
}

const NAMES = ['あなた', 'レオ', 'サラ'] as const;

/** 3 プレイヤーの盤面から最小の PublicView を組む。 */
export function pubWith(
  boards: Record<PlayerId, Board>,
  overrides: Partial<PublicView> = {}
): PublicView {
  const ids: PlayerId[] = ['p0', 'p1', 'p2'];
  return {
    config: DEFAULT_CONFIG,
    turn: 3,
    target: 3,
    deckSize: 20,
    tokenIndex: 0,
    players: ids.map((id, i) => ({
      id,
      name: NAMES[i],
      board: boards[id],
      coins: 15,
      reserved: 0,
    })),
    history: [],
    ...overrides,
  };
}

/** 予知なしの SecretView。 */
export function secOf(
  playerId: PlayerId,
  visionPeek: number[] | null = null
): SecretView {
  return { playerId, visionPeek };
}

/**
 * agents で 1 ゲームを最後まで進めるドライバ(#9 の sim が行うことの最小版)。
 * agents が不正手を返すと reduce が no-op になり phase が進まないため、finished 到達を
 * 検証することでレガリティを担保できる。
 */
export function playGame(
  agents: Record<PlayerId, Agent>,
  seed: number
): GameState {
  let state = createGame(DEFAULT_CONFIG, seed);
  let guard = 0;
  while (state.phase !== 'finished' && guard++ < 10000) {
    if (state.phase === 'submitting') {
      const submitted = new Set(state.submissions.map((s) => s.playerId));
      const pid = state.players
        .map((p) => p.id)
        .find((id) => !submitted.has(id))!;
      const { skill, bid } = agents[pid].submit(
        toPublicView(state),
        toSecretView(state, pid)
      );
      state = reduce(state, [
        { type: 'SUBMIT', playerId: pid, skill, bid },
      ]).state;
    } else if (state.phase === 'vision') {
      const pid = state.players
        .map((p) => p.id)
        .find((id) => (state.visionPeek[id]?.length ?? 0) > 0)!;
      const keep = agents[pid].selectVision(
        toPublicView(state),
        toSecretView(state, pid),
        state.visionPeek[pid]
      );
      state = reduce(state, [
        { type: 'SELECT_VISION', playerId: pid, keep },
      ]).state;
    } else {
      const pid = state.auctionWinner!;
      const value = agents[pid].chooseNumber(
        toPublicView(state),
        toSecretView(state, pid),
        state.candidates
      );
      state = reduce(state, [{ type: 'CHOOSE', playerId: pid, value }]).state;
    }
  }
  return state;
}
