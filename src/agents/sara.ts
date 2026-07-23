/**
 * サラ「追随して差し込む型」。
 *
 * 直前ターンの落札額に少し上乗せして刺す。プレイヤーが高値で落札し続けると釣られて
 * 上がり、価格を吊り上げる役割(docs/functional-design.md「4. サラ」)。閾値・係数は
 * constants.ts の SARA に外出しし、#9 で調整する。
 */

import type { Agent } from './types';
import type { PublicView, SecretView, SkillId } from '../core/types';
import { SARA } from './constants';
import {
  boardOf,
  chooseNumber,
  clampBid,
  coinsOf,
  desire,
  makeTell,
  reachCount,
  selectVision,
  skillCostOf,
  skillRangeOf,
} from './shared';

/** 直前に解決したターンの落札額。履歴が無ければ null。 */
function lastWinningBid(pub: PublicView): number | null {
  const last = pub.history[pub.history.length - 1];
  if (!last || last.winner === null) return null;
  const winnerSub = last.submissions.find((s) => s.playerId === last.winner);
  return winnerSub ? winnerSub.bid : null;
}

/** サラが選ぶスキル(実行可否の最終ガードは submit で行う)。 */
function chooseSkill(pub: PublicView, sec: SecretView): SkillId | null {
  const board = boardOf(pub, sec.playerId);
  const budget = coinsOf(pub, sec.playerId);
  // 追随型は予知を好む(山札を仕込んで差し込む決め手)が、範囲拡張も使う。
  // リーチが立ったら予知で仕留めにいく。
  if (
    reachCount(board) > 0 &&
    budget >= pub.config.skills.vision.cost + SARA.visionBudgetMargin
  )
    return 'vision';
  const d0 = desire(board, pub.target, 0);
  const d1 = desire(board, pub.target, 1);
  // ±1 で候補が増えるなら偏向で差し込み先を作る。
  if (d1 > d0 && budget >= pub.config.skills.shift.cost) return 'shift';
  // 差し込み先が無いターンも、予算に余裕があれば予知で山札を仕込む(予知に寄せる)。
  if (budget >= pub.config.skills.vision.cost + SARA.visionBudgetMargin)
    return 'vision';
  return null;
}

/** 買えないスキルは null に落とした最終スキル。submit / plannedBid / tell で共有する。 */
function finalSkill(pub: PublicView, sec: SecretView): SkillId | null {
  const skill = chooseSkill(pub, sec);
  return skillCostOf(pub.config, skill) > coinsOf(pub, sec.playerId)
    ? null
    : skill;
}

/** 予定入札額(clamp 済み)。tell と submit で同じ値を使う。 */
function plannedBid(pub: PublicView, sec: SecretView): number {
  const board = boardOf(pub, sec.playerId);
  const budget = coinsOf(pub, sec.playerId);
  const skill = finalSkill(pub, sec);
  const cost = skillCostOf(pub.config, skill);
  const range = skillRangeOf(skill);
  const dR = desire(board, pub.target, range);

  const prev =
    lastWinningBid(pub) ??
    Math.round(pub.config.economy.initialCoins * SARA.firstTurnBidRatio);
  const base = prev + 1;
  const raw = dR > 0 ? Math.min(base, budget - cost) : base * SARA.passBidRatio;
  return clampBid(raw, budget - cost);
}

export const sara: Agent = {
  tendency: '追随して差し込む型。直前の落札額に少し上乗せして刺す。',
  submit(pub, sec) {
    return { skill: finalSkill(pub, sec), bid: plannedBid(pub, sec) };
  },
  chooseNumber,
  selectVision,
  tell(pub, sec) {
    return makeTell(pub, sec, plannedBid(pub, sec));
  },
};
