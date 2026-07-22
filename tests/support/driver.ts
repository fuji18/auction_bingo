/**
 * テスト用の決定的なゲーム進行ドライバ。
 *
 * agents/ はまだ無い(#8)ため、ここでは公開情報のみから決まる単純な決定的方針で
 * フルゲームを最後まで進める。方針は (turn, seat) の剰余だけで決まり乱数を使わないため、
 * 同一 (config, seed) からは常に同一の行動列・state・events が得られる。
 * determinism / coinConservation / saveRestore の各統合テストが共有する。
 */

import type { BalanceConfig } from '../../src/core/config';
import { createGame, legalActions, reduce } from '../../src/core/reduce';
import type {
  Action,
  Board,
  GameEvent,
  GameState,
  PlayerId,
  SkillId,
} from '../../src/core/types';

export interface PlayResult {
  finalState: GameState;
  events: GameEvent[];
  actions: Action[];
}

function seatOf(state: GameState, id: PlayerId): number {
  return state.players.findIndex((p) => p.id === id);
}

/** value を盤面に持つ未マークのセルがあるか。 */
function holdsUnmarked(board: Board, value: number): boolean {
  return board.some((col) =>
    col.some((cell) => cell.value === value && !cell.marked)
  );
}

function chooseSubmit(state: GameState, id: PlayerId): Action {
  const spec = legalActions(state, id);
  if (spec.phase !== 'submitting') throw new Error('phase mismatch');
  const seat = seatOf(state, id);
  const pick = (state.turn + seat) % 5;
  const want: SkillId | null =
    pick === 2 ? 'shift' : pick === 3 ? 'vision' : pick === 4 ? 'greed' : null;
  const opt =
    spec.options.find((o) => o.skill === want) ??
    spec.options.find((o) => o.skill === null)!;
  const baseBid = (state.turn * 2 + seat) % 6;
  const bid = Math.min(baseBid, opt.maxBid);
  return { type: 'SUBMIT', playerId: id, skill: opt.skill, bid };
}

function chooseKeep(state: GameState, id: PlayerId): number {
  const peeked = state.visionPeek[id];
  const board = state.players.find((p) => p.id === id)!.board;
  return peeked.find((v) => holdsUnmarked(board, v)) ?? peeked[0];
}

function chooseValue(state: GameState, id: PlayerId): number | null {
  const cands = state.candidates;
  if (cands.length === 0) return null;
  const board = state.players.find((p) => p.id === id)!.board;
  const held = cands.find((v) => holdsUnmarked(board, v));
  if (held !== undefined) return held;
  // ときどきパスして「落札者は支払うがマークしない」経路も通す。
  if ((state.turn + cands[0]) % 11 === 0) return null;
  return cands[0];
}

/** 予知成功者(visionPeek が非空のプレイヤー)。 */
function visionWinnerOf(state: GameState): PlayerId {
  const found = state.players.find((p) => state.visionPeek[p.id].length > 0);
  if (!found) throw new Error('no vision winner in vision phase');
  return found.id;
}

/** 決定的方針でフルゲームを最後まで進める。 */
export function playGame(
  config: BalanceConfig,
  seed: number,
  maxSteps = 100000
): PlayResult {
  let state = createGame(config, seed);
  const events: GameEvent[] = [];
  const actions: Action[] = [];

  let guard = 0;
  while (state.phase !== 'finished') {
    if (guard++ > maxSteps) throw new Error('game did not terminate');

    let action: Action;
    if (state.phase === 'submitting') {
      const next = state.players.find(
        (p) => !state.submissions.some((s) => s.playerId === p.id)
      );
      if (!next) throw new Error('submitting phase but everyone submitted');
      action = chooseSubmit(state, next.id);
    } else if (state.phase === 'vision') {
      const winner = visionWinnerOf(state);
      action = {
        type: 'SELECT_VISION',
        playerId: winner,
        keep: chooseKeep(state, winner),
      };
    } else {
      const winner = state.auctionWinner!;
      action = {
        type: 'CHOOSE',
        playerId: winner,
        value: chooseValue(state, winner),
      };
    }

    const r = reduce(state, [action]);
    state = r.state;
    events.push(...r.events);
    actions.push(action);
  }

  return { finalState: state, events, actions };
}
