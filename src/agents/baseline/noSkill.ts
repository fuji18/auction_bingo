/**
 * baseline「スキル不買」: スキルを一切買わず、入札のみで戦う。
 *
 * #9 で「スキルの価値」を測るための対照(スキルを使う CPU との勝率差を見る)。
 * 入札は desire に応じて強弱をつけるが、種類選択は常に null。
 */

import type { Agent } from '../types';
import { NOSKILL } from '../constants';
import {
  boardOf,
  chooseNumber,
  clampBid,
  coinsOf,
  desire,
  makeTell,
  selectVision,
} from '../shared';
import type { PublicView, SecretView } from '../../core/types';

function plannedBid(pub: PublicView, sec: SecretView): number {
  const board = boardOf(pub, sec.playerId);
  const budget = coinsOf(pub, sec.playerId);
  const ratio =
    desire(board, pub.target, 0) > 0
      ? NOSKILL.activeBidRatio
      : NOSKILL.idleBidRatio;
  return clampBid(budget * ratio, budget);
}

export const noSkill: Agent = {
  submit(pub, sec) {
    return { skill: null, bid: plannedBid(pub, sec) };
  },
  chooseNumber,
  selectVision,
  tell(pub, sec) {
    return makeTell(pub, sec, plannedBid(pub, sec));
  },
};
