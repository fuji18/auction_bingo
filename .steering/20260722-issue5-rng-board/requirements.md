# 要求内容

## 概要

決定性の基礎となるシード付き乱数(`core/rng.ts`)と、ビンゴの盤面ロジック(`core/board.ts`)を純粋関数として実装する。

## 背景

リプレイ・シミュレーション・セーブ復元のすべてが「同一シードから同一結果」に依存する。乱数を `Math.random()` ではなく state(seed+counter)から生成し、盤面生成もこの乱数の消費順序に依存する。ここが決定的でないと、上位のすべての決定性が崩れる(Issue #5、depends #4)。

## 実装対象の機能

### 1. `core/rng.ts`(シード付き乱数)
- `next(rng) -> [value, nextRng]`: mulberry32 相当。value は [0,1)
- `nextInt(rng, maxExclusive) -> [number, nextRng]`
- `shuffle<T>(rng, items) -> [T[], nextRng]`: Fisher-Yates
- 状態を引数で受け取り新状態を返す純粋関数。`Math.random()` は使わない

### 2. `core/board.ts`(盤面ロジック)
- `createBoard(config, rng) -> [Board, nextRng]`: 列ごとに範囲全数字を shuffle し先頭 pickPerColumn 個。中央 FREE(marked: true)
- `markNumber(board, value) -> Board`: 非破壊マーク
- `completedLines(board) -> number`: 完成ライン数
- `reachCount(board) -> number`: 4マークのライン本数
- `markCount(board) -> number`: マーク済みセル数(FREE 含む)
- `LINE_INDICES`: 縦5+横5+斜め2=12ラインの座標を事前定義した定数

## 受け入れ条件

### rng
- [ ] 同一 `RngState` から `next` / `nextInt` / `shuffle` が同一結果・同一 nextRng を返す
- [ ] `next` の value が [0,1) の範囲に収まる
- [ ] `shuffle` が元配列を破壊しない
- [ ] core/ で `Math.random()` / `Date` を呼ばない(ESLint で担保)

### board
- [ ] 同一シードから `createBoard` が同一盤面を返す
- [ ] 盤面が列範囲(B:1-8..O:33-40)を守り、列内に重複がなく、中央が FREE でマーク済み
- [ ] `reachCount` が「4マークのライン本数」を返す(最長ラインのマーク数ではない)
- [ ] `completedLines` が縦・横・斜めの12ラインを網羅
- [ ] `markNumber` が入力盤面を破壊しない
- [ ] FREE が常にマーク済みとしてライン判定に数えられる

## 成功指標

- `npm test` / `npm run typecheck` / `npm run lint` がすべて通る
- 決定性テスト(固定シード)で乱数消費順序を固定する

## スコープ外

- ターン進行・提出処理(#7 reduce)
- ビューの射影(#6 / #3)
- UI・演出

## 参照ドキュメント

- `docs/functional-design.md`「core/rng.ts」「core/board.ts」「1. 盤面生成」節
- `docs/development-guidelines.md`「最優先の規約 — 決定性」節
- `src/core/config.ts` / `src/core/types.ts`(#4 で定義済みの型)
