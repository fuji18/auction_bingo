/**
 * バランス定数の唯一の出所。
 *
 * すべての調整可能な数値をこの1箇所に集約する。ゲームロジックのコード中に
 * 数値リテラルを散らばらせない(#9 のバランス調整でロジック diff を汚さないため)。
 */

/** ゲームで扱えるプレイヤー数。P0 は 3 人固定。 */
export type PlayerCount = 3;

/** 列の数値範囲を [下限, 上限](両端含む)で表す。 */
export type ColumnRange = [min: number, max: number];

export interface BalanceConfig {
  playerCount: PlayerCount;
  /** 最大ターン数。この数に達したらタイムアップで決着する。 */
  maxTurns: number;
  board: {
    /** 盤面の一辺のマス数(5x5)。 */
    size: 5;
    /** 中央(N 列 3 行目)を FREE にするか。 */
    freeCenter: boolean;
    /** 列ごとの数値範囲。B/I/N/G/O の順。互いに素で、和が数字プール全体を覆う。 */
    columns: ColumnRange[];
    /** 各列の範囲から選ぶ個数(各列の範囲の広さ以下)。 */
    pickPerColumn: number;
  };
  economy: {
    /** 初期コイン。 */
    initialCoins: number;
    /** コイン保有上限。ターン開始時にこれを超える分は切り捨てる。 */
    coinCap: number;
    /** 毎ターンの収入。 */
    incomePerTurn: number;
    /** 各敗者の受取額 = floor(bid / distributionDivisor)。playerCount + 1 以上。 */
    distributionDivisor: number;
  };
  skills: {
    /** 偏向: 落札額と別に cost を予約し、選べる数字を ±range ずらす。 */
    shift: { cost: number; range: number };
    /** 予知: 即時に cost を支払い、山札の先頭 peek 枚を覗く。 */
    vision: { cost: number; peek: number };
    /** 強奪: cost を予約し、選べる数字を ±range に広げる。 */
    greed: { cost: number; range: number };
  };
}

export const DEFAULT_CONFIG: BalanceConfig = {
  playerCount: 3,
  maxTurns: 25,
  board: {
    size: 5,
    freeCenter: true,
    columns: [
      [1, 8],
      [9, 16],
      [17, 24],
      [25, 32],
      [33, 40],
    ],
    pickPerColumn: 5,
  },
  economy: {
    initialCoins: 15,
    coinCap: 30,
    incomePerTurn: 1,
    distributionDivisor: 4,
  },
  skills: {
    shift: { cost: 4, range: 1 },
    vision: { cost: 5, peek: 3 },
    greed: { cost: 6, range: 2 },
  },
};

/**
 * バランス定数の制約を検証する。違反があれば最初の 1 件で throw する。
 *
 * 検証する制約(docs/functional-design.md「バランス定数」節):
 * - 列範囲は互いに素で、和が数字プール全体(最小〜最大)を隙間なく覆う。
 * - pickPerColumn は各列の範囲の広さ以下。
 * - distributionDivisor は playerCount + 1 以上(下回るとコインが増殖する)。
 */
export function validateConfig(config: BalanceConfig): void {
  const { board, economy, playerCount } = config;

  if (board.columns.length !== board.size) {
    throw new Error(
      `列数 ${board.columns.length} が盤面サイズ ${board.size} と一致しません`
    );
  }

  for (const [min, max] of board.columns) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error(`列範囲 [${min}, ${max}] は整数である必要があります`);
    }
    if (min > max) {
      throw new Error(
        `列範囲 [${min}, ${max}] は min <= max である必要があります`
      );
    }
    const width = max - min + 1;
    if (board.pickPerColumn > width) {
      throw new Error(
        `pickPerColumn ${board.pickPerColumn} が列範囲 [${min}, ${max}] の広さ ${width} を超えています`
      );
    }
  }

  // 互いに素かつ隙間なく連続していることを確認する。
  const sorted = [...board.columns].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    const prevMax = sorted[i - 1][1];
    const curMin = sorted[i][0];
    if (curMin <= prevMax) {
      throw new Error(
        `列範囲が重複しています(互いに素ではありません): [..., ${prevMax}] と [${curMin}, ...]`
      );
    }
    if (curMin !== prevMax + 1) {
      throw new Error(
        `列範囲に隙間があります(数字プールを覆えていません): ${prevMax} と ${curMin} の間`
      );
    }
  }

  if (economy.distributionDivisor < playerCount + 1) {
    throw new Error(
      `distributionDivisor ${economy.distributionDivisor} は playerCount + 1 (${playerCount + 1}) 以上である必要があります(下回るとコインが増殖します)`
    );
  }
}
