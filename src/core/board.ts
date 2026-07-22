/**
 * 盤面の生成・マーク・ライン判定。純粋関数のみ。
 *
 * `Board` は board[col][row](col=0..4 が B/I/N/G/O、row=0..4 が上から下)。
 * 中央 board[2][2] は FREE で、生成時点から marked: true。ライン判定・カウントは
 * marked フラグだけを見るため、FREE は自動的にマーク済みとして数えられる。
 */

import type { BalanceConfig } from './config';
import type { Board, Cell, RngState } from './types';
import { shuffle } from './rng';

/** 盤面の一辺のマス数。config.board.size と一致する(5固定)。 */
const SIZE = 5;

/** 中央セルの座標(col, row)。freeCenter のとき FREE になる。 */
const CENTER = 2;

type LineCoord = readonly [col: number, row: number];

/**
 * 縦5 + 横5 + 斜め2 = 12ラインの座標を事前定義する。
 * 各ラインは [col, row] を SIZE 個並べたもの。
 */
export const LINE_INDICES: readonly (readonly LineCoord[])[] = buildLines();

function buildLines(): readonly (readonly LineCoord[])[] {
  const lines: LineCoord[][] = [];
  // 縦(画面の縦 = 同一 col、row を動かす)
  for (let c = 0; c < SIZE; c++) {
    lines.push(Array.from({ length: SIZE }, (_, r): LineCoord => [c, r]));
  }
  // 横(画面の横 = 同一 row、col を動かす)
  for (let r = 0; r < SIZE; r++) {
    lines.push(Array.from({ length: SIZE }, (_, c): LineCoord => [c, r]));
  }
  // 斜め(左上→右下、右上→左下)
  lines.push(Array.from({ length: SIZE }, (_, i): LineCoord => [i, i]));
  lines.push(
    Array.from({ length: SIZE }, (_, i): LineCoord => [i, SIZE - 1 - i])
  );
  return lines;
}

/**
 * シードから盤面を決定的に生成する。列 c=0..4 の順に、その列の数値範囲全体を
 * shuffle して先頭 pickPerColumn 個を採用する(この列順が乱数消費順序を決める)。
 * freeCenter なら中央を FREE(marked: true)に置き換える。
 */
export function createBoard(
  config: BalanceConfig,
  rng: RngState
): [board: Board, next: RngState] {
  const { columns, pickPerColumn, freeCenter } = config.board;
  const board: Board = [];
  let cur = rng;

  for (let c = 0; c < columns.length; c++) {
    const [min, max] = columns[c];
    const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const [shuffled, nextRng] = shuffle(cur, pool);
    cur = nextRng;
    board.push(
      shuffled
        .slice(0, pickPerColumn)
        .map((value): Cell => ({ value, marked: false }))
    );
  }

  if (freeCenter) {
    board[CENTER][CENTER] = { value: 'FREE', marked: true };
  }

  return [board, cur];
}

/**
 * value に一致するセルをマークした新しい盤面を返す(非破壊)。
 * FREE は数値と一致しないため影響を受けない。
 */
export function markNumber(board: Board, value: number): Board {
  return board.map((column) =>
    column.map((cell) =>
      cell.value === value ? { ...cell, marked: true } : cell
    )
  );
}

/** 5セルすべてが marked のライン数(縦・横・斜めの12ラインから)。 */
export function completedLines(board: Board): number {
  return LINE_INDICES.filter((line) =>
    line.every(([c, r]) => board[c][r].marked)
  ).length;
}

/** marked セルがちょうど 4 のライン数(=リーチ。「4マークのライン本数」)。 */
export function reachCount(board: Board): number {
  return LINE_INDICES.filter(
    (line) => line.filter(([c, r]) => board[c][r].marked).length === 4
  ).length;
}

/** マーク済みセルの総数(FREE を含む)。 */
export function markCount(board: Board): number {
  return board.reduce(
    (sum, column) => sum + column.filter((cell) => cell.marked).length,
    0
  );
}
