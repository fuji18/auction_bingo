import { describe, it, expect } from 'vitest';
import { sara } from './sara';
import type { PublicTurnRecord } from '../core/types';
import { emptyBoard, mark, pubWith, secOf } from './testkit';

const boards = () => ({
  p0: emptyBoard(),
  p1: emptyBoard(),
  p2: emptyBoard(),
});

/** 落札額 bid の解決済み履歴 1 件。 */
function historyWithBid(bid: number): PublicTurnRecord[] {
  return [
    {
      turn: 2,
      target: 10,
      submissions: [{ playerId: 'p1', skill: null, bid }],
      winner: 'p1',
      chosen: 10,
    },
  ];
}

describe('sara.submit スキル選択', () => {
  it('リーチあり かつ予算十分なら vision', () => {
    // col0 rows0..3 をマーク → 縦ラインが 4 マーク(リーチ)。
    const reachBoard = mark(emptyBoard(), [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
    const pub = pubWith(
      { p0: reachBoard, p1: emptyBoard(), p2: emptyBoard() },
      { target: 30 }
    );
    expect(sara.submit(pub, secOf('p0')).skill).toBe('vision');
  });
});

describe('sara.submit 追随入札', () => {
  it('直前落札額 + 1 を基準に、desire>0 なら min(base, budget)', () => {
    const pub = pubWith(boards(), { target: 3, history: historyWithBid(6) });
    pub.players[0].coins = 10; // greed 閾値(12)未満 → skill null
    const { skill, bid } = sara.submit(pub, secOf('p0'));
    expect(skill).toBeNull();
    expect(bid).toBe(7); // min(6+1, 10)
  });

  it('履歴が無い初ターンは initialCoins × 0.2 を基準にする', () => {
    const pub = pubWith(boards(), { target: 3 }); // history 空
    pub.players[0].coins = 10;
    // base = round(15 × 0.2) + 1 = 4、desire(3,0)=1>0 → min(4,10)=4
    expect(sara.submit(pub, secOf('p0')).bid).toBe(4);
  });

  it('bid は常に整数で予約超過しない', () => {
    const pub = pubWith(boards(), { target: 3, history: historyWithBid(99) });
    pub.players[0].coins = 8;
    const { skill, bid } = sara.submit(pub, secOf('p0'));
    const cost = skill ? pub.config.skills[skill].cost : 0;
    expect(Number.isInteger(bid)).toBe(true);
    expect(bid).toBeLessThanOrEqual(8 - cost);
  });
});
