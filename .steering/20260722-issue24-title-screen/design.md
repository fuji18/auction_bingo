# design — issue #24 タイトル画面と画面遷移

## 現状
- `App.svelte` は対戦画面のみ。マウント時に `new Game()` が **constructor で restoreOrNew()** を呼び、
  セーブがあれば復元・無ければ新規作成し、いずれも即 persist(保存)する。
- そのため「起動しただけでセーブが必ず存在する」状態になり、タイトルの「つづきから」条件付き提示が成立しない。
- 決着後の遷移は `resultView: 'result' | 'replay'` と「新しいゲーム」(もう一度)のみ。「タイトルへ」が無い。

## 方針
Game のライフサイクルを「自動開始」から「明示開始」に変え、画面状態は App が持つ。
core にルール判断を持ち込まない原則は不変(Game/App は reduce の結果を読むだけ)。

### 1. `game.svelte.ts` — 開始を明示化
- constructor から `restoreOrNew()` 呼び出しを削除。構築時はゲームを開始も保存もしない。
  `state` フィールドは型健全性のためのプレースホルダ `createGame(DEFAULT_CONFIG, 1)` のまま(タイトル画面では盤面を描画しないので未使用)。
- `hasSave(): boolean` を追加。`loadGame(storage) !== null`。タイトルの「つづきから」表示条件。
- `resume(): boolean` を追加。旧 `restoreOrNew` の復元枝のみ。復元成功で true、
  セーブ無し・破損なら false(破損時は `clearGame` して false)。新規への自動フォールバックはしない。
- `newGame(seed?)` は現状維持(はじめる / もう一度で使用)。
- 旧 `restoreOrNew()` は削除。

### 2. `App.svelte` — 画面状態
- `let screen = $state<'title' | 'playing'>('title')`。起動時は 'title'。
- `let canContinue = $state(game.hasSave())`。`game.hasSave()` は localStorage 直読みで
  runes の依存追跡外なので `$derived` にはできない。タイトルに入る/戻る(`goTitle`)と
  `resume()` 失敗直後に明示的に再評価する。
- タイトル画面(`screen === 'title'`):
  - ゲームタイトル + 簡単な説明
  - 「はじめる」ボタン → `game.newGame(); screen = 'playing'`
  - `canContinue` のとき「つづきから」ボタン → `if (game.resume()) screen = 'playing'`
    (復元失敗時は title に留まり `canContinue = game.hasSave()` で再評価。安全側の実装)
- 対戦画面(`screen === 'playing'`): 既存のマークアップをそのまま `{:else}` 側へ。
- ResultPanel に「タイトルへ」を追加:
  - `ontitle: () => void` prop を追加し、App では `screen = 'title'` にする。
  - 決着時は persist が既にセーブを破棄済み → タイトルに戻っても「つづきから」は出ない(整合)。
  - 「もう一度」= 既存の `onnewgame`(新しいゲーム)を維持。

### セーブ整合の要点
- 起動は常に Title(`[*] --> Title`)。進行中セーブがあれば「つづきから」で復元、無ければ「はじめる」のみ。
- はじめる = `newGame()` が新規作成し保存を上書き。つづきから = `resume()` が同 seed+actions を再計算。
- 決着で save は破棄されるため、Result→Title 後の再訪で continue は出ない。

## テスト方針(`game.test.ts` 更新)
Game のライフサイクル変更に合わせて調整(回帰カバレッジは維持):
- 決着到達: `new Game()` → `newGame()` → 決着まで。
- 保存/復元: `newGame()` で数手 → 別インスタンス + `resume()` で一致。
- 破損セーブ: `hasSave()` が false・`resume()` が false。
- 新規追加: 構築直後はゲーム未開始・未保存(`hasSave()` false)。
- tendency / 不正手 no-op: `newGame()` 開始後に検証。

## 影響ファイル
- `src/ui/game.svelte.ts`(開始明示化)
- `src/ui/App.svelte`(画面状態・タイトル UI・ontitle 配線)
- `src/ui/components/ResultPanel.svelte`(タイトルへボタン)
- `src/ui/game.test.ts`(API 変更追従)
