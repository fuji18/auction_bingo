# タスクリスト

Issue #7「ターン解決リデューサ」。設計は `design.md`、要求は `requirements.md`。
処理順序は `docs/functional-design.md`「2. ターン解決」を厳守する。

## フェーズ1: 型と初期化

- [x] `src/core/types.ts` に `ActionSpec`(判別可能 union)を追加
- [x] `src/core/reduce.ts` を新規作成し `createGame(config, seed)` を実装
  - [x] `validateConfig` 呼び出し・RNG 初期化・3人分の盤面生成
  - [x] `deck` を [1..40](全列範囲の和)のシャッフルで生成
  - [x] `startTurn`(ステップ0: income 加算・coinCap 切り捨て・token 回転・target 公開)を実装し初回に適用
  - [x] `TurnStarted` / `TargetRevealed` を log に積み phase=submitting で返す

## フェーズ2: 提出と予知(ステップ1-2)

- [x] `reduce` のディスパッチ骨格(phase 別・アクション順次適用・不正/不一致は no-op)
- [x] `applySubmit`(ステップ1検証: cost>coins / bid<0 / bid>coins-cost を拒否、reserved 設定、Submitted 発行)
- [x] `resolveAfterSubmit`(全員提出後に予知競合を解決)
  - [x] buyers>=2 のとき tokenOrder 順で winner 決定、他を全額返金・予約解除(VisionConflict + SkillRefunded)
  - [x] 予知成功者ありなら visionPeek 格納・phase=vision で停止
- [x] `applySelectVision`(keep 検証・deck 再構成・vision cost 即時徴収・VisionResolved)

## フェーズ3: 開札・選択・精算・決着(ステップ3-7)

- [x] `openAuction`(ステップ3: maxBid・top・単独/tokenOrder タイブレーク・AuctionResolved)
- [x] 候補算出(ステップ4: range=0/1/2、`[target-range..target+range] ∩ [1,40]`、範囲外除外・列またぎ許可)、phase=choosing で停止
- [x] `applyChoose`(ステップ5-6)
  - [x] value ∈ candidates or null を検証、NumberChosen 発行
  - [x] value≠null: 保持者全員マーク(markNumber)・Marked 発行
  - [x] 精算: winner が bid 支払い + 落札時のみ shift/greed cost 徴収、敗者へ floor(bid/divisor)(coinCap クランプ)、toBank 算出、敗者 shift/greed 返金(SkillRefunded lost-auction)、reserved 全クリア、Settled 発行
- [x] `checkEnd`(ステップ7 + タイブレーク)
  - [x] achievers 判定(bingo / draw-bingo)
  - [x] turn==maxTurns かつ 0人 → タイブレーク(reachCount→markCount→coins→draw)・decidedBy 設定
  - [x] standings 構築・GameResult・GameFinished・phase=finished
  - [x] 継続時は startTurn で次ターンへ

## フェーズ4: legalActions

- [x] `legalActions(state, playerId)` を phase 別に実装(submitting/vision/choosing/finished)

## フェーズ5: テスト(境界値を網羅)

- [x] `src/core/reduce.test.ts`(ユニット)
  - [x] 候補除外 target=1(強奪→{1,2,3})/ target=40(→{38,39,40})/ 偏向の列またぎ
  - [x] コイン上限ちょうど/超過の切り捨て
  - [x] 入札0 / 全員0(トークン保持者が0枚で落札)
  - [x] 予知競合 2人 / 3人(全額返金・トークン順)
  - [x] パス(誰もマークしない・落札者は支払う)
  - [x] 同時ビンゴ(draw-bingo)
  - [x] タイブレーク4段階すべて(reachCount/markCount/coins/none)
  - [x] 不正提出(コイン超過・負入札・予約超過)が no-op / フェーズ不一致の無視
- [x] `tests/determinism.test.ts`(同一 seed+actions で state・events 一致)
- [x] `tests/coinConservation.test.ts`(Settled 局所保存 + コイン創出なし + 上限/非負)
- [x] `tests/saveRestore.test.ts`(フルゲーム再計算の一致)
- [x] 非破壊テスト(reduce 前後で入力 state 不変)

## フェーズ6: 品質チェックと修正

- [x] `/check`(test-runner に委譲)の全チェックがパスすることを確認(lint/typecheck/test 109件/format/build すべて green)
- [x] reduce.ts が 500 行を超えたため `core/resolve/`(turn/submit/vision/auction/settle/result/shared)に分割(公開エクスポートは reduce.ts に集約)

## フェーズ7: レビューとドキュメント

- [x] `code-reviewer` subagent でレビュー(docs 整合含む)。1 major(予知の target 不変テスト欠落)+ 3 minor を反映済み
- [x] ~~README.md 更新~~(不要: README はリデューサを概念的に参照するのみで per-file 一覧を持たない。docs/functional-design.md ステップ6のクランプ挙動注記は更新済み)
- [x] 実装後の振り返り(このファイル下部に記録)

---

## 実装後の振り返り

### 実装完了日
2026-07-22

### 計画と実績の差分

**計画と異なった点**:
- **ターン1の収入**: 当初 startTurn を初回にもそのまま適用したため turn1 が initialCoins+income(16枚)になった。PRD「初期コイン15枚で開始」+ ステップ0「前ターンの解決直後に実行」から、turn1 は income 非支給が正と判断し `startTurn(state, grantIncome)` に変更。決定を `.harness/decisions.jsonl` に記録。
- **精算の received のクランプ扱い**: docs の擬似コードは floor(paid/divisor) を名目値として toBank 算出に使う書き方だったが、coinCap クランプ後の実受取額を received とし toBank に差分を合算する解釈を採用(`paid == Σreceived + toBank` が常に厳密成立)。docs/functional-design.md ステップ6に注記を追記。

**新たに必要になったタスク**:
- reduce.ts が 640 行になったため `core/resolve/` へ7分割(ticket の「500行超で分割」ルール)。
- code-reviewer 指摘の反映: (1)予知が今ターンの target に影響しない回帰テストを追加、(2)vision の deck 枯渇デッドロック防御(peeked 空なら開札へ)、(3)coinConservation の income=1 依存を assert ガードで明示、(4)docs ステップ6のクランプ注記。

**技術的理由でスキップしたタスク**:
- なし。

### 学んだこと

**技術的な学び**:
- reduce を「phase 駆動の状態機械 + 決定的ステップの自動進行」として設計すると、外部入力(提出・予知選択・数字選択)の停止点と内部処理が素直に分離できる。イベント順序をシーケンス図に一致させることが決定性の観測面になる。
- 決定性・コイン保存則・非破壊性は、フルゲームを回すドライバ(tests/support/driver.ts)+ イベントログの会計検証で強く担保できる。境界値はユニットで crafted state を使うと安定する。

**プロセス上の改善点**:
- docs の擬似コードと実装が乖離し得る箇所(クランプ・turn1 income)は、実装時に docs 側へ注記を返すと後続レビューの誤読を防げる。

### 次回への改善提案
- #8(CPU)は Agent(PublicView, SecretView)→ Action の範囲を legalActions と一致させること。driver.ts の簡易方針が良い雛形になる。
- balance 定数(income/coinCap/divisor 等)を変えるテストを #9 で足すなら、coinConservation の income=1 ガードを一般化する必要がある。
