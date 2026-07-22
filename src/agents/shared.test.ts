import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../core/config';
import {
  baseTell,
  bestLineAfter,
  chooseNumber,
  clampBid,
  desire,
  deriveRng,
  lineCompletesFor,
  makeTell,
  numberBoundsOf,
  selectVision,
  skillCostOf,
  skillRangeOf,
  TELLS,
} from './shared';
import { emptyBoard, mark, pubWith, secOf } from './testkit';

describe('numberBoundsOf / skillRangeOf / skillCostOf / clampBid', () => {
  it('数字境界を config から算出する', () => {
    expect(numberBoundsOf(DEFAULT_CONFIG)).toEqual([1, 40]);
  });

  it('スキルの範囲とコスト', () => {
    expect(skillRangeOf('shift')).toBe(1);
    expect(skillRangeOf('greed')).toBe(2);
    expect(skillRangeOf('vision')).toBe(0);
    expect(skillRangeOf(null)).toBe(0);
    expect(skillCostOf(DEFAULT_CONFIG, 'vision')).toBe(5);
    expect(skillCostOf(DEFAULT_CONFIG, null)).toBe(0);
  });

  it('clampBid は整数・非負・上限に収める', () => {
    expect(clampBid(3.6, 10)).toBe(4);
    expect(clampBid(-2, 10)).toBe(0);
    expect(clampBid(99, 10)).toBe(10);
    expect(clampBid(5, -1)).toBe(0);
  });
});

describe('desire', () => {
  it('窓内の未マークセル数を数える', () => {
    // emptyBoard: value(col,row) = col*5+row+1。col0 = 1..5。
    const board = emptyBoard();
    // target=3, range=1 → 窓 [2,4] に 2,3,4 の 3 枚。
    expect(desire(board, 3, 1)).toBe(3);
    // マークすると減る。
    const marked = mark(board, [
      [0, 1], // value 2
    ]);
    expect(desire(marked, 3, 1)).toBe(2);
    // range=0 は target ちょうど。
    expect(desire(board, 3, 0)).toBe(1);
  });
});

describe('bestLineAfter / lineCompletesFor', () => {
  it('列の 4 マークを完成させる値は 5 を返す', () => {
    // col0 の rows0..3 をマーク。[0][4]=value5 が縦ラインの最後の 1 枚。
    const board = mark(emptyBoard(), [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
    expect(bestLineAfter(board, 5)).toBe(5);
    expect(lineCompletesFor(board, 5)).toBe(true);
  });

  it('持っていない/マーク済みの値は 0', () => {
    const board = emptyBoard();
    expect(bestLineAfter(board, 999)).toBe(0);
    const marked = mark(board, [[0, 4]]); // value5 をマーク済みに
    expect(bestLineAfter(marked, 5)).toBe(0);
  });
});

describe('chooseNumber', () => {
  it('自盤面の候補のうち最長ラインを伸ばす値を選ぶ', () => {
    const my = mark(emptyBoard(), [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]); // value5 で縦完成
    const pub = pubWith({ p0: my, p1: emptyBoard(), p2: emptyBoard() });
    // 候補 5(縦完成=5) と 12(単発=1)。
    expect(chooseNumber(pub, secOf('p0'), [5, 12])).toBe(5);
  });

  it('自盤面に候補が無く、相手完成しか無ければパス', () => {
    // 自分は value5 をマーク済み(=未マークで持っていない)。
    const my = mark(emptyBoard(), [[0, 4]]);
    // 相手 p1 は value5 で縦完成できる。
    const opp = mark(emptyBoard(), [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
    const pub = pubWith({ p0: my, p1: opp, p2: emptyBoard() });
    expect(chooseNumber(pub, secOf('p0'), [5])).toBeNull();
  });

  it('候補ゼロならパス', () => {
    const pub = pubWith({
      p0: emptyBoard(),
      p1: emptyBoard(),
      p2: emptyBoard(),
    });
    expect(chooseNumber(pub, secOf('p0'), [])).toBeNull();
  });
});

describe('selectVision', () => {
  it('自分が持ち最長ラインを伸ばす 1 枚を選ぶ', () => {
    const my = mark(emptyBoard(), [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]); // value5 で完成
    const pub = pubWith({ p0: my, p1: emptyBoard(), p2: emptyBoard() });
    expect(selectVision(pub, secOf('p0'), [5, 12, 20])).toBe(5);
  });

  it('自分が持たなければ相手が最も持っていない 1 枚', () => {
    // 自分は 1,2,3 をすべてマーク済み(未マークで持っていない)。
    const my = mark(emptyBoard(), [
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    // p1 は 1,2 を保持、3 をマーク済み。p2 は 1 を保持、2,3 をマーク済み。
    // → 3 は誰も未マークで持たない(最も持っていない)。
    const p1 = mark(emptyBoard(), [[0, 2]]);
    const p2 = mark(emptyBoard(), [
      [0, 1],
      [0, 2],
    ]);
    const pub = pubWith({ p0: my, p1, p2 });
    expect(selectVision(pub, secOf('p0'), [1, 2, 3])).toBe(3);
  });
});

describe('baseTell / makeTell', () => {
  it('ratio 閾値で基本テルが決まる', () => {
    expect(baseTell(0.5)).toBe('強気');
    expect(baseTell(0.3)).toBe('様子見');
    expect(baseTell(0.1)).toBe('静観');
  });

  it('makeTell は TELLS のいずれかを返し、同一 state から決定的', () => {
    const pub = pubWith({
      p0: emptyBoard(),
      p1: emptyBoard(),
      p2: emptyBoard(),
    });
    const a = makeTell(pub, secOf('p1'), 8);
    const b = makeTell(pub, secOf('p1'), 8);
    expect(a).toBe(b);
    expect(TELLS).toContain(a);
  });

  it('派生 rng は同一入力で同一 seed', () => {
    const pub = pubWith({
      p0: emptyBoard(),
      p1: emptyBoard(),
      p2: emptyBoard(),
    });
    expect(deriveRng(pub, 'p1', 1)).toEqual(deriveRng(pub, 'p1', 1));
    expect(deriveRng(pub, 'p1', 1)).not.toEqual(deriveRng(pub, 'p2', 1));
  });
});
