# タスクリスト

## 🚨 タスク完全完了の原則

全タスクが `[x]` になるまで作業を継続する。未完了(`[ ]`)を残したまま振り返りを書かない。

---

## フェーズ1: rng.ts(シード付き乱数)

- [x] `src/core/rng.ts`: `next(rng)` を mulberry32 の counter ベース閉形式で実装(value ∈ [0,1)、nextRng を返す)
- [x] `src/core/rng.ts`: `nextInt(rng, maxExclusive)`(maxExclusive<=0 で throw)
- [x] `src/core/rng.ts`: `shuffle<T>(rng, items)`(Fisher-Yates、非破壊)

## フェーズ2: rng テスト

- [x] `src/core/rng.test.ts`: 決定性(同一 state → 同一 value・同一 nextRng)
- [x] `src/core/rng.test.ts`: value が [0,1) に収まる
- [x] `src/core/rng.test.ts`: `nextInt` が [0, maxExclusive) に収まる / maxExclusive<=0 で throw
- [x] `src/core/rng.test.ts`: `shuffle` が非破壊・要素保存・決定的
- [x] `src/core/rng.test.ts`: 消費順序の固定値(スナップショット的な回帰テスト)

## フェーズ3: board.ts(盤面ロジック)

- [x] `src/core/board.ts`: `LINE_INDICES`(縦5+横5+斜め2=12ライン)を定数定義
- [x] `src/core/board.ts`: `createBoard(config, rng)`(列順に shuffle → 先頭 pickPerColumn、中央 FREE marked)
- [x] `src/core/board.ts`: `markNumber(board, value)`(非破壊)
- [x] `src/core/board.ts`: `completedLines(board)` / `reachCount(board)`(4マーク本数) / `markCount(board)`(FREE 含む)

## フェーズ4: board テスト

- [x] `src/core/board.test.ts`: 同一シードで同一盤面
- [x] `src/core/board.test.ts`: 列範囲遵守・列内重複なし・中央 FREE marked
- [x] `src/core/board.test.ts`: `markNumber` 非破壊
- [x] `src/core/board.test.ts`: `completedLines` が縦・横・斜めの12ラインを網羅
- [x] `src/core/board.test.ts`: `reachCount` が「4マークのライン本数」を返す
- [x] `src/core/board.test.ts`: `markCount` が FREE を含む

## フェーズ5: 品質チェックと検証

- [x] `/check`(test-runner に委譲): lint / typecheck / build / test / format がすべてパス(42 tests)
- [x] code-reviewer subagent によるレビューと反映(0 Critical / 1 Major / 4 Minor。Major と Minor 3件を反映)

## フェーズ6: 振り返り

- [x] 実装後の振り返り(このファイル下部に記録)

---

## 実装後の振り返り

### 実装完了日
2026-07-22

### 計画と実績の差分

**計画通りに完了した点**:
- rng.ts / board.ts と各テストを設計通り実装。API シグネチャは docs/functional-design.md と完全一致。

**計画に追加した点(code-reviewer 指摘の反映)**:
- **[Major] board 側の乱数消費順序回帰テスト**: rng.test.ts にはあったが createBoard 側に無く、「同一シードで一致」だけでは列走査順・shuffle 方向・slice の変更を検出できなかった。固定 seed=42 の盤面値をハードコードする回帰テストを追加。
- **[Minor] LINE_INDICES の内容検証**: 形状(12本×5セル)だけでなく、重複ラインが無いこと・各セルの所属ライン本数(角3/中央4/対角中間3/その他2)・総スロット60を検証するテストを追加。
- **[Minor] pickPerColumn === board.size の不変条件**: board.ts のライン判定が SIZE=5 固定に依存するため、#4 の validateConfig に検証を追加(スコープ外の #4 ファイルだが、#5 が露呈させた latent footgun のため対応)。config.test.ts にテスト追加。
- **[Minor] seed 整数前提**: rng.ts の header に「seed は整数前提」を明記。

**未反映の指摘(理由付き)**:
- SIZE/CENTER が config.board.size から独立している点は、BalanceConfig.board.size の型がリテラル 5 に固定されているため現状バグではなく、既存コメントで言及済みのため対応不要と判断。

### 学んだこと
- 決定性テストは「2回実行の一致」では不十分で、消費順序を変える変更を捕まえるにはシードごとの出力値をハードコードした回帰テストが必要。rng だけでなく、rng を消費するすべての生成関数(board)にも同種のテストを置く。
- 純粋 mulberry32 は counter ベースの閉形式に変形でき、整数 seed の範囲では逐次実装と一致する(独立スクリプトで確認)。

### 次回への改善提案
- #6 以降で rng を消費する関数(deck 生成・vision 等)を実装する際は、最初から board と同じ「固定シードの出力ハードコード」回帰テストを1本用意する。

