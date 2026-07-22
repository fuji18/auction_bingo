# 設計書

## アーキテクチャ概要

`sim/` は UI を通さず `core/` を直接叩く。層の向きは `sim → agents → core`(逆流禁止、ESLint で強制済み)。

```
run.ts (CLI)  ──parse args──▶  createAgent(registry)  ──┐
   │                                                     ▼
   └── loop seed+i ──▶ play.ts:playOne(agents,config,seed) ──▶ final GameState(state.log)
                                   │                                     │
                                   ▼                                     ▼
                          core/reduce + view                metrics.ts:extractGame ──▶ RawGame[]
                                                                          │
                                                            metrics.ts:summarize ──▶ Metrics ──▶ print
```

## コンポーネント設計

### 1. `play.ts` — 対局ドライバ

**責務**: スロット別 Agent・config・seed で 1 ゲームを finished まで進め、最終 `GameState` を返す。

**実装の要点**:
- `testkit.playGame` の本番版。phase に応じて手番プレイヤーを特定し、`toPublicView`/`toSecretView` を渡して Agent の手を得て `reduce` する。
- 進まない(不正手で no-op)場合に無限ループしないよう guard カウンタで打ち切り、`seed` 付きで throw する(Agent のバグを表面化させる)。
- 最終 `GameState` の `state.log`(全イベント)と `state.result` を集計に使う。

### 2. `metrics.ts` — KPI 集計(純粋関数)

**責務**: 決着済み `GameState` → 1 ゲーム分の生データ `RawGame`、`RawGame[]` → `Metrics`。

**KPI 定義**:
| KPI | 定義 |
|---|---|
| ビンゴ発生率 | `result.kind ∈ {bingo, draw-bingo}` の割合 |
| スキル使用率 | `Submitted` のうち `skill !== null` の割合 |
| 落札×勝率 相関 | 点=(game×player)。x=そのゲームの落札回数, y=勝ち分(勝者なら 1/勝者数, 他 0)。全点のピアソン r |
| 支配的戦略の勝率 | スロット別勝率=Σ勝ち分/games。その最大値(< 50% が目標) |
| 平均決着ターン | mean(`result.turn`) |
| 終盤スキル比率 | `turn > finishTurn-5` の `Submitted` を none/shift/vision/greed で分類し各割合。スキル購入内の最大割合も算出(70% 判定用) |
| パス率 | `NumberChosen.value === null` の割合 |

**実装の要点**:
- `extractGame` は `state.log` を 1 回走査。`TurnStarted.turn` で現ターンを追跡し `Submitted` を終盤判定に紐づける。
- ピアソン r は `n,Σx,Σy,Σxy,Σx²,Σy²` から算出。分散 0 のとき(分母 0)は 0 を返す。
- 落札回数は `AuctionResolved.winner` を数える。勝ち分は `result.winners`(引き分けは 1/人数で按分)。

### 3. `run.ts` — CLI

**責務**: 引数解析 → N 戦ループ → 集計 → レポート出力。

**実装の要点**:
- `--games`(既定 10000)`--seed`(既定 1)`--agents`(既定 `leo,sara,hoarder`、カンマ区切り 3 名)。
- ゲーム i のシードは `baseSeed + i`(基準シードから決定的、かつ多様性を確保)。
- Agent は `agents/registry` の `createAgent` で解決(未知名は throw)。
- 出力は各 KPI の実測値・目標レンジ・PASS/WARN。所要時間も出す。`console` は sim/ のみ許可。

## テスト戦略

### ユニットテスト(`metrics.test.ts`)
- `pearson`: 完全正相関=1 / 完全負相関=-1 / 既知データセット / 分散 0=0。
- `summarize`: 手組みの `RawGame[]` で各 KPI 値を検証(端数・引き分け按分含む)。
- `extractGame`: baseline Agent で実際に 1 ゲーム進め、不変条件を検証
  (`finishTurn===result.turn` / `submittedTotal===3*finishTurn` / `chooseTotal===finishTurn` / 落札回数合計===finishTurn)。

**KPI 閾値そのものはテストしない**(バランス調整で変動するため CI を赤にしない。閾値は run.ts の WARN 表示に留める)。

## 依存ライブラリ

新規の npm 依存は追加しない。TS を直接実行するため、Node 24 の型ストリップ + 拡張子補完 ESM ローダ(`scripts/ts-loader.mjs` + `scripts/register-loader.mjs`)を自作する(zero-dependency)。

## ディレクトリ構造

```
src/sim/
├ play.ts          対局ドライバ
├ metrics.ts       生データ抽出 + KPI 集計(純粋)
├ metrics.test.ts  集計・相関・抽出のテスト
└ run.ts           CLI エントリ
scripts/
├ ts-loader.mjs        extensionless .ts を解決する ESM resolve フック
└ register-loader.mjs  上記を register する --import 用エントリ
package.json          "sim" スクリプト追加
eslint.config.js      scripts/**/*.mjs を node 環境 override に追加
```

## 実装の順序

1. ローダ 2 ファイル + `sim` スクリプト + eslint 追記(実行基盤)
2. `play.ts`
3. `metrics.ts`(型・extractGame・pearson・summarize)
4. `metrics.test.ts`
5. `run.ts`
6. `/check` → 1 万戦実行 → Issue コメント

## パフォーマンス考慮事項

- 1 万戦 5 分以内。1 ゲーム ~18 ターン・各ターン数回の reduce(小配列コピー)で余裕。`RawGame` は小オブジェクトのため 1 万件配列保持で問題ない。

## 将来の拡張性

- P1 サーバー化では `core/` をそのまま移送。`play.ts` の「誰が Agent か」の割り当ては呼び出し側責務(architecture.md)に沿う。
