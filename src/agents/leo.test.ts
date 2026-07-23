import { describe, it, expect } from 'vitest';
import { leo } from './leo';
import { emptyBoard, mark, pubWith, secOf } from './testkit';

const boards = () => ({
  p0: emptyBoard(),
  p1: emptyBoard(),
  p2: emptyBoard(),
});

describe('leo.submit スキル選択', () => {
  it('desire(2) > desire(1) なら greed(範囲拡張を優先)', () => {
    // target=3: desire(0)=1(値3), desire(1)=3(値2,3,4), desire(2)=5(値1..5)。
    // ±2 まで広げて候補が増える(5>3)→ 猪突型は強奪を買う。
    const pub = pubWith(boards(), { target: 3 });
    const { skill, bid } = leo.submit(pub, secOf('p0'));
    expect(skill).toBe('greed');
    expect(Number.isInteger(bid)).toBe(true);
    expect(bid).toBeGreaterThanOrEqual(0);
    expect(bid).toBeLessThanOrEqual(15 - 3); // coins - greed.cost
  });

  it('desire(2)==desire(1) かつ desire(1) > desire(0) なら shift', () => {
    // target=3 で ±2 の端(値1・5)をマーク → desire(2)==desire(1)=3。
    // ±1 で候補が増える(3>1)ので偏向を買う。
    const pub = pubWith(
      {
        p0: mark(emptyBoard(), [
          [0, 0],
          [0, 4],
        ]),
        p1: emptyBoard(),
        p2: emptyBoard(),
      },
      { target: 3 }
    );
    const { skill } = leo.submit(pub, secOf('p0'));
    expect(skill).toBe('shift');
  });

  it('コストが手持ちを超えるスキルは null に落とし、bid を範囲内に収める', () => {
    const pub = pubWith(boards(), { target: 3 });
    pub.players[0].coins = 1; // shift(2)・greed(3)・vision(2) いずれも買えない
    const { skill, bid } = leo.submit(pub, secOf('p0'));
    expect(skill).toBeNull();
    expect(Number.isInteger(bid)).toBe(true);
    expect(bid).toBeGreaterThanOrEqual(0);
    expect(bid).toBeLessThanOrEqual(1);
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
