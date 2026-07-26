# 要求内容

Issue #10: UI 対戦画面(P0 / フェーズ3 / depends #7)

## 概要

プレイヤーが実際に遊ぶ対戦画面(`src/ui/`)を実装する。ルール判断は UI に一切書かず、`core/reduce` を呼んで `state` を描画し、`legalActions` が返す範囲でのみアクションを送る。CPU(p1=レオ / p2=サラ)の手番は `agents/` を介して自動で進める。進行中ゲームは `localStorage` に seed+actions で退避し、リロードで失われないようにする。

## 背景

`core/`(#4〜#7)と `agents/`(#8)、`sim/`(#9)が揃い、ルールとバランスは数値で確認済み。残るは人間が遊ぶ UI。設計の中核制約「`ui/` → `core/`・`agents/` の一方向依存」「ルール判断を UI に書かない」を守り、P1 のサーバー化(`core/` 無改変移送)を壊さないことが最優先。根拠: docs/functional-design.md「UI設計」「ファイル構造(データ保存)」/ docs/architecture.md「`ui/` レイヤー」/ docs/repository-structure.md「`src/ui/`」。

## 実装対象の機能

### 1. state 保持と手番駆動(`game.svelte.ts`)
- runes(`$state`)で現在の `GameState` を保持し、`reduce` を呼ぶだけ
- 人間(p0)の手番を待ち、CPU(p1/p2)の手番は `agents/` の Agent で自動進行(`sim/play.ts` と同型のオーケストレーション)
- 適用した全アクションを記録し、リロード復元とセーブに使う

### 2. localStorage 退避・復元(`storage.ts` / `storage.test.ts`)
- `{ version, seed, actions[] }` を `localStorage` に保存
- 復元は `reduce(createGame(config, seed), actions)`。version 不一致・破損・reduce 失敗時は破棄して新規

### 3. 対戦画面(`App.svelte` + `components/`)
- ヘッダ(ターン `n / max`・手持ちコイン・入札可能額)
- ターゲット `T` の大きな表示
- 3 プレイヤー行(名前・コイン・盤面・CPU テル・優先権トークン)
- 提出 UI(スキル選択 + 入札スライダー)/ 予知選択 UI / 数字選択 UI(phase 駆動)
- 直近の解決ログ
- スキル選択時に「選べるようになる数字」を自分の盤面上でハイライト

### 4. 盤面表示(`BoardView.svelte`)
- 自分は等倍、相手は縮小
- 未マーク / マーク済み / FREE / リーチライン / 完成ラインを**色と記号の両方**で区別

## スコープ外(やらないこと)

- 決着画面・試合後リプレイ(#11。本チケットでは終了時に最小の「ゲーム終了」表示 + 新規開始のみ)
- ルール判断の UI 実装(禁止。落札者判定・ビンゴ判定・入札の合法性判定は `core/` に委ねる)

## 受け入れ条件

### レイアウト・表示
- [ ] 幅 375px の縦画面で 3 盤面と提出 UI が破綻しない
- [ ] スキル代を除いた入札可能額が表示され、超過入札ができない(`legalActions` の `maxBid` でガード)
- [ ] 予約したコストの徴収タイミングの違い(偏向/強奪=落札時・予知=即時)が UI 上で分かる
- [ ] マーク済み・FREE・リーチが色と記号の両方で区別される(色のみに依存しない)
- [ ] 優先権トークンの位置と CPU のテルが表示される

### 進行・永続化
- [ ] リロードで進行中ゲームが失われない / 破損セーブは破棄して新規開始
- [ ] スキル選択時に選べる数字が自分の盤面でハイライトされる

### 設計制約
- [ ] UI にルール判断(落札者判定・ビンゴ判定等)を実装していない(`core/` の `legalActions`/`reduce` に委ねる)
- [ ] `ui/` は `core/`・`agents/` のみに依存し、`sim/` に依存しない

### 品質
- [ ] `npm run build` / `npm run typecheck` / `npm run lint` が通る
- [ ] `storage.ts` のユニットテストが通る
