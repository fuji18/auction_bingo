# タスクリスト

Issue #9: シミュレーション基盤とKPI計測

## フェーズ1: 実行基盤(TS 直接実行)

- [x] `scripts/ts-loader.mjs`(extensionless `.ts`/`index.ts` を解決する resolve フック)
- [x] `scripts/register-loader.mjs`(loader を register する `--import` 用エントリ)
- [x] `package.json` に `"sim"` スクリプト追加
- [x] `eslint.config.js` の node override に `scripts/**/*.mjs` を追加

## フェーズ2: 対局ドライバ

- [x] `src/sim/play.ts`: `playOne(agents, config, seed)` を実装(phase 別手番特定・guard 付き)

## フェーズ3: KPI 集計

- [x] `src/sim/metrics.ts`: 型定義(`RawGame` / `Metrics` / `SkillKey`)
- [x] `extractGame(state)`: log 1 走査で生データ抽出
- [x] `pearson(points)`: 相関係数(分散 0 は 0)
- [x] `summarize(games, agentBySlot)`: KPI 7 項目算出

## フェーズ4: テスト

- [x] `src/sim/metrics.test.ts`: pearson / summarize / extractGame(実対局の不変条件)

## フェーズ5: CLI

- [x] `src/sim/run.ts`: 引数解析・N 戦ループ・KPI レポート出力(目標レンジ + PASS/WARN)

## フェーズ6: 品質チェックと計測

- [x] `/check`(test-runner に委譲)の全チェックがパス(lint/typecheck/test/format)
- [x] `npm run build` が通る
- [x] 1 万戦を実行し所要時間 < 5 分を確認、KPI 初回結果を取得(2.86s / leo,sara,hoarder)
- [ ] KPI 初回結果を Issue #9 にコメントで残す(PR 作成後)

## フェーズ7: ドキュメント更新

- [x] README.md の「コマンド」表に `npm run sim` の引数付き用法を追記
- [x] 実装後の振り返り(このファイル下部に記録)

---

## 実装後の振り返り

### 実装完了日
2026-07-22

### 計画と実績の差分

**計画と異なった点**:
- TS を直接実行する手段(tsx/vite-node/esbuild)が devDependency に無かったため、
  ゼロ依存の ESM resolve フック(`scripts/ts-loader.mjs`)を自作して拡張子なし import を
  `.ts` に補完し、Node 24 のネイティブ型ストリップで実行する方式に決めた(新規 npm 依存を回避)。
- `sim/` の eslint override が `scripts/**/*.ts` のみだったため `scripts/**/*.mjs` を追加した。

**新たに必要になったタスク**:
- 上記ローダ 2 ファイルと eslint 追記(フェーズ1で吸収)。

### 学んだこと

**技術的な学び**:
- Node 24 は `.ts` を型ストリップで直接実行できるが、拡張子補完はしないため resolve フックが必要。
- KPI 計算は「1 ゲーム分の加算可能な生データ(RawGame)抽出 → 純粋な集計(summarize)」に
  分けると、集計ロジックを実対局なしで単体テストでき、`extractGame` は実対局の不変条件で担保できる。

**プロセス上の改善点**:
- 対局ドライバは既存の `testkit.playGame`(テスト専用)を本番用に写経する形で早く固められた。

### 次回への改善提案
- KPI が目標を割った項目(スキル使用率・相関・終盤スキル支配・ビンゴ発生率 93.6%)は
  バランス定数調整または Agent 戦略の見直しが必要。適用はユーザー承認を得てから別チケットで行う。

### KPI 初回結果(seed=1, games=10000)
- leo,sara,hoarder: ビンゴ93.6% / スキル使用15.1% / r=0.140 / 支配50.4%(leo) / 平均18.37T / 終盤単一スキル99.5% / パス0.8% / 所要2.86s
- hoarder,allIn,noSkill: ビンゴ94.7% / スキル使用0.0% / r=0.082 / 支配37.7%(allIn) / 平均18.75T / パス0.8% / 所要2.24s
