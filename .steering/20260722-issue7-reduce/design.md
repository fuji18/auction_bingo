# 設計書

## アーキテクチャ概要

`reduce` は **phase 駆動の状態機械**として実装する。1ターンは複数の外部入力(全員の提出 → 予知選択 → 数字選択)を必要とするため、reduce は渡されたアクション列を順に適用しつつ、内部の決定的ステップ(予知競合解決・開札・候補算出・マーク・精算・ビンゴ判定・次ターン開始)を自動で進め、**外部入力が必要な地点で phase を切り替えて停止**する。

イベント順序は `docs/functional-design.md`「1ターンの進行」シーケンス図に厳密に一致させる:

```
createGame:        TurnStarted, TargetRevealed                     (phase=submitting)
--- reduce([SUBMIT×3]) ---
  Submitted×3
  [予知競合あり] VisionConflict, SkillRefunded(vision-conflict)
  [予知成功者あり] → phase=vision で停止(visionPeek に peeked を格納)
  [予知成功者なし] AuctionResolved → phase=choosing で停止
--- reduce([SELECT_VISION]) ---   ※予知成功者がいたときのみ
  VisionResolved(即時徴収・deck 再構成)
  AuctionResolved → phase=choosing で停止
--- reduce([CHOOSE]) ---
  NumberChosen [, Marked]
  Settled, SkillRefunded(lost-auction)×n
  [決着] GameFinished → phase=finished
  [継続] TurnStarted, TargetRevealed → phase=submitting
```

**この順序 = 決定性の観測面**。イベント列も (seed, actions) から一意に再現される。

## コンポーネント設計

### 1. `core/reduce.ts`(公開 façade)

**責務**:
- `createGame(config, seed): GameState` — 検証・盤面生成・deck 生成・ターン1のステップ0まで進める。
- `reduce(state, actions): { state, events }` — phase に応じてアクションを1件ずつ適用し、決定的ステップを自動進行させる。
- `legalActions(state, playerId): ActionSpec` — 現 phase で取り得る入力範囲を返す(UI ガード用)。

**実装の要点**:
- 入力 `state` を破壊しない。全更新はスプレッド/`map` で新オブジェクトを作る。変更のない `PlayerState`・盤面は参照を使い回す。
- `Math.random()`/`Date`/`console` を使わない(eslint がエラーにする)。乱数は `state.rng` からのみ。
- アクションは順に処理する。現 phase と一致しない/不正なアクションは **state を変えず events にも残さず** スキップする(`docs` エラーハンドリング「フェーズ不一致 → 無視」)。
- 500 行を超えたら純粋ヘルパを `core/resolve/` に分割する(公開エクスポートは reduce.ts に集約)。

### 2. ステップ別ヘルパ(reduce.ts 内の純粋関数、肥大化時に `core/resolve/` へ)

- **startTurn(state)** — ステップ0。全員に income 加算・`coinCap` 超過切り捨て(capped 収集)・`tokenIndex = (tokenIndex+1) % playerCount`・`target = deck[0]`(deck から除去)。`TurnStarted` + `TargetRevealed` を発行し phase=submitting。createGame とターン継続の両方から呼ぶ。
- **applySubmit(state, action)** — ステップ1検証。`cost = skill?skills[skill].cost:0`。`cost>coins` / `bid<0` / `bid>coins-cost` は拒否(no-op)。`reserved[pid]=cost`、`submissions` へ追加、`Submitted` 発行。全員提出済みなら resolveAfterSubmit へ。
- **resolveAfterSubmit(state)** — ステップ2予知競合。buyers = 予知提出者。`buyers.length>=2` → tokenOrder 順で winner、他を全額返金(reserved 解除)し `VisionConflict` + `SkillRefunded(vision-conflict)`。予知成功者がいれば `visionPeek[winner]=deck.slice(0,peek)`、phase=vision で停止。いなければ openAuction。
- **applySelectVision(state, action)** — ステップ2続き。`keep` が peeked に含まれるか検証。deck 再構成 `deck=[kept, ...shuffle(残り)]`(RNG 消費)、vision cost を **即時徴収**(coins から減算、reserved 解除)、`visionPeek` クリア、`VisionResolved` 発行。openAuction へ。
- **openAuction(state)** — ステップ3・4。`maxBid=max(bid)`、top=最大入札者集合。単独なら winner・tiebreak=false、複数なら tokenOrder 順先頭・tiebreak=true。`AuctionResolved` 発行。`range = winner のスキル(shift=1/greed=2/その他0)`、`candidates = [target-range..target+range] ∩ [1,40]`。`auctionWinner`・`candidates` を格納し phase=choosing で停止。
- **applyChoose(state, action)** — ステップ5・6・7。`value` が candidates に含まれる or null か検証。`NumberChosen` 発行。value≠null なら盤面に持つ全員をマーク(`markNumber`)し `Marked`。精算:winner が bid を支払い、winner の shift/greed cost を徴収、各敗者に `floor(bid/divisor)`(coinCap クランプ)、`toBank=paid-Σreceived`、敗者の shift/greed 予約を返金(`SkillRefunded(lost-auction)`)、reserved 全クリア、`Settled` 発行。ビンゴ判定へ。
- **checkEnd(state)** — ステップ7 + タイブレーク。`achievers = completedLines>=1`。1人→bingo、2人以上→draw-bingo。0人 かつ turn==maxTurns → タイブレーク(reachCount→markCount→coins→draw)。決着なら `GameResult`(standings 付き)を作り `GameFinished`・phase=finished。継続なら startTurn。

**共通補助**:
- `tokenOrder(tokenIndex, n) = [i, (i+1)%n, ...]`。予知競合・開札タイブレークで共有。
- `pidToIndex` / `players` の更新は id 一致の要素だけ差し替える純粋更新。

### 3. `legalActions` の返り値 `ActionSpec`

`docs` の型注記(`Action[] | ActionSpec`)に合わせ、判別可能な union を新設(`core/types.ts` に追加):

```typescript
type ActionSpec =
  | { phase: 'submitting'; playerId; skills: { skill: SkillId | null; maxBid: number }[] }
  | { phase: 'vision'; playerId; peeked: number[] }
  | { phase: 'choosing'; playerId; candidates: number[]; canPass: true }
  | { phase: 'finished' };
```

UI(#10)はこの範囲でしか入力させない。CPU(#8)は PublicView/SecretView から同じ範囲を導く。

## データフロー

### 1ターン(予知成功者ありの最長経路)
```
1. UI/sim が全員の SUBMIT を集めて reduce([SUBMIT×3])
2. reduce: Submitted×3 → 予知競合解決 → phase=vision(visionPeek 格納)で返す
3. 予知成功者の Agent/UI が SecretView.visionPeek から keep を決め reduce([SELECT_VISION])
4. reduce: VisionResolved → openAuction → AuctionResolved → phase=choosing で返す
5. 落札者の Agent/UI が candidates から value/null を決め reduce([CHOOSE])
6. reduce: NumberChosen, Marked, Settled, SkillRefunded → 決着 or 次ターン開始で返す
```

### セーブ復元
```
reduce(createGame(config, seed), savedActions) が保存前の state と一致(saveRestore.test)
```

## エラーハンドリング戦略

- **カスタムエラークラスは作らない**。`validateConfig` の throw(既存)以外、reduce は例外を投げず不正アクションを no-op でスキップする(`docs` エラーハンドリング表に準拠)。
- `nextInt(rng, 0)` 等の内部前提違反のみ既存関数が throw する(到達しない想定)。

## テスト戦略

### ユニットテスト(`src/core/reduce.test.ts`)
- ステップ別の境界: target=1/40 の候補除外、コイン上限ちょうど/超過、入札0/全員0、予知競合2人/3人、パス、同時ビンゴ、タイブレーク4段階すべて。
- 不正提出(コイン超過・負入札・予約超過)が no-op(state 不変・events 空)。
- フェーズ不一致アクションの無視。

### 統合テスト(`tests/`)
- `determinism.test.ts` — 同一 (seed, actions) から state(深い等価)と events が一致。2回実行して比較。
- `coinConservation.test.ts` — 各 Settled で `paid == Σreceived + toBank`。全編通してコイン総和が「初期 + 付与 income」を超えない(創出なし)。coins が負にならない/coinCap を超えない。
- `saveRestore.test.ts` — createGame→reduce(actions) の再計算が決定的(同じ actions で同じ state)。フルゲームを 1 本流し切って result まで一致。
- **非破壊**: reduce 呼び出し前後で入力 state が構造的に不変(スナップショット比較)。

## 依存ライブラリ

追加なし(既存の `rng` / `board` / `config` のみ)。

## ディレクトリ構造

```
src/core/
├ reduce.ts        ← 新規(createGame / reduce / legalActions)
├ resolve/         ← 500行超過時のみ分割(初期は作らない)
├ types.ts         ← ActionSpec を追記
tests/
├ determinism.test.ts       ← 新規
├ coinConservation.test.ts  ← 新規
└ saveRestore.test.ts       ← 新規
```

## 実装の順序

1. `types.ts` に `ActionSpec` を追加。
2. `createGame` + `startTurn`(ステップ0)+ deck 生成。
3. `applySubmit`(ステップ1)+ reduce ディスパッチ骨格。
4. `resolveAfterSubmit` + `applySelectVision`(ステップ2 予知)。
5. `openAuction`(ステップ3・4)。
6. `applyChoose`(ステップ5・6)+ `checkEnd`(ステップ7・タイブレーク)。
7. `legalActions`。
8. ユニット + 統合テスト。境界値を網羅。
9. `/check` を通す。

## セキュリティ考慮事項

- P0 はクライアント完結のため state 改竄対策はしない(`docs` セキュリティ表)。reduce は秘匿情報(deck 中身・他者 submissions・visionPeek)を state に保持するが、外部へは view.ts の射影経由でのみ渡る(reduce の責務外)。

## パフォーマンス考慮事項

- 12ラインは `board.ts` で定数化済み。判定のたびに再構築しない。
- 変更のない盤面/PlayerState は参照を使い回し、無駄な複製を避ける(1万戦5分以内の #9 要件に効く)。

## 将来の拡張性

- P1 サーバー化では reduce をサーバー権威として同じインターフェースで動かす。phase 駆動・(seed, actions) 復元がそのまま通信境界になる。
