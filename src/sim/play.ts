/**
 * 対局ドライバ: スロット別 Agent・config・seed で 1 ゲームを finished まで進める。
 *
 * `testkit.playGame`(agents のテスト用)の本番版。UI を介さず `core/` を直接叩き、
 * Agent には `PublicView`/`SecretView` のみを渡す(非公開情報を参照させない)。
 * 最終 `GameState` の `state.log`(全イベント)と `state.result` を metrics が集計する。
 */

import type { BalanceConfig } from '../core/config';
import { createGame, reduce } from '../core/reduce';
import type { GameState, PlayerId } from '../core/types';
import { toPublicView, toSecretView } from '../core/view';
import type { Agent } from '../agents/types';

/** 手番なしの不正手で reduce が no-op を返し続けたときの無限ループ保険。 */
const MAX_STEPS = 100_000;

/**
 * 1 ゲームを最後まで進めて最終 state を返す。
 * Agent が不正手を返して phase が進まない場合は seed 付きで throw する(バグの表面化)。
 */
export function playOne(
  agents: Record<PlayerId, Agent>,
  config: BalanceConfig,
  seed: number
): GameState {
  let state = createGame(config, seed);
  let steps = 0;

  while (state.phase !== 'finished') {
    if (steps++ > MAX_STEPS) {
      throw new Error(
        `対局が ${MAX_STEPS} ステップ以内に決着しませんでした(seed=${seed}, phase=${state.phase})`
      );
    }

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
      // choosing
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
