/**
 * baseline「貯め込み」: 決して積まず、常に入札 0・スキル無し。
 *
 * #9 で「入札しない戦略」の勝率を測るための対照。数字選択・予知は共有ロジックを使い、
 * 戦略差を submit(入札しない)に限定する。
 */

import type { Agent } from '../types';
import { chooseNumber, makeTell, selectVision } from '../shared';

export const hoarder: Agent = {
  tendency: '貯め込み型。決して積まず、常に入札 0・スキル無し。',
  submit() {
    return { skill: null, bid: 0 };
  },
  chooseNumber,
  selectVision,
  tell(pub, sec) {
    return makeTell(pub, sec, 0);
  },
};
