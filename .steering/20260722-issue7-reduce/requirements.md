# 要求内容

## 概要

ゲームの唯一の状態遷移である `core/reduce.ts` を実装する。`createGame` / `reduce` / `legalActions` を提供し、提出から次ターン開始までの7ステップを決定的に処理する、本プロジェクトの中核。

## 背景

UI・CPU・シミュレーションのすべてがこのリデューサを呼んで state を進める。ルール判断はここにしか存在しない(UI・agents はルールを持たない)。決定性(同一 seed+actions → 同一 state・events)とコイン保存則がプロジェクトの根幹要件であり、UI を1行も書く前にこのリデューサ単体で数値検証できる状態にする。

参照: GitHub Issue #7、`docs/functional-design.md`「2. ターン解決」「3. タイブレーク判定」「core/reduce.ts」節、`docs/development-guidelines.md`「reduce は入力 state を破壊しない」節。

## 実装対象の機能

### 1. `createGame(config, seed): GameState`
- config を検証(`validateConfig`)し、seed から RNG を初期化する。
- 3 人分の盤面を `createBoard` で生成する。
- 山札 `deck` を [1..40](= 全列範囲の和)のシャッフルで生成する。
- ターン1のステップ0(収入加算・上限切り捨て・トークン回転・target 公開)まで進め、`phase='submitting'` の初期 state を返す。
- `TurnStarted` / `TargetRevealed` イベントは `log` に積む。

### 2. `reduce(state, actions): { state, events }`
- アクション列を順に適用し、内部の決定的ステップ(予知競合解決・開札・精算・ビンゴ判定・次ターン開始)を自動で進めつつ、外部入力が必要な地点(提出収集・予知選択・数字選択)で停止する状態機械。
- 7ステップを `docs` の順で厳守する。
- 入力 state を破壊せず、常に新しい state と、その呼び出しで発生した events を返す。
- 不正・フェーズ不一致のアクションは state を変えず events にも残さない。

### 3. `legalActions(state, playerId): ActionSpec`
- 現在の phase とプレイヤーに対して取り得る合法アクションの範囲を返す(UI の入力ガード用)。
- submitting: 選べるスキルと、各スキルでの入札可能上限(coins - cost)。
- vision: 予知成功者が選べる peeked 3枚。
- choosing: 落札者が選べる candidates(範囲外除外済み)+ パス。

## 受け入れ条件

### ターン解決の正しさ
- [ ] 予知が今ターンの target に影響しない(target はステップ0で山札から抜済み)
- [ ] スキル代の予約: 予約分が入札に使えない / 偏向・強奪は落札時のみ徴収・落札失敗で返金 / 予知は即時徴収
- [ ] 候補の範囲外除外(target=1 で強奪なら {1,2,3}、target=40 で {38,39,40})。列またぎは許す
- [ ] 分配 floor(bid/4) と銀行回収額の合計が入札額に一致
- [ ] パス時に誰もマークしない / 同時ビンゴが draw-bingo
- [ ] タイブレークの4段階(reachCount→markCount→coins→draw)と decidedBy が正しい
- [ ] 予知競合(2人/3人)がトークン順で解決され、敗者に全額返金される

### 不変条件(テストで担保)
- [ ] 同一 (seed, actions) から同一 state・events が再現される(determinism.test.ts)
- [ ] コイン保存則: 全員のコイン + 銀行 + 消滅分 = 初期総額 + 総収入(coinConservation.test.ts)
- [ ] reduce が入力 state を破壊しない / 不正アクションは state を変えず events にも残さない
- [ ] createGame(config, seed) → reduce(..., actions) の再計算がセーブ復元と一致(saveRestore.test.ts)

### 品質ゲート
- [ ] `npm test` / `npm run typecheck` / `npm run lint` が通る
- [ ] `npm run build` が通る

## 成功指標

- 境界値(target=1/40、コイン上限、入札0、全員0、予知競合2人/3人)がすべてテストで固定される。
- reduce.ts が 500 行を超える場合は `core/resolve/` に分割し、エクスポートは reduce 1つに保つ。

## スコープ外

以下はこのフェーズでは実装しません:

- CPU の意思決定(#8)
- シミュレーション基盤(#9)
- UI(#10)・決着画面/リプレイ(#11)

## 参照ドキュメント

- `docs/functional-design.md` -「2. ターン解決」「3. タイブレーク判定」「core/reduce.ts」「1ターンの進行」節
- `docs/development-guidelines.md` -「最優先の規約 — 決定性」「reduce は入力 state を破壊しない」節
- `docs/architecture.md` -「core/ レイヤー」節
