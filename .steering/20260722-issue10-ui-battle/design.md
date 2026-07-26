# 設計

Issue #10: UI 対戦画面

## 全体方針

`sim/play.ts` の `playOne` が「UI 非経由で core を最後まで駆動する」参照実装。UI 版は同じオーケストレーションを、人間(p0)の手番だけ UI 入力に置き換えて行う。UI は**描画とアクション送出のみ**で、ルール判断(合法性・落札者・ビンゴ)は一切持たない。

```
App.svelte
  └ game.svelte.ts   … GameState を $state で保持し reduce を呼ぶ + CPU 自動進行 + localStorage
       ├ core/reduce  createGame / reduce / legalActions / previewCandidates(新規)
       ├ core/view    toPublicView / toSecretView
       ├ core/board   lineHighlights(新規, リーチ/完成セル)
       ├ agents/registry  leo(p1) / sara(p2)
       └ storage.ts   save / load / clear（seed + actions）
```

## core への追加(read-only 純粋クエリ 2 件)

「UI にルール判断を書かない」を満たすため、リーチ/完成の判定とスキルの候補プレビューは**ルール由来なので core が所有**する。どちらも状態を変えない純粋関数で、`legalActions` と同じ「UI のためのクエリ」カテゴリ。UI 側で再実装するとルールの二重定義になるため core に置く。

- `board.ts` に `lineHighlights(board): { reach: boolean[][]; complete: boolean[][] }`
  - `LINE_INDICES` を走査し、4 マークのライン(=リーチ)に属するセルと 5 マーク(=完成)に属するセルを `board` と同形の boolean グリッドで返す。BoardView がハイライトに使う。
- `reduce.ts` に `previewCandidates(state, skill): number[]`
  - `submitting` フェーズで「そのスキルを買うと選べるようになる数字」= `target ± skillRange(skill)` を `numberBounds` でクランプして返す(`openAuction` の候補算出と同一ロジック)。SubmitPanel のハイライトに使う。
  - `submitting` 以外・`skill` が不変(range 0)でも安全に返す。

いずれも core のユニットテスト(`board.test.ts` / `reduce.test.ts`)に最小ケースを追加する。

## `game.svelte.ts`(runes・オーケストレーション)

```ts
class Game {
  state = $state<GameState>(...)
  actions: Action[] = []            // 適用した全アクション（save/復元用）
  seed: number
  private agents = { p1: leo, p2: sara }

  // 公開 API（UI から呼ぶ人間の手番）
  newGame(seed?)                    // 破棄→createGame→save→driveCpu
  submit(skill, bid)                // apply(SUBMIT p0) → driveCpu → save
  selectVision(keep)                // apply(SELECT_VISION p0) → driveCpu → save
  choose(value | null)              // apply(CHOOSE p0) → driveCpu → save

  // 表示用ゲッター（$derived 相当）
  pub()  = toPublicView(state)
  myLegal() = legalActions(state, 'p0')
  tellOf(cpuId) = agents[cpuId].tell(pub, toSecretView(state, cpuId))
}
```

- `apply(action)`: `reduce(state,[action])` → `state` 更新・`actions.push`。events を「直近ログ」として保持。
- `driveCpu()`: `state.phase !== 'finished'` かつ「人間入力待ちでない」間、現フェーズの CPU 手番を 1 件ずつ `apply`。停止条件は下表。
- 手番判定は **phase と core が出した結果(auctionWinner・submissions・visionPeek)を読むだけ**でルール判断ではない(sim/play.ts と同じ)。

| phase | 人間入力待ち(driveCpu 停止) | CPU 手番の相手 |
|---|---|---|
| submitting | p0 が未提出 | 未提出の p1/p2 → `agent.submit` |
| vision | `visionPeek.p0` が非空 | peek を持つ CPU → `agent.selectVision` |
| choosing | `auctionWinner === 'p0'` | `auctionWinner`(CPU) → `agent.chooseNumber` |
| finished | —(停止) | — |

- 秘密の同時性は保たれる: CPU は `PublicView`(他者の submissions を含まない)しか見ないため、人間が先に提出しても CPU の入札に影響しない。人間は開札(`AuctionResolved`)まで CPU の入札額を見ない。
- CPU テル表示のため `toSecretView(state, cpuId)` を UI が参照するが、P0 はクライアント完結で守るべき対戦相手がいない(docs「セキュリティ考慮事項」で対策しないと明記)。tell の戻り値は 1 語の気分のみ。

## `storage.ts`(localStorage 退避)

- 副作用テスト容易化のため `Storage` を引数注入(既定 `localStorage`)。node 環境の in-memory フェイクでテスト可能にする(jsdom 依存を足さない)。
- `SAVE_KEY = 'auction-bingo:save'`、`SAVE_VERSION = 1`。
- `saveGame(storage, seed, actions)`: `{ version, seed, actions }` を JSON 保存。
- `loadGame(storage): { seed, actions } | null`: パース失敗・version 不一致・形不正で `null`。
- `clearGame(storage)`。
- 復元の妥当性(reduce が失敗しないか)は `game.svelte.ts` 側で try/catch し、失敗時 `clearGame` → `newGame`。

## コンポーネント

- `BoardView.svelte`: props `board`, `compact?`, `highlight?: number[]`(プレビュー/落札候補の視認用), `label?`。`lineHighlights` で完成 > リーチ > マーク(FREE は別記号)> 未マークの優先で表示。**色 + 記号**(●=マーク, ★=FREE, 枠線=リーチ/完成, 金枠=highlight)。compact 時は数字を省きマークとリーチ/完成ラインのみ強調。**盤面はクリックさせず表示専用**(候補は App 側のボタンで選ぶ。落札候補が自盤面に無いこともあるため盤面クリックでは選べない)。
- `SubmitPanel.svelte`: props `legal`(submitting の ActionSpec), `coins`, `onhighlight(nums)`, `onsubmit(skill,bid)`。スキルボタン(コスト表示・`options` に無い=買えないものは disabled)、入札スライダー(max=選択スキルの `maxBid`)、入札可能額表示、徴収タイミングの注記。スキル選択で `previewCandidates` を親へ通知し盤面ハイライト。
- `TellBadge.svelte`: props `text`。CPU 名の横の 1 語バッジ。
- `ResolveLog.svelte`: props `events`, `names`。`GameEvent[]` を日本語 1 行へ整形して直近数件表示。整形は純粋関数 `formatEvent`(このコンポーネント内 or 小モジュール)。
- `TokenMark.svelte`: props（なし/小）。優先権トークンのアイコン。

予知選択・数字選択・パスの UI は専用コンポーネントを作らず、`App.svelte` 内のインライン節(候補ボタン列)で実装する(指定コンポーネント集合を増やさない)。「入札可能額(maxBid)」はヘッダではなく `SubmitPanel` 内に表示する(スキル選択で変わるため提出 UI に併記した方が分かりやすい)。

## `App.svelte` レイアウト(縦 375px 基準)

```
[ターン n/max                🪙coins(予約 r)]
[        ターゲット  T        ]
[あなた  🪙  [盤面(等倍)]           ]
[レオ  🪙 [盤面(縮小)] 「テル」 🔺token]
[サラ  🪙 [盤面(縮小)] 「テル」        ]
[── phase 別入力 ──]
  submitting: SubmitPanel
  vision:     予知 3 枚から 1 枚を選ぶ(peeked ボタン)
  choosing:   候補数字のボタン列 + [パス](自盤面には候補を金枠でハイライト)
  finished:   「ゲーム終了」+[新しいゲーム]（リッチな結果は #11）
[ResolveLog 直近数件]
```

- CSS は `global.css` + 各コンポーネント scoped。`max-inline-size`・グリッド・相対単位でレスポンシブ。色覚配慮のため記号併用。

## 依存・制約の担保

- `ui/` から `sim/` を import しない(ESLint `no-restricted-imports` で既に禁止)。
- ルール判断は `legalActions`/`reduce`/`previewCandidates`/`lineHighlights`(全て core)に委譲。UI は結果を描画するだけ。
- `Math.random`/`Date.now` は UI では seed 生成にのみ許容(core は不使用のまま)。新規ゲームの seed は UI 層で生成する。

## テスト方針

- `storage.test.ts`: 保存→読込の往復一致、version 不一致で null、破損 JSON で null、clear。
- core 追加分: `lineHighlights`(リーチ/完成の 1 ケース)、`previewCandidates`(shift=±1・vision=range0・境界クランプ)。
- コンポーネントの重い DOM テストは課さない(`ui/` はカバレッジ目標なし)。手番駆動の妥当性は `sim/play.ts` の既存テストと同型ロジックで担保。build/typecheck/lint で回帰を検出。
