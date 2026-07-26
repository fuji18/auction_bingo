# Issue #8 設計

## レイヤーと依存
- `src/agents/` は `PublicView` / `SecretView` のみを入力に取る純粋な意思決定層。
  `GameState` も `rng` も受け取らない(型で情報遮断を担保)。
- core への依存は `core/board`(ライン判定)・`core/rng`(乱数)・`core/types` のみ。
  `core/resolve/*` の内部ヘルパには依存しない(数値境界は config から自前計算)。
- eslint 制約: agents では `console` 禁止・`Math.random`/`Date.now` 禁止・
  ui/sim/svelte への import 禁止。すべて遵守する。

## ファイル構成
- `constants.ts`: 閾値・係数(ロジックと分離。#9 で調整する tunable のみ)
- `shared.ts`: 共有純粋ヘルパ(desire / 盤面ライン評価 / chooseNumber /
  selectVision / テル生成 / 派生 rng / clamp)
- `leo.ts` / `sara.ts`: レオ・サラの `submit` + 共有 chooseNumber/selectVision + tell
- `baseline/{hoarder,allIn,noSkill,random}.ts`: 検証用 4 戦略
- `registry.ts`: 名前 → Agent の解決(#9 の `--agents leo,sara,hoarder` 用)

## 主要ロジック(docs/functional-design.md「4」準拠)
- `desire(board, target, range)`: 窓 [target-range, target+range] にある自盤面の
  未マーク数。
- `bestLineAfter(board, value)`: value を marked したとき、その cell を通るライン中で
  最大となる marked 数(=最長ラインの伸び)。5 なら「そのラインを完成させる」。
- `chooseNumber`: 自盤面にある候補のうち bestLineAfter 最大を選ぶ。同点は相手の
  ライン完成を招かない候補を優先。自盤面に候補が無ければ、相手完成を招かない候補の
  うち相手利得(相手 bestLineAfter 合計)最小を選ぶ。全て相手完成を招くならパス(null)。
- `selectVision`: 3 枚のうち自分が持ち bestLineAfter 最大の 1 枚。無ければ相手が最も
  持っていない 1 枚。

## レオ / サラ
- レオ: `aggression = lerp(0.55, 0.20, turn/maxTurns)`、
  `bid = round(budget × aggression × (0.5 + 0.5×desire(range)))`。
  skill: desire(0)==0 かつ budget≥greed.cost+4 →greed / desire(1)>desire(0) →shift / 他 null。
- サラ: `base = lastWinningBid + 1`(初回は initialCoins×0.2)、
  `bid = desire(range)>0 ? min(base, budget-cost) : round(base×0.3)`。
  skill: reach>0 かつ budget≥vision.cost+2 →vision / desire(2)>desire(0) かつ budget≥12 →greed / 他 null。
- 実行時ガード: 選んだ skill の cost が coins を超えたら null に落とす。bid は
  round 後に `clamp(0, coins - cost)`(整数・非負・予約超過禁止。submit の検証と一致)。

## テルの rng 消費(設計判断)
`Agent.tell(pub, sec)` は rng 引数を持たない(#6 で確定済みの署名)。かつ tell は
意思決定に影響しない表示専用値で、`reduce` の決定性(state.rng)に混入させてはならない。
そこで **公開状態(turn/target/tokenIndex/自コイン)から決定的に派生させた RngState** を
`core/rng` で消費してノイズ判定する。これにより「Math.random 直呼び禁止」「同一 state →
同一テル(リプレイ再現)」を両立する。基本テルは ratio=予定入札額/budget の閾値で決め、
15%(NOISE_PERCENT)でそれ以外のテルに差し替える。

## baseline
- hoarder: 常に {null, bid 0}(貯め込み)。
- allIn: 常に {null, bid=coins}(全力入札)。
- noSkill: skill 常に null。desire(0)>0 なら round(coins×0.5)、他は round(coins×0.1)。
- random: 派生 rng で feasible な skill と [0,maxBid] の bid・候補・予知をランダム選択。
- baseline の chooseNumber/selectVision は random 以外は共有ロジックを使い、
  戦略差を submit(入札・スキル)に限定する(#9 の比較変数を isolate する)。
