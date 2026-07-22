# タスクリスト

## 🚨 タスク完全完了の原則

全タスクが `[x]` になるまで作業を継続する。未完了(`[ ]`)を残したまま振り返りを書かない。

---

## フェーズ1: Agent インターフェースの移設

- [x] `src/agents/types.ts` を新規作成し、`Agent` インターフェースを定義(`../core/types` から `PublicView` / `SecretView` / `SkillId` を import)
- [x] `src/core/types.ts` から `Agent` インターフェースを削除(`PublicView` / `SecretView` / `PublicTurnRecord` は残す)
- [x] `core/types.ts` のヘッダーコメントを実態(Agent は agents/ へ移設)に整合

## フェーズ2: view.ts(射影)

- [x] `src/core/view.ts`: `toPublicView(state)` — deckSize のみ・reserved 射影・秘匿フィールド非搭載
- [x] `src/core/view.ts`: `history` を `state.log` から再構成(開札済みターンのみ)
- [x] `src/core/view.ts`: `toSecretView(state, playerId)` — 本人の visionPeek のみ(無ければ null)

## フェーズ3: テスト

- [x] `src/core/view.test.ts`: `makeState` フィクスチャヘルパ(DEFAULT_CONFIG + createBoard + 明示 log)
- [x] `src/core/view.test.ts`: deckSize 一致・deck 非露出 / reserved 射影 / SecretView 本人限定・予知なし null
- [x] `src/core/view.test.ts`: history 再構成(開札済みのみ・フィールド正当・パス chosen=null)
- [x] `tests/informationBarrier.test.ts`: PublicView に deck 中身・他者 submissions / visionPeek が(JSON 化しても)含まれない・submitting フェーズの提出が history に出ない

## フェーズ4: 品質チェックと検証

- [x] `/check`(test-runner に委譲): lint / typecheck / build / test / format がすべてパス(57 tests、view 追加後)
- [x] code-reviewer subagent によるレビューと反映(0 Critical / 0 Major / 2 Minor。Minor 1 を反映、Minor 2 は #7 への申し送り)

## フェーズ5: 振り返り

- [x] 実装後の振り返り(このファイル下部に記録)

---

## 実装後の振り返り

### 実装完了日
2026-07-22

### 計画と実績の差分

**計画通りに完了した点**:
- `toPublicView` / `toSecretView` を設計どおり実装。`PublicView` / `SecretView` の型は #4 で確定済みだったため、射影ロジックに集中できた。
- `Agent` を `core/types.ts` から `agents/types.ts` へ移設。層依存の向き(core → agents 禁止)も正された。
- 情報バリアの統合テストと射影の単体テストを設計どおり配置。

**計画から変えた点**:
- **[test-runner 指摘] SecretView.visionPeek の空配列正規化**: `GameState.visionPeek` は「予知なし」を空配列 `[]` で持つが、`SecretView.visionPeek` の型は `number[] | null` で null が「予知なし」を表す。当初 `?? null` では `[]` が素通りしていたため、`length > 0 ? peek : null` に修正。型の意図(予知成功ターンのみ number[])に一致させた。
- **[code-reviewer Minor 1] バリアテストの文言限定**: 「submissions/visionPeek のキーを一切持たない」は history が空のため偶然成立していた。過去の開札済みターンの入札は history 経由で意図的に公開されるため、テスト名・コメントを「進行中ターンの秘匿フィールドが露出しない」に限定した。

**未反映の指摘(理由付き)**:
- **[code-reviewer Minor 2] buildHistory の防御的不変条件チェック無し**: `buildHistory` は #7 が正しい順序・カーディナリティでイベントを発行することを前提とする。`view.ts` は純粋な射影であり、ランタイム不変条件チェックを足すのはスコープ逸脱。reviewer 自身も #7 との結合部の申し送り事項と位置づけているため、下記「次回への改善提案」に #7 向けの前提として記録する。

### 学んだこと
- 「予知なし」の表現が層で異なる(GameState=空配列 / SecretView=null)。射影関数はこうした表現差の正規化点でもある。ドメインの空値表現を層境界で一度きめておくと後段が楽になる。
- history のような派生データは「唯一の真実の源」(log)から再構成する設計にすると、GameState に冗長フィールドを持たずに済み、リプレイ・セーブとの整合も自動的に取れる。

### 次回への改善提案(#7 への申し送り)
- **#7 の reduce は history 再構成の前提を守ること**: 1 ターンにつき `TurnStarted` → `TargetRevealed` → 各プレイヤー 1 回の `Submitted` → `AuctionResolved` → `NumberChosen` の順序・一意性で発行する。順序やカーディナリティが崩れると `buildHistory` が静かに誤った `PublicTurnRecord` を返す(view 側はチェックしない)。#7 の determinism/イベント列テストでこの前提を固定するのが望ましい。
