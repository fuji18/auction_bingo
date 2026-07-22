# 設計

## 方針

`GameState` → `PublicView` / `SecretView` の射影を純粋関数として `core/view.ts` に置く。型(`PublicView` / `SecretView` / `PublicTurnRecord`)は #4 で `core/types.ts` に定義済みなので、本チケットは**射影ロジック**と、`Agent` インターフェースの正しい配置(`agents/types.ts`)に集中する。

## モジュール構成

### `src/core/view.ts`

```typescript
export function toPublicView(state: GameState): PublicView;
export function toSecretView(state: GameState, playerId: PlayerId): SecretView;
```

- `toPublicView`: 全員共通。秘匿フィールド(`deck` 中身・`submissions`・`visionPeek`)を**構造的に含めない**。
  - `deckSize = state.deck.length`(中身は渡さない)
  - `players[].reserved = state.reserved[id] ?? 0`
  - `history` は `state.log` から再構成(下記)
- `toSecretView`: `{ playerId, visionPeek }`。他者分は参照しようがない(引数の `playerId` のみ射影)。`GameState.visionPeek` は「予知なし」を**空配列**で持つが、`SecretView.visionPeek` は型定義どおり「予知成功ターンのみ number[]、無ければ null」なので、**空配列は null に正規化**する。

### history の再構成(`state.log` が唯一の源)

`GameState` は過去ターンの記録を専用フィールドで持たず、`log: GameEvent[]` が真実の源(`reduce` はイベント列を必ず返す設計)。`history` はログを走査して**開札済みターンのみ**を `PublicTurnRecord` に組み立てる。

- ターン境界: `TurnStarted.turn`
- `target`: `TargetRevealed.target`
- `submissions`: そのターンの `Submitted` イベント(全員分)
- `winner`: `AuctionResolved.winner`(無ければ `null`)
- `chosen`: `NumberChosen.value`(無ければ `null`)
- **採録条件**: そのターンに `AuctionResolved` が存在すること(= 開札済み)。開札で提出が公開されるため、この条件が「進行中ターンの提出内容を露出しない」バリアと一致する。`submitting` フェーズの現ターンは `AuctionResolved` を持たないので history に出ない。

> 注: この再構成は `reduce`(#7)が上記イベントを発行することを前提とする。イベント型自体は #4 で確定済み(`GameEvent`)。view.test は手組みログでこの前提を固定する。

### `src/agents/types.ts`

```typescript
import type { PublicView, SecretView, SkillId } from '../core/types';

export interface Agent {
  submit(pub, sec): { skill: SkillId | null; bid: number };
  chooseNumber(pub, sec, candidates: number[]): number | null;
  selectVision(pub, sec, peeked: number[]): number;
  tell(pub, sec): string;
}
```

- #4 が暫定的に `core/types.ts` へ置いた `Agent` を本ファイルへ移設し、`core/types.ts` から削除する。
- `PublicView` / `SecretView` / `PublicTurnRecord` は**データモデルなので `core/types.ts` に残す**(`repository-structure.md`「型定義は core/types.ts に集約」)。`Agent` だけは意思決定層のインターフェースなので `agents/` が所有する(同ドキュメントが `agents/types.ts = Agent インターフェース` と明示)。
- 層依存: `agents/` は `core/` の型に依存可(eslint の `no-restricted-imports` は ui/sim/svelte のみ禁止)。逆に `core/` からの `agents/` 参照は禁止なので、`Agent` を core から抜くことで依存の向きも正される。

## テスト

### `tests/informationBarrier.test.ts`(統合)
- `toPublicView` の返り値(および JSON シリアライズ結果)に `deck` の中身が含まれない
- 他プレイヤーの `submissions` / `visionPeek` が含まれない(値・キーとも)
- `history` が開札前ターンの提出を含まない(submitting フェーズの fixture で確認)

### `src/core/view.test.ts`(単体)
- `deckSize` が `deck.length` と一致し、`deck` 配列は露出しない
- `players[].reserved` が `state.reserved` から正しく引かれる
- `toSecretView(state, 'p0')` が p0 の visionPeek のみ、予知なしターンは `null`
- history 再構成: 開札済みターンのみ・フィールドが正しい・パス(chosen=null)を表現できる

## フィクスチャ方針

`reduce` 未実装のため、`DEFAULT_CONFIG` + `createBoard` で最小の `GameState` を手組みするヘルパ(テスト内 `makeState`)を用意し、`log` を明示的に与えて射影のみを検証する。

## スコープ外

- CPU 実装 / `reduce` / UI。view は純粋な射影に限定する。
