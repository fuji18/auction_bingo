# タスクリスト

## 🚨 タスク完全完了の原則

全タスクが `[x]` になるまで作業を継続する。未完了(`[ ]`)を残したまま振り返りを書かない。

---

## フェーズ1: 型定義とバランス定数

- [x] `src/core/config.ts`: `BalanceConfig` 型を定義
- [x] `src/core/config.ts`: `DEFAULT_CONFIG` 既定値を定義(functional-design の既定値)
- [x] `src/core/config.ts`: `validateConfig()` を実装(列範囲が互いに素・プール網羅・pickPerColumn・distributionDivisor の制約)
- [x] `src/core/types.ts`: 基本型(`PlayerId` / `SkillId` / `CellValue` / `Cell` / `Board` / `PlayerState` / `Submission` / `Phase` / `RngState`)
- [x] `src/core/types.ts`: `GameState`
- [x] `src/core/types.ts`: `GameEvent`(判別ユニオン)
- [x] `src/core/types.ts`: `Action`(判別ユニオン)
- [x] `src/core/types.ts`: `GameResult`
- [x] `src/core/types.ts`: `PublicView` / `SecretView` / `PublicTurnRecord` / `Agent`

## フェーズ2: config テスト

- [x] `src/core/config.test.ts`: DEFAULT_CONFIG が valid
- [x] `src/core/config.test.ts`: distributionDivisor < playerCount+1 で throw
- [x] `src/core/config.test.ts`: columns 範囲が互いに素でないと throw
- [x] `src/core/config.test.ts`: pickPerColumn が列範囲より大きいと throw
- [x] `src/core/config.test.ts`: 列範囲が整数でないと throw(レビュー指摘でカバレッジ追加)

## フェーズ3: ESLint 依存規則

- [x] `eslint.config.js`: core/ + agents/ ブロック(no-restricted-globals / properties / syntax / imports)を追加
- [x] `eslint.config.js`: core/ 専用の agents/ import 禁止ブロックを追加
- [x] `eslint.config.js`: sim/ の ui/svelte import 禁止を追加(既存 node globals ブロックと共存)
- [x] core/ に `Math.random()` を一時記述し lint エラーになることを確認 → 削除(Date.now / new Date も確認済み)
- [x] agents/ から sim//ui//svelte import を一時記述し lint エラーを確認 → 削除(console/Math.random も確認済み)

## フェーズ4: クリーンアップと品質チェック

- [x] `src/index.ts` / `src/index.test.ts` が存在しないことを確認
- [x] `/check`(test-runner に委譲): lint / typecheck / build / test / format がすべてパス

## フェーズ5: 検証とドキュメント

- [x] code-reviewer subagent によるレビュー(1 Major + 4 Minor。Major=テスト配置 と カバレッジ Minor を反映済み)
- [x] 実装後の振り返り(このファイル下部に記録)

---

## 実装後の振り返り

### 実装完了日
2026-07-22

### 計画と実績の差分

**計画と異なった点**:
- ユニットテストを当初 `tests/config.test.ts` に置いたが、code-reviewer の指摘で `docs/repository-structure.md` の「ユニットテストは `src/` に同居、`tests/` は統合テスト専用」規約に合わせ `src/core/config.test.ts` へ移動した。以降の rng/board/reduce も同居パターンで書く。

**新たに必要になったタスク**:
- レビュー指摘に基づき、`validateConfig` の非整数チェック分岐のテストを1件追加(カバレッジ補完)。

**技術的理由でスキップしたタスク**: なし。

### 学んだこと

**技術的な学び**:
- `BalanceConfig` を `config.ts` に置き `types.ts` から `import type` で参照する構成は、型消去により実行時の循環依存を生まない。凝集度(値・型・検証の同居)を優先した。
- ESLint flat config のファイル別 override で、決定性を壊す非決定 API(Math.random/Date.now/new Date)とレイヤー越境 import を機械的に禁止できることを、一時的な違反コードで実地確認した。

**プロセス上の改善点**:
- test-runner と code-reviewer を並列起動することで、品質ゲートとスペック整合レビューを待ち時間なく回収できた。

### 次回への改善提案
- テストファイルは最初から `src/` 同居で作成する(tests/ は統合テスト専用)。
- ドキュメント側の軽微な不整合(repository-structure.md の依存図の矢印注記、architecture.md への scripts/ 適用の追記)は本 PR のスコープ外とし、フォローアップとして PR ボディに残した。`/sync-docs` 実行時にまとめて解消する候補。
