/**
 * ステップ7: ビンゴ判定 + タイブレーク。決着なら GameFinished、継続なら次ターン開始。
 */

import { completedLines, markCount, reachCount } from '../board';
import type {
  GameResult,
  GameState,
  PlayerId,
  PlayerState,
  Standing,
} from '../types';
import type { Step } from './shared';
import { startTurn } from './turn';

/** 各プレイヤーの順位指標。 */
function toStanding(p: PlayerState): Standing {
  return {
    playerId: p.id,
    reachCount: reachCount(p.board),
    markCount: markCount(p.board),
    coins: p.coins,
    lines: completedLines(p.board),
  };
}

/** タイブレーク: reachCount→markCount→coins で絞り込み、単独が出た指標を decidedBy にする。 */
function tiebreak(players: PlayerState[]): {
  winners: PlayerId[];
  decidedBy: GameResult['decidedBy'];
} {
  const criteria: [GameResult['decidedBy'], (p: PlayerState) => number][] = [
    ['reachCount', (p) => reachCount(p.board)],
    ['markCount', (p) => markCount(p.board)],
    ['coins', (p) => p.coins],
  ];
  let pool = players;
  for (const [name, metric] of criteria) {
    const best = Math.max(...pool.map(metric));
    const top = pool.filter((p) => metric(p) === best);
    if (top.length === 1) {
      return { winners: [top[0].id], decidedBy: name };
    }
    pool = top;
  }
  return { winners: pool.map((p) => p.id), decidedBy: 'none' };
}

export function checkEnd(state: GameState): Step {
  const achievers = state.players.filter((p) => completedLines(p.board) >= 1);
  const standings = state.players.map(toStanding).sort((a, b) => {
    return (
      b.lines - a.lines ||
      b.reachCount - a.reachCount ||
      b.markCount - a.markCount ||
      b.coins - a.coins
    );
  });

  let result: GameResult | null = null;

  if (achievers.length >= 1) {
    result = {
      kind: achievers.length === 1 ? 'bingo' : 'draw-bingo',
      winners: achievers.map((p) => p.id),
      decidedBy: 'bingo',
      turn: state.turn,
      standings,
    };
  } else if (state.turn >= state.config.maxTurns) {
    const tb = tiebreak(state.players);
    result = {
      kind: tb.winners.length === 1 ? 'timeup' : 'draw-timeup',
      winners: tb.winners,
      decidedBy: tb.decidedBy,
      turn: state.turn,
      standings,
    };
  }

  if (result) {
    const next: GameState = { ...state, phase: 'finished', result };
    return { state: next, events: [{ type: 'GameFinished', result }] };
  }

  return startTurn(state, true);
}
