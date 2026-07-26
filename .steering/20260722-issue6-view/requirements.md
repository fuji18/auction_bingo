# 要求内容

## 概要

`GameState` から `PublicView` / `SecretView` への射影(`core/view.ts`)と、意思決定インターフェース(`agents/types.ts`)を実装し、「CPU は非公開情報を参照しない」を型で構造的に保証する境界を作る。

## 背景

CPU は公開情報と自分の秘密情報だけで意思決定すべきだが、`GameState` 全体を渡せば `deck` の中身や他者の `submissions` を参照できてしまう。射影関数で公開/秘密を分離し、`Agent` が `GameState` ではなく `PublicView` / `SecretView` だけを受け取る型にすることで、参照そのものを構造的に不可能にする。この境界は P1 のサーバー化で「クライアントに送ってよい情報」の定義にそのまま流用する(Issue #6、depends #5)。

## 実装対象の機能

### 1. `core/view.ts`(射影)
- `toPublicView(state) -> PublicView`: 全員共通の公開情報。`deck` は `deckSize`(枚数)のみ。他者の `submissions` / `visionPeek` を含めない
- `toSecretView(state, playerId) -> SecretView`: その本人の `visionPeek` のみ(予知成功ターン以外は `null`)
- `history: PublicTurnRecord[]` は `state.log`(GameEvent 列)から**開札済みターンのみ**を再構成する。ログが唯一の真実の源(`reduce` はイベント列を必ず返す設計)

### 2. `agents/types.ts`(意思決定インターフェース)
- `Agent`(`submit` / `chooseNumber` / `selectVision` / `tell`)を `src/agents/types.ts` に定義する
- #4 が暫定的に `core/types.ts` へ置いた `Agent` を本来の場所(`agents/types.ts`)へ移設する。データモデルの `PublicView` / `SecretView` / `PublicTurnRecord` は `core/types.ts` に残す

### 3. テスト
- `tests/informationBarrier.test.ts`: `PublicView` に秘匿情報が含まれないことを検証(統合テスト)
- `src/core/view.test.ts`: 射影の単体テスト(history 再構成・SecretView の本人限定)

## 受け入れ条件

- [ ] `PublicView` に `deck` の中身が含まれない(`deckSize` のみ)
- [ ] `PublicView` に他プレイヤーの `submissions` / `visionPeek` が含まれない
- [ ] `PublicView.history` が開札済みターンのみを含み、進行中ターンの提出内容を露出しない
- [ ] `SecretView` は自分の `visionPeek` のみを持つ(他者分は取得不可)
- [ ] `Agent` は `GameState` 全体ではなく `PublicView` / `SecretView` を受け取る型で、`src/agents/types.ts` に置かれている
- [ ] `agents/types.ts` は `core/` の型のみに依存する(層依存規則を守る)
- [ ] `npm test` / `npm run typecheck` / `npm run lint` / `npm run build` が通る

## スコープ外

- CPU の実装(#8/#6 の後続)
- `reduce`(#7)。view.test は手組みの `GameState` フィクスチャで射影のみを検証する
- human 用の `Agent` 実装(手番は UI から直接 `reduce` へ)

## 参照ドキュメント

- `docs/functional-design.md`「エージェントに渡すビュー」節
- `docs/architecture.md`「公開情報 / 秘密情報」「agents/ レイヤー」節(L46, L74, L207, L255)
- `docs/repository-structure.md`「src/core/」「src/agents/」節(view.ts / agents/types.ts の配置)
- `src/core/types.ts`(#4 で定義済みの `PublicView` / `SecretView` / `PublicTurnRecord` / `Agent`)
