# 設計書

## アーキテクチャ概要

`core/` を頂点とした一方向依存(core ← agents ← ui/sim)を型と ESLint で固定する。本チケットは型・config・lint 規則のみを扱い、ロジックは持たない。

```
src/core/
├ types.ts    全ゲーム型の集約(GameState/Board/Cell/PlayerState/Submission/
│             GameEvent/Action/GameResult/PublicView/SecretView/Phase/RngState など)
└ config.ts   BalanceConfig 型 / DEFAULT_CONFIG / validateConfig()
tests/
└ config.test.ts   validateConfig の制約テスト
eslint.config.js    レイヤー依存規則(no-restricted-*)を追加
```

## コンポーネント設計

### 1. `src/core/types.ts`

**責務**:
- functional-design.md「データモデル定義」節の型を TypeScript として忠実に定義する
- 他レイヤー(agents/ui/sim)が参照する共通語彙を提供する

**実装の要点**:
- `PlayerId = 'p0' | 'p1' | 'p2'`、`SkillId = 'shift' | 'vision' | 'greed'`、`CellValue = number | 'FREE'`
- `Board = Cell[][]`(board[col][row])
- `reserved` / `visionPeek` は `Record<PlayerId, ...>`
- `GameEvent` / `Action` は判別可能ユニオン(discriminated union)
- `BalanceConfig` は config.ts で定義するが、型は types.ts へ置くか config.ts へ置くか要判断 → **BalanceConfig は config.ts に置き、types.ts から re-export しない**。functional-design ではデータモデルの一部だが、値(DEFAULT_CONFIG)と検証と同居させた方が凝集度が高い。GameState は `config: BalanceConfig` を持つため types.ts が config.ts の型を import する(core 内部の import は許可)
- 型のみのファイルなので `import type` を使わせるため、値は持たせない

### 2. `src/core/config.ts`

**責務**:
- `BalanceConfig` 型定義、`DEFAULT_CONFIG` 既定値、`validateConfig()` 検証

**実装の要点**:
- 制約(functional-design.md より):
  - `board.columns` の各範囲は互いに素で、和が数字プール全体を覆う
  - `pickPerColumn <= 各列範囲の広さ`
  - `distributionDivisor >= playerCount + 1`
- 違反は `throw new Error(...)` する(専用エラークラスは過剰なので Error でよい)
- リテラル型(`playerCount: 3` 等)は functional-design の定義に合わせる

### 3. `eslint.config.js`(依存規則の追加)

**責務**:
- レイヤー越境と非決定 API をエラーにする

**実装の要点**(architecture.md のスニペット準拠):
- `core/` + `agents/`: `no-restricted-globals`(window/document/localStorage/fetch/console)、`no-restricted-properties`(Math.random / Date.now)、`no-restricted-syntax`(new Date)、`no-restricted-imports`(`**/ui/**` `**/sim/**` `svelte` `svelte/*`)
- `core/` のみ追加で `**/agents/**` も import 禁止
- `sim/`: `no-restricted-imports`(`**/ui/**` `svelte` `svelte/*`)。console は許可(既存の node globals ブロックがある)
- 既存の `src/sim/**` ブロック(node globals)と統合/共存させる
- `new Date` は `no-restricted-syntax` の `NewExpression[callee.name='Date']` セレクタで塞ぐ

## データフロー

本チケットは状態遷移を持たない。GameState 等の型が後続チケットの入出力契約になる。

## エラーハンドリング戦略

`validateConfig` は最初に見つかった制約違反で `throw new Error(メッセージ)`。メッセージは違反内容を特定できる日本語にする。

## テスト戦略

### ユニットテスト
- `tests/config.test.ts`:
  - `validateConfig(DEFAULT_CONFIG)` が throw しない
  - `distributionDivisor < playerCount + 1` で throw する
  - `columns` が重複(互いに素でない)で throw する
  - `pickPerColumn > 列範囲の広さ` で throw する

### ESLint 規則の確認
- `core/` に一時的に `Math.random()` を書いて `npm run lint` がエラーになることを確認 → 確認後削除
- `agents/` から `sim/`/`ui/`/`svelte` を import する一時ファイルでエラーを確認 → 確認後削除

## 依存ライブラリ

新規追加なし。

## ディレクトリ構造

```
src/core/types.ts      (新規)
src/core/config.ts     (新規)
tests/config.test.ts   (新規)
eslint.config.js       (変更: 依存規則ブロックを追加)
```

## 実装の順序

1. `src/core/config.ts` の BalanceConfig 型を先に確定(GameState が参照するため)
2. `src/core/types.ts` を作成
3. `src/core/config.ts` に DEFAULT_CONFIG / validateConfig を実装
4. `tests/config.test.ts` を作成
5. `eslint.config.js` に依存規則を追加
6. ESLint 規則を違反コードで検証(確認後削除)
7. `src/index.ts` / `src/index.test.ts` の不在を確認
8. `/check`(lint/typecheck/build/test)

## セキュリティ考慮事項

- 本チケットは非決定 API(Math.random/Date.now)を型・lint で構造的に禁止することが主眼。P1 サーバー化での「クライアントに送ってよい情報」定義(PublicView)の土台にもなる。

## パフォーマンス考慮事項

- 型定義のみのため実行時コストなし。

## 将来の拡張性

- `BalanceConfig` を単一の出所にすることで、#9 のバランス調整がロジック diff を汚さずに行える。
- `PublicView` / `SecretView` の分離が P1 サーバー化の情報境界に直結する。
