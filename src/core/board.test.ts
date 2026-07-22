import { describe, it, expect } from 'vitest';
import type { Board, Cell, RngState } from './types';
import { DEFAULT_CONFIG } from './config';
import {
  createBoard,
  markNumber,
  completedLines,
  reachCount,
  markCount,
  LINE_INDICES,
} from './board';

const seedState = (seed: number): RngState => ({ seed, counter: 0 });

/** 全マス未マークの数値盤面(FREE なし)を作る。テストで任意にマークする土台。 */
function blankBoard(): Board {
  return Array.from({ length: 5 }, (_, c) =>
    Array.from({ length: 5 }, (_, r): Cell => ({
      value: c * 5 + r + 1,
      marked: false,
    }))
  );
}

describe('LINE_INDICES', () => {
  it('縦5 + 横5 + 斜め2 = 12ライン、各5セル', () => {
    expect(LINE_INDICES).toHaveLength(12);
    for (const line of LINE_INDICES) {
      expect(line).toHaveLength(5);
    }
  });

  it('12本が互いに異なる(重複ラインが無い)', () => {
    const keys = LINE_INDICES.map((line) =>
      line
        .map(([c, r]) => `${c},${r}`)
        .sort()
        .join('|')
    );
    expect(new Set(keys).size).toBe(12);
  });

  it('各セルが正しい本数のラインに属する(角3・中央4・対角上の中間3・その他2)', () => {
    const count = Array.from({ length: 5 }, () => Array(5).fill(0));
    for (const line of LINE_INDICES) {
      for (const [c, r] of line) count[c][r]++;
    }
    // 角: 縦+横+対角 = 3
    expect(count[0][0]).toBe(3);
    expect(count[4][4]).toBe(3);
    expect(count[0][4]).toBe(3);
    expect(count[4][0]).toBe(3);
    // 中央: 縦+横+対角2本 = 4
    expect(count[2][2]).toBe(4);
    // 対角上の中間セル: 縦+横+対角 = 3
    expect(count[1][1]).toBe(3);
    expect(count[1][3]).toBe(3);
    // 対角に乗らない辺セル: 縦+横 = 2
    expect(count[0][2]).toBe(2);
    expect(count[2][0]).toBe(2);
    // 総スロット数 = 12ライン * 5 = 60
    const total = count.flat().reduce((a, b) => a + b, 0);
    expect(total).toBe(60);
  });
});

describe('createBoard', () => {
  it('同一シードから同一盤面を返す(決定的)', () => {
    const [a] = createBoard(DEFAULT_CONFIG, seedState(42));
    const [b] = createBoard(DEFAULT_CONFIG, seedState(42));
    expect(a).toEqual(b);
  });

  it('乱数消費順序の回帰: 固定 seed の盤面値がスナップショットと一致する', () => {
    // 列の走査順・shuffle 方向・slice(先頭 pickPerColumn)のいずれかが変わると
    // この値が壊れる(セーブ復元・リプレイ互換の番人)。
    const [board] = createBoard(DEFAULT_CONFIG, seedState(42));
    const values = board.map((col) => col.map((cell) => cell.value));
    expect(values).toEqual([
      [3, 8, 2, 1, 7],
      [16, 9, 14, 12, 10],
      [22, 19, 'FREE', 17, 23],
      [27, 31, 28, 30, 26],
      [36, 39, 35, 38, 40],
    ]);
  });

  it('列ごとに範囲を守り、列内に重複がない', () => {
    const [board] = createBoard(DEFAULT_CONFIG, seedState(7));
    const { columns, pickPerColumn } = DEFAULT_CONFIG.board;
    for (let c = 0; c < columns.length; c++) {
      const [min, max] = columns[c];
      const values = board[c]
        .map((cell) => cell.value)
        .filter((v): v is number => v !== 'FREE');
      // 中央列は FREE で 1 個減る
      const expectedCount = c === 2 ? pickPerColumn - 1 : pickPerColumn;
      expect(values).toHaveLength(expectedCount);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(min);
        expect(v).toBeLessThanOrEqual(max);
      }
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('中央が FREE でマーク済み', () => {
    const [board] = createBoard(DEFAULT_CONFIG, seedState(1));
    expect(board[2][2]).toEqual({ value: 'FREE', marked: true });
  });

  it('rng を消費して次の状態を返す', () => {
    const [, next] = createBoard(DEFAULT_CONFIG, seedState(1));
    expect(next.counter).toBeGreaterThan(0);
  });
});

describe('markNumber', () => {
  it('一致する値をマークする', () => {
    const board = blankBoard();
    const marked = markNumber(board, 1); // board[0][0]
    expect(marked[0][0].marked).toBe(true);
  });

  it('入力盤面を破壊しない', () => {
    const board = blankBoard();
    markNumber(board, 1);
    expect(board[0][0].marked).toBe(false);
  });

  it('存在しない値では何も変わらない', () => {
    const board = blankBoard();
    const marked = markNumber(board, 999);
    expect(marked).toEqual(board);
  });
});

describe('completedLines', () => {
  it('縦ラインの完成を検出する', () => {
    let board = blankBoard();
    // col 0 の縦を全マーク(値 1..5)
    for (let r = 0; r < 5; r++)
      board = markNumber(board, board[0][r].value as number);
    expect(completedLines(board)).toBe(1);
  });

  it('横ラインの完成を検出する', () => {
    let board = blankBoard();
    // row 0 の横を全マーク
    for (let c = 0; c < 5; c++)
      board = markNumber(board, board[c][0].value as number);
    expect(completedLines(board)).toBe(1);
  });

  it('斜めラインの完成を検出する', () => {
    let board = blankBoard();
    for (let i = 0; i < 5; i++)
      board = markNumber(board, board[i][i].value as number);
    expect(completedLines(board)).toBe(1);
  });

  it('未完成では 0', () => {
    expect(completedLines(blankBoard())).toBe(0);
  });
});

describe('reachCount', () => {
  it('ちょうど 4 マークのライン本数を返す(最長ラインのマーク数ではない)', () => {
    let board = blankBoard();
    // col 0 の縦を 4 つだけマーク(row 0..3)→ リーチ
    for (let r = 0; r < 4; r++)
      board = markNumber(board, board[0][r].value as number);
    expect(reachCount(board)).toBe(1);
  });

  it('完成(5マーク)はリーチに数えない', () => {
    let board = blankBoard();
    for (let r = 0; r < 5; r++)
      board = markNumber(board, board[0][r].value as number);
    expect(reachCount(board)).toBe(0);
  });

  it('3マーク以下はリーチではない', () => {
    let board = blankBoard();
    for (let r = 0; r < 3; r++)
      board = markNumber(board, board[0][r].value as number);
    expect(reachCount(board)).toBe(0);
  });
});

describe('markCount', () => {
  it('マーク済みセル数を数える', () => {
    let board = blankBoard();
    board = markNumber(board, board[0][0].value as number);
    board = markNumber(board, board[1][1].value as number);
    expect(markCount(board)).toBe(2);
  });

  it('FREE(生成時マーク済み)を含めて数える', () => {
    const [board] = createBoard(DEFAULT_CONFIG, seedState(3));
    // 生成直後は FREE の 1 マスだけがマーク済み
    expect(markCount(board)).toBe(1);
  });
});
