/**
 * CPU 意思決定の共有純粋ヘルパ。
 *
 * すべて (PublicView / SecretView / 候補) だけを入力に取り、GameState にも rng 状態にも
 * 依存しない。core への依存は board(ライン判定)・rng(乱数)・types のみに絞る。
 */

import { LINE_INDICES, reachCount } from '../core/board';
import type { BalanceConfig } from '../core/config';
import { nextInt } from '../core/rng';
import type {
  Board,
  PlayerId,
  PublicView,
  RngState,
  SecretView,
  SkillId,
} from '../core/types';
import { NOISE_PERCENT, TELL } from './constants';

/** テルの語彙(基本 3 種)。ノイズは「基本以外」からランダムに選ぶ。 */
export const TELLS = ['強気', '様子見', '静観'] as const;

const ID_INDEX: Record<PlayerId, number> = { p0: 0, p1: 1, p2: 2 };

/** 数字プール全体の下限・上限(列範囲の和)。core/resolve に依存せず config から算出。 */
export function numberBoundsOf(
  config: BalanceConfig
): [min: number, max: number] {
  const mins = config.board.columns.map((c) => c[0]);
  const maxs = config.board.columns.map((c) => c[1]);
  return [Math.min(...mins), Math.max(...maxs)];
}

/** スキルの範囲拡張。偏向=±1、強奪=±2、それ以外=0(core/resolve と同値を再掲)。 */
export function skillRangeOf(skill: SkillId | null): number {
  if (skill === 'shift') return 1;
  if (skill === 'greed') return 2;
  return 0;
}

/** スキル代。null は 0。 */
export function skillCostOf(
  config: BalanceConfig,
  skill: SkillId | null
): number {
  return skill ? config.skills[skill].cost : 0;
}

/** bid を整数・非負・上限(maxBid = coins - cost)に収める。submit の検証と一致させる。 */
export function clampBid(bid: number, maxBid: number): number {
  const rounded = Math.round(bid);
  if (rounded < 0) return 0;
  if (rounded > maxBid) return Math.max(0, maxBid);
  return rounded;
}

/** 指定プレイヤーの公開盤面。 */
export function boardOf(pub: PublicView, playerId: PlayerId): Board {
  return pub.players.find((p) => p.id === playerId)!.board;
}

/** 指定プレイヤーの手持ちコイン。 */
export function coinsOf(pub: PublicView, playerId: PlayerId): number {
  return pub.players.find((p) => p.id === playerId)!.coins;
}

/** value を持ち、まだマークしていないセルが盤面にあるか。 */
export function holdsUnmarked(board: Board, value: number): boolean {
  return board.some((col) =>
    col.some((cell) => cell.value === value && !cell.marked)
  );
}

/**
 * value をマークしたとき、その cell を通るライン中で最大となる marked 数。
 * value を未マークで持っていなければ 0。5 なら「そのラインを完成させる」。
 */
export function bestLineAfter(board: Board, value: number): number {
  let best = 0;
  for (const line of LINE_INDICES) {
    const hasCell = line.some(
      ([c, r]) => board[c][r].value === value && !board[c][r].marked
    );
    if (!hasCell) continue;
    const markedNow = line.filter(([c, r]) => board[c][r].marked).length;
    best = Math.max(best, markedNow + 1);
  }
  return best;
}

/** value をマークすると盤面のいずれかのラインが完成する(=リーチを完成させる)か。 */
export function lineCompletesFor(board: Board, value: number): boolean {
  return bestLineAfter(board, value) >= 5;
}

/**
 * desire: 窓 [target-range, target+range] にある自盤面の未マーク数
 * (docs/functional-design.md「4」の定義)。盤面の値は数字プール内なので境界クランプは不要。
 */
export function desire(board: Board, target: number, range: number): number {
  let count = 0;
  for (const col of board) {
    for (const cell of col) {
      if (
        typeof cell.value === 'number' &&
        !cell.marked &&
        Math.abs(cell.value - target) <= range
      ) {
        count++;
      }
    }
  }
  return count;
}

/** value を選んだとき、自分以外の誰かのラインを完成させてしまうか。 */
function opponentWouldComplete(
  pub: PublicView,
  myId: PlayerId,
  value: number
): boolean {
  return pub.players.some(
    (p) => p.id !== myId && lineCompletesFor(p.board, value)
  );
}

/** value を選んだときの相手利得(相手の bestLineAfter 合計)。小さいほど相手に有利でない。 */
function opponentGain(pub: PublicView, myId: PlayerId, value: number): number {
  return pub.players.reduce(
    (sum, p) => (p.id === myId ? sum : sum + bestLineAfter(p.board, value)),
    0
  );
}

/**
 * 共有 chooseNumber(docs/functional-design.md「4. 数字選択」)。
 * - 自盤面にある候補のうち bestLineAfter 最大を選ぶ。同点は相手のライン完成を招かない方。
 * - 自盤面に候補が無ければ、相手完成を招かない候補のうち相手利得最小を選ぶ。
 * - 候補すべてが相手完成を招くならパス(null)。
 */
export function chooseNumber(
  pub: PublicView,
  sec: SecretView,
  candidates: number[]
): number | null {
  if (candidates.length === 0) return null;
  const board = boardOf(pub, sec.playerId);

  const mine = candidates.filter((v) => holdsUnmarked(board, v));
  if (mine.length > 0) {
    return [...mine].sort((a, b) => {
      const la = bestLineAfter(board, a);
      const lb = bestLineAfter(board, b);
      if (lb !== la) return lb - la; // 最長ラインの伸び最大
      const ha = opponentWouldComplete(pub, sec.playerId, a) ? 1 : 0;
      const hb = opponentWouldComplete(pub, sec.playerId, b) ? 1 : 0;
      if (ha !== hb) return ha - hb; // 同点は相手完成を招かない方を優先
      return a - b; // 決定的な最終タイブレーク
    })[0];
  }

  const safe = candidates.filter(
    (v) => !opponentWouldComplete(pub, sec.playerId, v)
  );
  if (safe.length === 0) return null; // 相手完成しか無い → パス

  return [...safe].sort((a, b) => {
    const ga = opponentGain(pub, sec.playerId, a);
    const gb = opponentGain(pub, sec.playerId, b);
    if (ga !== gb) return ga - gb; // 相手利得最小
    return a - b;
  })[0];
}

/**
 * 共有 selectVision(docs/functional-design.md「4. 予知の選択」)。
 * 3 枚のうち自分が持ち bestLineAfter 最大の 1 枚。無ければ相手が最も持っていない 1 枚。
 * 返り値は必ず peeked の要素(applySelectVision が要求)。
 */
export function selectVision(
  pub: PublicView,
  sec: SecretView,
  peeked: number[]
): number {
  const board = boardOf(pub, sec.playerId);

  const own = peeked.filter((v) => holdsUnmarked(board, v));
  if (own.length > 0) {
    return [...own].sort((a, b) => {
      const d = bestLineAfter(board, b) - bestLineAfter(board, a);
      return d !== 0 ? d : a - b;
    })[0];
  }

  const holders = (value: number) =>
    pub.players.filter(
      (p) => p.id !== sec.playerId && holdsUnmarked(p.board, value)
    ).length;

  return [...peeked].sort((a, b) => {
    const d = holders(a) - holders(b);
    return d !== 0 ? d : a - b;
  })[0];
}

/**
 * 公開状態から決定的に派生させた RngState。
 *
 * `Agent.tell` / random は rng 引数を持たないが、Math.random は禁止で、かつ同一 state から
 * 同一結果(リプレイ再現)でなければならない。そこで公開情報(turn/target/tokenIndex/自コイン)
 * と salt から seed を組み、core/rng で消費する。reduce の state.rng には一切触れないため、
 * ゲーム本体の決定性・乱数消費順序に影響しない。
 */
export function deriveRng(
  pub: PublicView,
  playerId: PlayerId,
  salt: number
): RngState {
  const idx = ID_INDEX[playerId];
  const coins = coinsOf(pub, playerId);
  const seed =
    (Math.imul(pub.turn + 1, 73856093) ^
      Math.imul(pub.target + 1, 19349663) ^
      Math.imul(pub.tokenIndex + 1, 83492791) ^
      Math.imul(idx + 1, 2654435761) ^
      Math.imul(coins + 1, 40503) ^
      Math.imul(salt + 1, 374761393)) |
    0;
  return { seed, counter: 0 };
}

/** salt: 同一ターン内で用途ごとに独立した乱数列にするための区別子。 */
export const SALT = {
  tell: 1,
  skill: 2,
  bid: 3,
  choose: 4,
  vision: 5,
} as const;

/** ratio(予定入札額/budget)から基本テルを決める。 */
export function baseTell(ratio: number): (typeof TELLS)[number] {
  if (ratio >= TELL.bold) return '強気';
  if (ratio >= TELL.watch) return '様子見';
  return '静観';
}

/**
 * テル生成。予定入札額から基本テルを決め、NOISE_PERCENT% で「基本以外」のテルに差し替える。
 * ノイズは派生 rng を消費する(確定情報にしないため。docs/functional-design.md「4. テルの生成」)。
 */
export function makeTell(
  pub: PublicView,
  sec: SecretView,
  plannedBid: number
): string {
  const budget = coinsOf(pub, sec.playerId);
  const ratio = budget > 0 ? plannedBid / budget : 0;
  const base = baseTell(ratio);

  const rng = deriveRng(pub, sec.playerId, SALT.tell);
  const [roll] = nextInt(rng, 100);
  if (roll >= NOISE_PERCENT) return base;

  const others = TELLS.filter((t) => t !== base);
  const [pick] = nextInt({ seed: rng.seed, counter: 1 }, others.length);
  return others[pick];
}

/** reachCount を再エクスポート(サラのスキル判定で使う)。 */
export { reachCount };
