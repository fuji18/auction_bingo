# 要求内容

## 概要

すべての実装の土台となる、ゲーム状態・イベントの型定義、単一のバランス定数、レイヤー間依存規則の ESLint による機械的強制を最初に固定する。(GitHub Issue #4)

## 背景

型・定数・依存規則は後続の全チケット(#5 以降)が直接/間接に依存する土台。特に ESLint による依存規則の強制は「後から入れると既存コードの違反を潰す作業が発生する」ため、最初のチケットに含める(technical spec の判断)。

## 実装対象の機能

### 1. 型定義 `src/core/types.ts`
- `GameState` / `Board` / `Cell` / `PlayerState` / `Submission` / `GameEvent` / `Action` / `GameResult` / `PublicView` / `SecretView` / `Phase` 等をここに集約する
- 型定義はファイルごとに分散させず `types.ts` に集約する

### 2. バランス定数 `src/core/config.ts`
- `BalanceConfig` 型、`DEFAULT_CONFIG` 既定値、`validateConfig()`(制約違反は throw)
- バランス定数の唯一の出所。コード中にリテラルで散らばらせない

### 3. レイヤー依存規則の強制 `eslint.config.js`
- `core/` / `agents/` に `no-restricted-globals`(window/document/localStorage/fetch/console)
- `no-restricted-properties`(Math.random / Date.now)
- `no-restricted-syntax`(new Date)
- `no-restricted-imports`(レイヤー越境と svelte)。`agents/` の禁止先に `**/sim/**` を含める
- `sim/` は console 許可・ui 参照禁止

## 受け入れ条件

### 型定義・バランス定数
- [ ] `config.test.ts` で `validateConfig` の制約(列範囲が互いに素・distributionDivisor >= playerCount+1 等)がテストされている
- [ ] 型定義が `types.ts` に集約されている

### ESLint 依存規則
- [ ] `core/` で `Math.random()` を書くとエラーになる(実際に違反コードを一時的に書いて確認)
- [ ] `agents/` から `sim/` / `ui/` / `svelte` を import するとエラーになる

### 品質ゲート・クリーンアップ
- [ ] `npm run lint` / `npm run typecheck` / `npm run build` が通る
- [ ] `src/index.ts` / `src/index.test.ts` が存在しない

## 成功指標

- 後続チケット(#5 乱数・盤面)が、この型・config・ESLint 規則の上でそのまま着手できる状態になる

## スコープ外

以下はこのフェーズでは実装しません:

- `rng` / `board` / `reduce` の実装(#5 以降)
- 実際のゲームロジック
- CPU の意思決定・UI

## 参照ドキュメント

- `docs/functional-design.md`「データモデル定義」節
- `docs/architecture.md`「依存規則の機械的な強制」節
- `docs/repository-structure.md`「依存関係のルール」節
