# タスクリスト

Issue #10: UI 対戦画面

## フェーズ1: core への read-only クエリ追加

- [x] `board.ts` に `lineHighlights(board): { reach; complete }` を追加(LINE_INDICES 走査)
- [x] `reduce.ts` に `previewCandidates(state, skill): number[]` を追加(target ± skillRange をクランプ)
- [x] `board.test.ts` に `lineHighlights` のテスト追加(リーチ/完成/どちらでもない)
- [x] `reduce.test.ts` に `previewCandidates` のテスト追加(shift=±1・vision=range0・境界クランプ)

## フェーズ2: 永続化(storage)

- [x] `src/ui/storage.ts`: `saveGame`/`loadGame`/`clearGame`(Storage 注入・version 判定)
- [x] `src/ui/storage.test.ts`: 往復一致・version 不一致・破損 JSON・clear(node 環境フェイク Storage)

## フェーズ3: state 保持と手番駆動

- [x] `src/ui/game.svelte.ts`: `$state` の GameState 保持・`apply`・`driveCpu`・`newGame`/`submit`/`selectVision`/`choose`・表示ゲッター
- [x] 復元ロジック(loadGame → reduce 再計算、失敗時 clear→newGame)

## フェーズ4: コンポーネント

- [x] `src/ui/components/TokenMark.svelte`: 優先権トークンのアイコン
- [x] `src/ui/components/TellBadge.svelte`: CPU テルのバッジ
- [x] `src/ui/components/BoardView.svelte`: 5x5 盤面(色+記号・リーチ/完成・ハイライト・compact)
- [x] `src/ui/components/SubmitPanel.svelte`: スキル選択+入札スライダー+入札可能額+徴収注記+ハイライト通知
- [x] `src/ui/components/ResolveLog.svelte`: GameEvent の日本語整形と直近表示

## フェーズ5: 画面統合

- [x] `src/ui/App.svelte`: ヘッダ/ターゲット/3プレイヤー行/phase 別入力(提出・予知・選択・パス・終了)/ログの統合
- [x] スキル選択→自盤面ハイライト、choosing→候補ボタン+自盤面ハイライトで選択の配線
- [x] 375px 縦画面のレスポンシブ CSS(色覚配慮の記号併用)
- [x] （計画外・追加)`src/ui/game.test.ts`: ドライバの end-to-end スモーク(決着到達・保存/復元・破損破棄・不正手 no-op)

## フェーズ6: 品質チェック

- [x] `/check`(test-runner に委譲)で lint/typecheck/test/format がパス
- [x] `npm run build` が通る
- [x] `npm run dev` が HTTP 200 で配信されることを確認(dev サーバ起動確認)
- [x] ~~ブラウザでの 375px 目視確認~~(この環境にブラウザ描画手段が無いため未実施。ロジックは game.test.ts の end-to-end スモークで担保。ユーザーに手元 `npm run dev` での目視を申し送り)

## フェーズ7: 検証・記録

- [x] code-reviewer によるレビュー(依存方向・ルール判断の非混入・スペック整合)→ 0 critical / 2 major / 5 minor。major 2 件と minor の一部に対応
- [x] 実装後の振り返り(このファイル下部に記録)

---

## 実装後の振り返り

### 実装完了日
2026-07-22

### 計画と実績の差分
- **core に read-only クエリを 2 件追加**(`lineHighlights`/`previewCandidates`)。「UI にルール判断を書かない」を満たすため、リーチ/完成判定と候補プレビューをルール由来として core に集約した(計画どおり)。#5/#7 完了後の core 追加だが、いずれも状態を変えない純粋クエリで `legalActions` と同カテゴリ。
- **choosing の入力方式を変更**: 当初 design.md は「自盤面の候補クリック」としたが、落札候補(target±range)は自盤面に無いこともあり盤面クリックでは選べない。App 側の候補ボタン列 + 自盤面の金枠ハイライトに変更し、`BoardView` は表示専用にした(design.md も訂正済み)。
- **計画外の追加テスト**: `src/ui/game.test.ts`(ドライバの end-to-end スモーク)。ブラウザ目視ができない環境のため、決着到達・保存/復元・破損破棄・不正手 no-op をロジックで担保。
- **code-reviewer 指摘対応**: (Major)`driveCpu` に no-op 検知の中断を追加し同期無限ループを防止/`eslint.config.js` に `ui/`→`sim/` 禁止を追加(design.md の記載と実態を一致)。(Minor)復元後も直近ターンの解決ログを表示(`lastTurnEvents`)。

### 学んだこと・次回への申し送り
- **#11(決着画面・リプレイ)への土台は整っている**: セーブ形式は seed + 全アクションで、`reduce(createGame(seed), actions)` で完全再現できる。リプレイは同じ actions を 1 手ずつ再生すれば良い。決着時は現状「勝者/引き分けの最小表示 + 新規ゲーム」のみ。`ResultPanel`/`ReplayView` で `GameResult.decidedBy`・`standings`・全ターンの `log` を開示する。
- **ブラウザ目視は未実施**(この環境に描画手段が無い)。ユーザーに手元 `npm run dev`(:4330)での 375px 目視(3盤面・提出・予知・落札選択・パス・終了・リロード復元)を申し送る。
- CPU テル表示のため UI が `toSecretView(state, cpuId)` を参照している。P0 はクライアント完結で対策しない方針だが、P1 サーバー化時は tell を PublicView だけで導けるよう見直す必要がある。
