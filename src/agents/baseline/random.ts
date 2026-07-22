/**
 * baseline「ランダム」: 合法な範囲でスキル・入札・数字選択・予知をランダムに選ぶ。
 *
 * #9 の下限対照(無戦略)。Math.random は禁止のため、公開状態から派生させた RngState を
 * core/rng で消費する(deriveRng)。同一 state からは同一挙動になり、リプレイと矛盾しない。
 */

import { nextInt } from '../../core/rng';
import type { PublicView, RngState, SkillId } from '../../core/types';
import type { Agent } from '../types';
import { TELLS, coinsOf, deriveRng, SALT, skillCostOf } from '../shared';

/** その手番で買えるスキル(コストが手持ち以下)+ 無し。 */
function feasibleSkills(pub: PublicView, coins: number): (SkillId | null)[] {
  const skills: (SkillId | null)[] = [null, 'shift', 'vision', 'greed'];
  return skills.filter((s) => skillCostOf(pub.config, s) <= coins);
}

/** rng を順に消費して配列から 1 つ選ぶ。 */
function pick<T>(rng: RngState, items: readonly T[]): [T, RngState] {
  const [i, next] = nextInt(rng, items.length);
  return [items[i], next];
}

export const random: Agent = {
  tendency: 'ランダム型。合法な範囲でスキル・入札・数字選択を無作為に選ぶ。',
  submit(pub, sec) {
    const coins = coinsOf(pub, sec.playerId);
    const options = feasibleSkills(pub, coins);
    const [skill, rng] = pick(
      deriveRng(pub, sec.playerId, SALT.skill),
      options
    );
    const maxBid = coins - skillCostOf(pub.config, skill);
    const [bid] = nextInt(rng, maxBid + 1);
    return { skill, bid };
  },
  chooseNumber(pub, sec, candidates) {
    const options: (number | null)[] = [...candidates, null];
    const [choice] = pick(deriveRng(pub, sec.playerId, SALT.choose), options);
    return choice;
  },
  selectVision(pub, sec, peeked) {
    const [choice] = pick(deriveRng(pub, sec.playerId, SALT.vision), peeked);
    return choice;
  },
  tell(pub, sec) {
    const [choice] = pick(deriveRng(pub, sec.playerId, SALT.tell), TELLS);
    return choice;
  },
};
