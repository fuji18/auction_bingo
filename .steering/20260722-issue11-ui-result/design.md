# 設計書

## アーキテクチャ概要

決着画面とリプレイは新規ロジックを一切持たず、**core が確定させた `GameState.result` と `GameState.log`(全 `GameEvent[]`)を描画するだけ**の薄い表示層とする。これは既存 UI 層の設計(「ルール判断は core、UI は結果を読むだけ」)の踏襲であり、「リプレイが同一シードから決定的に再現され、ゲーム中の表示と矛盾しない」受け入れ条件を構造的に保証する(同じ events 列を ResolveLog もリプレイも読むため)。

```
App.svelte (phase==='finished')
  ├─ ResultPanel.svelte      ← game.state.result を表示
  │     └─(「リプレイを見る」)→ ReplayView.svelte
  └─ ReplayView.svelte       ← game.state.log を表示
        └─ replay.ts         ← GameEvent[] をターン単位へ分割する純粋関数(テスト対象)
        └─ labels.ts 相当     ← プレイヤー名/スキル名/decidedBy ラベル(replay.ts に集約)
```

state.log は reduce が全ターン蓄積する(`reduce.ts` の `log: [...s.log, ...events]`)。Submitted は全員の skill/bid、VisionResolved は peeked/kept、Settled は payer/paid/received/toBank を含むため、これ一本で全開示が成立する。

## コンポーネント設計

### 1. `ui/replay/replay.ts`(純粋ロジック + ラベル)

**責務**:
- `groupTurns(log: GameEvent[]): TurnReplay[]` — 全ログを `TurnStarted` を区切りにターン単位へ分割し、表示に必要な形へ整形する
- 表示ラベルの一元管理: `PLAYER_NAMES`(p0=あなた/p1=レオ/p2=サラ)・`SKILL_LABELS`(なし/偏向/予知/強奪)・`DECIDED_BY_LABELS`(bingo=ビンゴ達成 等)

**TurnReplay の形(案)**:
```ts
interface TurnReplay {
  turn: number;
  target: number;
  income: number;
  submissions: { playerId; skill; bid }[];   // Submitted から
  vision: { playerId; peeked: number[]; kept: number } | null;  // VisionResolved から
  visionConflict: { winner; refunded } | null; // VisionConflict から(あれば)
  auction: { winner; bid; tiebreak } | null;   // AuctionResolved から
  chosen: { playerId; value: number | null } | null; // NumberChosen から
  marked: { value; markedBy }[] ;              // Marked から
  settled: { payer; paid; received; toBank } | null; // Settled から
}
```

**実装の要点**:
- 純粋関数・core 非依存(core/types の型のみ import)。`Math.random` やタイマー不使用
- 最後の `GameFinished` は決着画面が担うのでターンには畳み込まない(無視)
- ラベルは UI 側に散らさずここへ集約(SubmitPanel の SKILL_LABEL と表記を一致させる)

### 2. `ui/components/ResultPanel.svelte`

**責務**:
- `result: GameResult` と `players`(名前解決用)を props で受け取り、勝者・決着基準・順位表を描画する
- 勝者が単独なら「勝者: 名前」、複数なら「引き分け(名前・名前)」
- 決着基準: `DECIDED_BY_LABELS[result.decidedBy]` を表示。ビンゴ決着かタイムアップ決着かは `result.kind` で補足
- 順位表: `result.standings`(既に順位ソート済み)を表に。列 = 名前 / 完成ライン / リーチ / マーク / コイン
- 導線: 「リプレイを見る」(親へ通知)/「新しいゲーム」(親へ通知)

**実装の要点**:
- ルール判断は持たない。standings は core がソート済みなのでそのまま描画
- 勝者行を強調表示。人間(p0)勝利/敗北で色を変えても良いが最小限で可

### 3. `ui/replay/ReplayView.svelte`

**責務**:
- `log: GameEvent[]` を受け取り `groupTurns` でターン配列へ変換し、各ターンをカードで縦に並べる
- 各ターン: ターン番号・ターゲット、提出(全員の skill/bid)、予知の開示(peeked/kept)、落札(winner/bid/tiebreak)、選択数字(or パス)、マーク、精算(payer/paid/分配/bank)
- 導線: 「決着画面に戻る」(親へ通知)

**実装の要点**:
- 全開示。ResolveLog が伏せる予知内容もここでは peeked/kept を明示する
- 名前・スキル名は replay.ts のラベルを使う

### 4. `ui/App.svelte`(改修)

**責務**:
- `phase==='finished'` のとき、暫定表示を撤去し `ResultPanel` / `ReplayView` を出し分ける
- ローカル state `view: 'result' | 'replay'` を持ち、ボタンで切替。新規ゲーム開始時は `view='result'` に戻す

## データフロー

### 決着 → リプレイ → 戻る
```
1. core が GameFinished を出し phase='finished'、state.result 確定
2. App は view='result' で ResultPanel を描画(result を渡す)
3. ユーザー「リプレイを見る」→ App が view='replay'
4. ReplayView が state.log を groupTurns し全ターンを描画
5. ユーザー「戻る」→ view='result'
6. ユーザー「新しいゲーム」→ game.newGame() し view='result'
```

## エラーハンドリング戦略

- 表示専用のため例外系は最小。`groupTurns` は想定外イベント順でも落ちないよう「対応イベントが無ければ null/空配列」を返す防御的整形にする
- log が空(理論上あり得ない)の場合は空配列を返し、ReplayView は「再生する記録がありません」を出す

## テスト戦略

### ユニットテスト(`ui/replay/replay.test.ts`, Vitest / node 環境)
- シード固定で `Game` を決着まで自動プレイし、`groupTurns(game.state.log)` を検証:
  - ターン数が `result.turn` と一致する
  - 各ターンに submissions が人数分ある / bid・skill が Submitted と一致する
  - 予知が発生したターンで vision(peeked 3枚・kept)が開示される(発生するシードを選ぶ or 発生ターンのみ検証)
  - Settled のあるターンで精算内訳が取れる
  - 同一シードで 2 回流して同一結果(決定的再現)
- ラベルの網羅(decidedBy 5 種のキーが全て定義されている)

### 手動確認
- `npm run dev` で 1 ゲーム決着させ、決着画面 → リプレイ → 戻るの導線と表示崩れ(375px)を確認

## 依存ライブラリ

新規追加なし。

## ディレクトリ構造

```
src/ui/
├ App.svelte                    (改修: finished 分岐を ResultPanel/ReplayView に)
├ components/
│  └ ResultPanel.svelte         (新規)
└ replay/                        (新規ディレクトリ)
   ├ ReplayView.svelte           (新規)
   ├ replay.ts                   (新規: groupTurns + ラベル)
   └ replay.test.ts              (新規)
```

## 実装の順序

1. `replay.ts`(型・groupTurns・ラベル)
2. `replay.test.ts`(決定的再現・全開示の回帰ガード)
3. `ResultPanel.svelte`
4. `ReplayView.svelte`
5. `App.svelte` 改修(view 切替 + 暫定表示の撤去)
6. `/check`(lint/型/test/format)

## セキュリティ考慮事項

- 特になし(ローカル完結の静的サイト、外部送信なし)。リプレイは既に決着したゲームの全開示であり秘匿対象は残らない

## パフォーマンス考慮事項

- log は 1 ゲーム最大 25 ターン程度で軽量。groupTurns は O(n) の単純走査

## 将来の拡張性

- URL 共有(P2)は seed + actions を渡せば同じ log を再構築できる。groupTurns はその際もそのまま使える
