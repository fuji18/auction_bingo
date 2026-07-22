import { describe, it, expect } from 'vitest';
import { leo } from './leo';
import { emptyBoard, mark, pubWith, secOf } from './testkit';

const boards = () => ({
  p0: emptyBoard(),
  p1: emptyBoard(),
  p2: emptyBoard(),
});

describe('leo.submit スキル選択', () => {
  it('desire(0)==0 かつ予算十分なら greed', () => {
    const pub = pubWith(boards(), { target: 40 }); // 盤外 → desire 0
    const { skill, bid } = leo.submit(pub, secOf('p0'));
    expect(skill).toBe('greed');
    expect(Number.isInteger(bid)).toBe(true);
    expect(bid).toBeGreaterThanOrEqual(0);
    expect(bid).toBeLessThanOrEqual(15 - 6); // coins - greed.cost
  });

  it('desire(1) > desire(0) なら shift', () => {
    // target=3: desire(0)=1(値3), desire(1)=3(値2,3,4)。
    const pub = pubWith(boards(), { target: 3 });
    const { skill } = leo.submit(pub, secOf('p0'));
    expect(skill).toBe('shift');
  });

  it('コストが手持ちを超えるスキルは null に落とし、bid を範囲内に収める', () => {
    const pub = pubWith(boards(), { target: 3 });
    pub.players[0].coins = 3; // shift(4) も greed(6) も買えない
    const { skill, bid } = leo.submit(pub, secOf('p0'));
    expect(skill).toBeNull();
    expect(Number.isInteger(bid)).toBe(true);
    expect(bid).toBeGreaterThanOrEqual(0);
    expect(bid).toBeLessThanOrEqual(3);
  });
});

describe('leo.submit 攻撃性', () => {
  it('同一盤面では序盤ターンの方が入札が高い(aggression 逓減)', () => {
    const b = mark(emptyBoard(), [[0, 0]]);
    const early = pubWith(
      { p0: b, p1: emptyBoard(), p2: emptyBoard() },
      {
        target: 3,
        turn: 1,
      }
    );
    const late = pubWith(
      { p0: b, p1: emptyBoard(), p2: emptyBoard() },
      {
        target: 3,
        turn: 24,
      }
    );
    expect(leo.submit(early, secOf('p0')).bid).toBeGreaterThan(
      leo.submit(late, secOf('p0')).bid
    );
  });
});

describe('leo.tell', () => {
  it('TELLS のいずれかを返す', () => {
    const pub = pubWith(boards(), { target: 3 });
    expect(['強気', '様子見', '静観']).toContain(leo.tell(pub, secOf('p0')));
  });
});
