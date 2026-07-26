# 設計書

## アーキテクチャ概要

`core/` レイヤーの純粋関数を 2 ファイル追加する。両者とも `config` / `types` にのみ依存し、UI・DOM・タイマー・I/O・非決定 API に依存しない(ESLint の core ブロックで担保済み)。

```
config.ts / types.ts (既存, #4)
      │  RngState / Board / Cell / BalanceConfig
      ▼
rng.ts ──(next/nextInt)──▶ board.ts (createBoard が rng を消費)
```

## コンポーネント設計

### 1. `core/rng.ts`

**責務**: seed+counter から決定的な乱数列を生成する。

**実装の要点**:
- mulberry32 を「純粋 + counter ベース」に変形する。逐次実装では内部状態 `a` が毎回 `a += 0x6D2B79F5` と進むため、counter 回消費後の `a = (seed + counter * 0x6D2B79F5) mod 2^32`。この閉形式で `next` を state を持たない純関数にする
  - `a = (seed + Math.imul(counter, 0x6d2b79f5)) | 0`(`Math.imul` で 32bit 乗算 = 逐次加算 mod 2^32 と一致)
  - 以降は標準 mulberry32 のミックス(`t = Math.imul(a ^ a>>>15, 1|a)` …)で value を得る
- `next` は counter を +1 した `RngState` を返す。`{ seed, counter }` の value は (seed, counter) の関数なので完全に再現可能
- `nextInt(rng, maxExclusive)` は `Math.floor(value * maxExclusive)`。`maxExclusive <= 0` は呼び出し側の契約違反として throw
- `shuffle` は配列をコピーしてから Fisher-Yates(末尾から `nextInt(cur, i+1)` で交換先を決める)。元配列は非破壊

### 2. `core/board.ts`

**責務**: 盤面の生成・マーク・ライン判定。

**実装の要点**:
- `Board` は `board[col][row]`(col=0..4 が B/I/N/G/O、row=0..4 が上から下)
- `createBoard`: 列 c=0..4 の順に `pool = [min..max] 全数字`(config.board.columns[c])を `shuffle` し先頭 `pickPerColumn` 個を採用。この列順が乱数消費順序を決めるため厳守。`freeCenter` なら `board[2][2] = { value: 'FREE', marked: true }`。cell は `{ value, marked: false }`
- `markNumber`: 全セルを写像し、`value === 対象値` のセルだけ `marked: true` にした新盤面を返す(FREE は数値と一致しない)。入力非破壊
- `LINE_INDICES`: `readonly [col, row][]` を 12 本定義
  - 縦(画面の縦=同一 col、row 0..4): col 0..4 で 5 本
  - 横(画面の横=同一 row、col 0..4): row 0..4 で 5 本
  - 斜め: (0,0)(1,1)(2,2)(3,3)(4,4) と (0,4)(1,3)(2,2)(3,1)(4,0)
- `completedLines`: 5 セルすべて marked のライン数
- `reachCount`: marked セル数がちょうど 4 のライン数
- `markCount`: 全セル中 marked === true の数(FREE 含む)
- FREE は生成時 marked: true なので、上記のライン判定・カウントで自動的にマーク済みとして数えられる(特別扱い不要)

## データフロー

### 盤面生成
```
1. createBoard(config, rng) を呼ぶ
2. col 0 → shuffle(pool0) で rng 消費 → 先頭5個
3. col 1 → shuffle(pool1) で rng 消費 → … col 4 まで
4. freeCenter なら中央を FREE marked に置換
5. [board, 消費後の rng] を返す
```

## エラーハンドリング戦略

- `nextInt(rng, maxExclusive<=0)` は `Error` を throw(契約違反)。それ以外は入力を信頼(config は #4 の validateConfig 済み前提)

## テスト戦略

### ユニットテスト(colocated: `src/core/*.test.ts`)
- `rng.test.ts`: 決定性(同一 state → 同一列)、value 範囲 [0,1)、nextInt 範囲、shuffle 非破壊 + 決定性 + 要素保存、消費順序の固定値スナップショット
- `board.test.ts`: 決定性、列範囲遵守・列内重複なし、中央 FREE marked、markNumber 非破壊、completedLines 12ライン網羅(縦横斜めそれぞれ)、reachCount が「4マーク本数」、markCount(FREE 含む)

## ディレクトリ構造

```
src/core/
  rng.ts        (新規)
  rng.test.ts   (新規)
  board.ts      (新規)
  board.test.ts (新規)
```

## 実装の順序

1. `rng.ts`(next / nextInt / shuffle)
2. `rng.test.ts`
3. `board.ts`(LINE_INDICES / createBoard / markNumber / completedLines / reachCount / markCount)
4. `board.test.ts`
5. `/check` で lint / typecheck / test / build / format を通す

## パフォーマンス考慮事項

- 盤面は 5×5、ライン 12 本と小さく、`markNumber` の全写像コピーでも問題ない。純粋・非破壊を優先する
