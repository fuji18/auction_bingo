/**
 * CPU の意思決定に使う閾値・係数。
 *
 * ロジック(leo.ts / sara.ts / shared.ts)からこれらの数値を分離するのは、
 * #9 のシミュレーションで調整するたびにロジックの diff を汚さないため
 * (Issue #8 技術メモ / docs/functional-design.md「4. CPU の意思決定」)。
 * ここにあるのは「調整対象の tunable」だけで、config 由来のコスト等は含めない。
 */

/** レオ「序盤に積む猪突型」。 */
export const LEO = {
  /** aggression の序盤値(turn=0)。 */
  aggressionStart: 0.55,
  /** aggression の終盤値(turn=maxTurns)。 */
  aggressionEnd: 0.2,
  /** greed を選ぶ最低予算の上乗せ(budget >= greed.cost + この値)。 */
  greedBudgetMargin: 4,
} as const;

/** サラ「追随して差し込む型」。 */
export const SARA = {
  /** 初ターンの基準入札 = initialCoins × この比率。 */
  firstTurnBidRatio: 0.2,
  /** desire が 0 のときの控えめ入札 = base × この比率。 */
  passBidRatio: 0.3,
  /** vision を選ぶ最低予算の上乗せ(budget >= vision.cost + この値)。 */
  visionBudgetMargin: 2,
  /** greed を選ぶ最低予算。 */
  greedMinBudget: 12,
} as const;

/** テル生成の ratio 閾値(予定入札額 / budget)。 */
export const TELL = {
  /** これ以上で「強気」。 */
  bold: 0.45,
  /** これ以上で「様子見」(未満は「静観」)。 */
  watch: 0.15,
} as const;

/** テルにノイズ(別のテルへ差し替え)を入れる確率(パーセント)。 */
export const NOISE_PERCENT = 15;

/** baseline noSkill の入札比率。 */
export const NOSKILL = {
  /** desire(0) > 0 のとき coins × この比率。 */
  activeBidRatio: 0.5,
  /** それ以外は coins × この比率。 */
  idleBidRatio: 0.1,
} as const;
