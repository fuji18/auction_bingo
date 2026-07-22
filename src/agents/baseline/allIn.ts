/**
 * baseline「全力入札」: 常に全コインを入札・スキル無し。
 *
 * #9 で「毎ターン全力で競り勝ちにいく戦略」の勝率を測るための対照。
 */

import type { Agent } from '../types';
import { chooseNumber, coinsOf, makeTell, selectVision } from '../shared';

export const allIn: Agent = {
  tendency: '全力入札型。常に全コインを入札・スキル無し。',
  submit(pub, sec) {
    return { skill: null, bid: coinsOf(pub, sec.playerId) };
  },
  chooseNumber,
  selectVision,
  tell(pub, sec) {
    return makeTell(pub, sec, coinsOf(pub, sec.playerId));
  },
};
