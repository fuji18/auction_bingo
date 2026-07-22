/**
 * ゲームの唯一の状態遷移。提出から次ターン開始までを決定的に処理する中核。
 *
 * `reduce` は phase 駆動の状態機械。渡されたアクション列を1件ずつ適用しつつ、
 * 内部の決定的ステップ(予知競合解決・開札・精算・ビンゴ判定・次ターン開始)を
 * 自動で進め、外部入力が必要な地点(提出収集・予知選択・数字選択)で phase を
 * 切り替えて停止する。処理順序は docs/functional-design.md「2. ターン解決」を厳守する。
 *
 * 7ステップの純粋関数は resolve/ に分割している(このファイルは公開 façade)。
 *
 * 不変条件(tests/ で担保):
 * - 同一 (config, seed, actions[]) から常に同一の state・events。
 * - コインは銀行回収・上限切り捨てを除いて増加しない。
 * - 入力 state を破壊しない(全更新は新オブジェクト。変更のない部分は参照を使い回す)。
 */

import type { BalanceConfig } from './config';
import { validateConfig } from './config';
import { createBoard } from './board';
import { shuffle } from './rng';
import type {
  Action,
  ActionSpec,
  GameEvent,
  GameState,
  PlayerId,
  PlayerState,
  SkillId,
} from './types';
import { openAuction } from './resolve/auction';
import { checkEnd } from './resolve/result';
import { applyChoose } from './resolve/settle';
import {
  PLAYER_IDS,
  PLAYER_KINDS,
  PLAYER_NAMES,
  findSubmission,
  numberBounds,
  skillCost,
} from './resolve/shared';
import { applySubmit, resolveAfterSubmit } from './resolve/submit';
import { startTurn } from './resolve/turn';
import { applySelectVision } from './resolve/vision';

/**
 * createGame: config 検証・盤面/山札生成・ターン1のステップ0まで進めた初期 state を返す。
 */
export function createGame(config: BalanceConfig, seed: number): GameState {
  validateConfig(config);

  let rng = { seed, counter: 0 };
  const players: PlayerState[] = PLAYER_IDS.map((id) => {
    const [board, next] = createBoard(config, rng);
    rng = next;
    return {
      id,
      name: PLAYER_NAMES[id],
      kind: PLAYER_KINDS[id],
      board,
      coins: config.economy.initialCoins,
    };
  });

  const [min, max] = numberBounds(config);
  const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const [deck, deckRng] = shuffle(rng, pool);
  rng = deckRng;

  const base: GameState = {
    config,
    rng,
    turn: 0,
    phase: 'submitting',
    deck,
    target: 0,
    players,
    // 初回 startTurn で (tokenIndex+1)%n = 0 になり、ターン1のトークンは p0。
    tokenIndex: config.playerCount - 1,
    reserved: { p0: 0, p1: 0, p2: 0 },
    submissions: [],
    visionPeek: { p0: [], p1: [], p2: [] },
    auctionWinner: null,
    candidates: [],
    log: [],
    result: null,
  };

  const started = startTurn(base, false);
  return { ...started.state, log: started.events };
}

/**
 * 1 アクションを現 phase に応じて適用し、決定的ステップを自動進行させる。
 * 現 phase と一致しない/不正なアクションは state を変えず events も残さない。
 */
function applyAction(
  state: GameState,
  action: Action
): { state: GameState; events: GameEvent[] } {
  let s = state;
  let events: GameEvent[];

  if (state.phase === 'submitting' && action.type === 'SUBMIT') {
    const r = applySubmit(s, action);
    s = r.state;
    events = r.events;
    if (events.length > 0 && s.submissions.length === s.players.length) {
      const r2 = resolveAfterSubmit(s);
      s = r2.state;
      events = [...events, ...r2.events];
    }
  } else if (state.phase === 'vision' && action.type === 'SELECT_VISION') {
    const r = applySelectVision(s, action);
    if (!r) return { state, events: [] };
    s = r.state;
    events = r.events;
    const r2 = openAuction(s);
    s = r2.state;
    events = [...events, ...r2.events];
  } else if (state.phase === 'choosing' && action.type === 'CHOOSE') {
    const r = applyChoose(s, action);
    if (!r) return { state, events: [] };
    s = r.state;
    events = r.events;
    const r2 = checkEnd(s);
    s = r2.state;
    events = [...events, ...r2.events];
  } else {
    return { state, events: [] };
  }

  if (events.length === 0) return { state, events: [] };
  return { state: { ...s, log: [...s.log, ...events] }, events };
}

/**
 * ゲームの唯一の状態遷移。アクション列を順に適用し、発生した events を返す。
 * 入力 state は破壊しない。
 */
export function reduce(
  state: GameState,
  actions: Action[]
): { state: GameState; events: GameEvent[] } {
  let cur = state;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const step = applyAction(cur, action);
    cur = step.state;
    events.push(...step.events);
  }
  return { state: cur, events };
}

/**
 * 現 phase・プレイヤーで取り得る合法アクションの範囲(UI の入力ガード用)。
 * 手番でないプレイヤーには空の範囲を返す。
 */
export function legalActions(state: GameState, playerId: PlayerId): ActionSpec {
  if (state.phase === 'finished') return { phase: 'finished' };

  if (state.phase === 'submitting') {
    const player = state.players.find((p) => p.id === playerId);
    const already = !!findSubmission(state.submissions, playerId);
    const options: { skill: SkillId | null; maxBid: number }[] = [];
    if (player && !already) {
      const skills: (SkillId | null)[] = [null, 'shift', 'vision', 'greed'];
      for (const skill of skills) {
        const cost = skillCost(state.config, skill);
        if (cost <= player.coins)
          options.push({ skill, maxBid: player.coins - cost });
      }
    }
    return { phase: 'submitting', playerId, options };
  }

  if (state.phase === 'vision') {
    const peeked = state.visionPeek[playerId] ?? [];
    return { phase: 'vision', playerId, peeked };
  }

  // choosing
  const candidates = state.auctionWinner === playerId ? state.candidates : [];
  return { phase: 'choosing', playerId, candidates, canPass: true };
}
