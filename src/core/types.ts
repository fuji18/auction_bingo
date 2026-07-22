/**
 * ゲーム状態・イベント・ビューの型を集約する。
 *
 * データモデルの型はファイルごとに分散させず、このファイルへ集約する
 * (docs/functional-design.md「データモデル定義」節)。例外は 2 つ:
 * バランス定数 `BalanceConfig` は値と検証と凝集させるため config.ts に置き、
 * 意思決定インターフェース `Agent` は agents/ 層に属するため agents/types.ts に置く。
 */

import type { BalanceConfig } from './config';

/** プレイヤー識別子。P0 は 3 人固定。 */
export type PlayerId = 'p0' | 'p1' | 'p2';

/** スキル識別子。偏向 / 予知 / 強奪。 */
export type SkillId = 'shift' | 'vision' | 'greed';

/** セルの値。数字または中央の FREE。 */
export type CellValue = number | 'FREE';

export interface Cell {
  value: CellValue;
  marked: boolean;
}

/** board[col][row]。col 0..4 が B/I/N/G/O、row 0..4 が上から下。 */
export type Board = Cell[][];

export interface PlayerState {
  id: PlayerId;
  /** 'あなた' | 'レオ' | 'サラ' */
  name: string;
  kind: 'human' | 'cpu';
  board: Board;
  /** 0 以上 coinCap 以下。 */
  coins: number;
}

export interface Submission {
  playerId: PlayerId;
  skill: SkillId | null;
  /** 0 以上。上限は coins - skillCost(skill)。 */
  bid: number;
}

export type Phase =
  /** 全員の提出待ち。 */
  | 'submitting'
  /** 予知の成功者が 3 枚から 1 枚を選ぶ待ち。 */
  | 'vision'
  /** 落札者が数字を選ぶ(またはパス)待ち。 */
  | 'choosing'
  | 'finished';

export interface RngState {
  seed: number;
  /** 消費回数。state に持つことで再現性を担保する。 */
  counter: number;
}

export interface GameState {
  config: BalanceConfig;
  rng: RngState;
  /** 1..maxTurns */
  turn: number;
  phase: Phase;
  /** 未公開の数字。先頭が次に引かれる。 */
  deck: number[];
  /** 今ターンの T。 */
  target: number;
  players: PlayerState[];
  /** 優先権トークン保持者の players 上の添字。 */
  tokenIndex: number;
  /** 予約中のスキル代。 */
  reserved: Record<PlayerId, number>;
  /** ★秘匿。開札まで他者に見せない。 */
  submissions: Submission[];
  /** ★秘匿。予知で見た 3 枚(本人のみ)。 */
  visionPeek: Record<PlayerId, number[]>;
  auctionWinner: PlayerId | null;
  /** 落札者が選べる数字(範囲外は除外済み)。 */
  candidates: number[];
  log: GameEvent[];
  result: GameResult | null;
}

/**
 * リプレイ・ログ・UI 演出のすべてがこのイベント列から復元される。
 * `reduce` は state だけでなく必ず events を返す。
 */
export type GameEvent =
  | { type: 'TurnStarted'; turn: number; income: number; capped: PlayerId[] }
  | { type: 'TargetRevealed'; target: number }
  | {
      type: 'Submitted';
      playerId: PlayerId;
      skill: SkillId | null;
      bid: number;
    }
  | {
      type: 'VisionConflict';
      buyers: PlayerId[];
      winner: PlayerId;
      refunded: PlayerId[];
    }
  | {
      type: 'VisionResolved';
      playerId: PlayerId;
      peeked: number[];
      kept: number;
    }
  | {
      type: 'AuctionResolved';
      winner: PlayerId;
      bid: number;
      tiebreak: boolean;
    }
  /** value が null のときはパス。 */
  | { type: 'NumberChosen'; playerId: PlayerId; value: number | null }
  | { type: 'Marked'; value: number; markedBy: PlayerId[] }
  | {
      type: 'Settled';
      payer: PlayerId;
      paid: number;
      received: Record<PlayerId, number>;
      toBank: number;
    }
  | {
      type: 'SkillRefunded';
      playerId: PlayerId;
      amount: number;
      reason: 'lost-auction' | 'vision-conflict';
    }
  | { type: 'GameFinished'; result: GameResult };

/** reduce に渡すアクション。 */
export type Action =
  | { type: 'SUBMIT'; playerId: PlayerId; skill: SkillId | null; bid: number }
  | { type: 'SELECT_VISION'; playerId: PlayerId; keep: number }
  /** value が null のときはパス。 */
  | { type: 'CHOOSE'; playerId: PlayerId; value: number | null };

/**
 * `legalActions` が返す、現 phase で取り得る入力範囲。UI の入力ガード用で、
 * この範囲を超えるアクションは reduce が no-op で拒否する。
 * CPU(#8)は PublicView / SecretView から同じ範囲を導く。
 */
export type ActionSpec =
  | {
      phase: 'submitting';
      playerId: PlayerId;
      /** 各スキル(無しを含む)を選んだときの入札上限 = coins - cost。cost > coins のスキルは含めない。 */
      options: { skill: SkillId | null; maxBid: number }[];
    }
  | { phase: 'vision'; playerId: PlayerId; peeked: number[] }
  | {
      phase: 'choosing';
      playerId: PlayerId;
      candidates: number[];
      canPass: true;
    }
  | { phase: 'finished' };

export interface Standing {
  playerId: PlayerId;
  reachCount: number;
  markCount: number;
  coins: number;
  /** 完成ライン数。 */
  lines: number;
}

export interface GameResult {
  kind: 'bingo' | 'draw-bingo' | 'timeup' | 'draw-timeup';
  /** 引き分けなら複数。 */
  winners: PlayerId[];
  decidedBy: 'bingo' | 'reachCount' | 'markCount' | 'coins' | 'none';
  turn: number;
  standings: Standing[];
}

/** 過去ターンの開札結果(公開してよい範囲)。 */
export interface PublicTurnRecord {
  turn: number;
  target: number;
  submissions: { playerId: PlayerId; skill: SkillId | null; bid: number }[];
  winner: PlayerId | null;
  chosen: number | null;
}

/** 全員が見てよい情報。CPU はこれと自分の SecretView しか受け取れない。 */
export interface PublicView {
  config: BalanceConfig;
  turn: number;
  target: number;
  /** 残り枚数のみ。中身は渡さない。 */
  deckSize: number;
  tokenIndex: number;
  players: {
    id: PlayerId;
    name: string;
    /** 盤面は常時公開。 */
    board: Board;
    coins: number;
    /** 予約額は公開(スキルの有無は分かるが種類は分からない)。 */
    reserved: number;
  }[];
  /** 過去ターンの開札結果。 */
  history: PublicTurnRecord[];
}

/** 自分だけが見てよい情報。 */
export interface SecretView {
  playerId: PlayerId;
  /** 予知が成功したターンのみ。 */
  visionPeek: number[] | null;
}

// CPU の意思決定インターフェース `Agent` は意思決定層に属するため
// `src/agents/types.ts` に定義する(データモデルの型のみをこのファイルに集約する)。
