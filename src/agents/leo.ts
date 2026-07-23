/**
 * レオ「序盤に積む猪突型」。
 *
 * 序盤に強く入札し、後半は息切れする。読みやすいが「序盤に競り勝つのは高くつく」
 * 圧力をプレイヤーに与える(docs/functional-design.md「4. レオ」)。閾値・係数は
 * constants.ts の LEO に外出しし、#9 で調整する。
 */

import type { Agent } from './types';
import type { PublicView, SecretView, SkillId } from '../core/types';
import { LEO } from './constants';
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

/** turn/maxTurns で序盤 → 終盤へ線形補間した攻撃性。 */
function aggression(turn: number, maxTurns: number): number {
  const t = maxTurns > 0 ? Math.min(1, Math.max(0, turn / maxTurns)) : 0;
  return LEO.aggressionStart + (LEO.aggressionEnd - LEO.aggressionStart) * t;
}

/** レオが選ぶスキル(実行可否の最終ガードは submit で行う)。 */
function chooseSkill(pub: PublicView, sec: SecretView): SkillId | null {
  const board = boardOf(pub, sec.playerId);
  const budget = coinsOf(pub, sec.playerId);
  const d0 = desire(board, pub.target, 0);
  const d1 = desire(board, pub.target, 1);
  const d2 = desire(board, pub.target, 2);
  // 猪突型は範囲拡張スキル(強奪 > 偏向)を好む。候補が最も増える方を積極的に買う。
  // ±2 まで広げて候補が増えるなら強奪。
  if (d2 > d1 && budget >= pub.config.skills.greed.cost + LEO.greedBudgetMargin)
    return 'greed';
  // ±1 で候補が増えるなら偏向。
  if (d1 > d0 && budget >= pub.config.skills.shift.cost) return 'shift';
  // 範囲拡張の余地が無いターンも、リーチが立っていれば予知で仕留めにいく。
  if (
    reachCount(board) > 0 &&
    budget >= pub.config.skills.vision.cost + LEO.visionBudgetMargin
  )
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
  const raw =
    budget * aggression(pub.turn, pub.config.maxTurns) * (0.5 + 0.5 * dR);
  return clampBid(raw, budget - cost);
}

export const leo: Agent = {
  tendency: '序盤に積む猪突型。序盤は強く入札し、後半は息切れする。',
  submit(pub, sec) {
    return { skill: finalSkill(pub, sec), bid: plannedBid(pub, sec) };
  },
  chooseNumber,
  selectVision,
  tell(pub, sec) {
    return makeTell(pub, sec, plannedBid(pub, sec));
  },
};
