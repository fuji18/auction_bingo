# タスクリスト

## 🚨 タスク完全完了の原則

全タスクが `[x]` になるまで作業を継続する。未完了タスクを残したまま振り返りを書かない。

---

## フェーズ1: リプレイの純粋ロジック(replay.ts)

- [x] `src/ui/replay/replay.ts` を作成
  - [x] `TurnReplay` 型を定義(turn/target/income/submissions/vision/visionConflict/auction/chosen/marked/settled/refunds)
  - [x] `groupTurns(log: GameEvent[]): TurnReplay[]` を実装(TurnStarted 区切り・防御的整形・GameFinished は無視)
  - [x] ラベル定数を集約(`PLAYER_NAMES` / `SKILL_LABELS` / `DECIDED_BY_LABELS`。SubmitPanel と表記一致)

## フェーズ2: リプレイのテスト(replay.test.ts)

- [x] `src/ui/replay/replay.test.ts` を作成
  - [x] シード固定で Game を決着まで自動プレイし log を取得するヘルパ
  - [x] ターン数が result.turn と一致することを検証
  - [x] 各ターンの submissions が人数分あり skill/bid が一致することを検証
  - [x] 精算(Settled)のあるターンで内訳が取れることを検証
  - [x] 予知が発生するシードで vision(peeked 3枚・kept)の開示を検証
  - [x] 同一シード 2 回で groupTurns が決定的に一致することを検証
  - [x] DECIDED_BY_LABELS が 5 種すべてのキーを持つことを検証

## フェーズ3: 決着画面(ResultPanel.svelte)

- [x] `src/ui/components/ResultPanel.svelte` を作成
  - [x] props: result(GameResult)/ onreplay / onnewgame(名前は replay.ts の playerName で解決)
  - [x] 勝者表示(単独 / 引き分け複数)
  - [x] 決着基準(DECIDED_BY_LABELS)と kind の補足表示
  - [x] 順位表(名前 / 完成ライン / リーチ / マーク / コイン、勝者行を強調)
  - [x] 「リプレイを見る」「新しいゲーム」ボタン

## フェーズ4: リプレイ画面(ReplayView.svelte)

- [x] `src/ui/replay/ReplayView.svelte` を作成
  - [x] props: log(GameEvent[]) / onback
  - [x] groupTurns で各ターンをカード描画(提出・予知開示・落札・選択・マーク・精算・返金)
  - [x] 「決着画面に戻る」ボタン
  - [x] log 空時のフォールバック表示

## フェーズ5: App.svelte 改修

- [x] finished 分岐の暫定表示を撤去
- [x] `view: 'result' | 'replay'` state を追加し ResultPanel / ReplayView を出し分け
- [x] 新規ゲーム開始で view='result' に戻す

## フェーズ6: 品質チェックと修正

- [x] `/check`(test-runner に委譲)で lint・型・test・format が全てパスすることを確認(177 tests パス)
- [x] `npm run build` が通ることを確認(受け入れ条件)
- [x] code-reviewer の指摘(minor)対応: 予知の枚数を peeked.length 表示に、精算 0 分配のフォールバック追加、repository-structure.md のツリー更新

## フェーズ7: ドキュメント更新

- [x] README.md 更新の要否を確認 → 不要(コマンド早見表・構成の記述に影響なし。構成図は docs/repository-structure.md 側を更新済み)
- [x] 実装後の振り返り(このファイル下部に記録)

---

## 実装後の振り返り

### 実装完了日
2026-07-22

### 計画と実績の差分

**計画と異なった点**:
- リプレイのデータ源は「seed+actions を reduce で再計算」と Issue に書かれていたが、`GameState.log` が既に全ターンの events を蓄積している(`reduce.ts` の `log: [...s.log, ...events]`)ため、再計算は不要で `game.state.log` をそのまま groupTurns へ渡す形にした。同じ events 列を ResolveLog も読むので「ゲーム中の表示と矛盾しない」が構造的に保証される。
- ResultPanel の名前解決は props で players を渡す設計だったが、replay.ts に PLAYER_NAMES を集約したため playerName() で解決でき、props を削減した。
- 決着基準ラベルなど表示ラベルを replay.ts に集約し、ResultPanel/ReplayView 双方から参照した。

**新たに必要になったタスク**:
- code-reviewer 指摘対応: 予知の覗き枚数ハードコード(3枚)を peeked.length へ、入札0落札時の精算表示の空欄フォールバック、repository-structure.md の ui/replay ツリー更新。

### 学んだこと

- 「リプレイ = events 列の再生」という設計(functional-design「リプレイ・ログ・UI 演出のすべてがこのイベント列から復元される」)が効いており、UI 側に追加のルール判断が一切要らなかった。純粋関数 groupTurns + Svelte 表示の薄い分離でテスト容易性も確保できた。
- 予知の全開示を発生させるテストは、人間役に予知を優先購入させる方針で決定的に再現できた(seed 2024)。

### 次回への改善提案
- 表示ラベル(プレイヤー名・スキル名)が App.svelte のインライン定義・SubmitPanel・replay.ts に分散している。UI 層共通の labels モジュールへ一元化するとドリフト防止になる(今回はスコープ外)。
