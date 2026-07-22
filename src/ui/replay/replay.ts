/**
 * 試合後リプレイの純粋ロジック + 表示ラベル。
 *
 * core が確定させた `GameEvent[]`(`GameState.log`)をターン単位へ分割・整形するだけ。
 * ルール判断・乱数・タイマーは一切持たない(core/types の型のみ依存)。同じ events 列を
 * ResolveLog もリプレイも読むため、「リプレイがゲーム中の表示と矛盾しない」ことが
 * 構造的に保証される(docs/functional-design.md「結果 GameResult」「画面遷移」)。
 */

import type {
  GameEvent,
  GameResult,
  PlayerId,
  SkillId,
} from '../../core/types';

/** 座席 → 表示名。SubmitPanel / ResolveLog と表記を一致させる。 */
export const PLAYER_NAMES: Record<PlayerId, string> = {
  p0: 'あなた',
  p1: 'レオ',
  p2: 'サラ',
};

/** スキル(なし含む)→ 表示名。SubmitPanel の SKILL_LABEL と一致させる。 */
export const SKILL_LABELS: Record<'none' | SkillId, string> = {
  none: 'なし',
  shift: '偏向',
  vision: '予知',
  greed: '強奪',
};

/** 決着基準 → 表示名。GameResult['decidedBy'] の 5 種を網羅する。 */
export const DECIDED_BY_LABELS: Record<GameResult['decidedBy'], string> = {
  bingo: 'ビンゴ達成',
  reachCount: 'リーチ本数',
  markCount: '総マーク数',
  coins: 'コイン残',
  none: '全指標が同値(引き分け)',
};

/** スキル(null=なし)を表示名へ。 */
export function skillLabel(skill: SkillId | null): string {
  return SKILL_LABELS[skill ?? 'none'];
}

/** 座席を表示名へ。 */
export function playerName(id: PlayerId): string {
  return PLAYER_NAMES[id];
}

/** リプレイ 1 ターン分の全開示レコード(events から再構成)。 */
export interface TurnReplay {
  turn: number;
  target: number;
  income: number;
  /** 全員の提出(入札額・購入スキル)。 */
  submissions: { playerId: PlayerId; skill: SkillId | null; bid: number }[];
  /** 予知が競合したとき(獲得者と返金対象)。 */
  visionConflict: { winner: PlayerId; refunded: PlayerId[] } | null;
  /** 予知の全開示(覗いた 3 枚・仕込んだ 1 枚)。 */
  vision: { playerId: PlayerId; peeked: number[]; kept: number } | null;
  /** 落札結果。 */
  auction: { winner: PlayerId; bid: number; tiebreak: boolean } | null;
  /** 落札者が選んだ数字(null=パス)。 */
  chosen: { playerId: PlayerId; value: number | null } | null;
  /** マーク結果(選ばれた数字と、盤面に持っていてマークした全員)。 */
  marked: { value: number; markedBy: PlayerId[] }[];
  /** 精算(落札者の支払いと分配・銀行行き)。 */
  settled: {
    payer: PlayerId;
    paid: number;
    received: Record<PlayerId, number>;
    toBank: number;
  } | null;
  /** スキル代の返金(落札失敗 / 予知競合)。 */
  refunds: {
    playerId: PlayerId;
    amount: number;
    reason: 'lost-auction' | 'vision-conflict';
  }[];
}

/** 空のターンレコードを作る。 */
function emptyTurn(turn: number, income: number): TurnReplay {
  return {
    turn,
    target: 0,
    income,
    submissions: [],
    visionConflict: null,
    vision: null,
    auction: null,
    chosen: null,
    marked: [],
    settled: null,
    refunds: [],
  };
}

/**
 * 全ログを TurnStarted を区切りにターン単位へ分割・整形する。
 * 想定外のイベント順でも落ちないよう、対応イベントが無ければ null / 空配列を保つ。
 * 末尾の GameFinished は決着画面が担うためターンには畳み込まない。
 */
export function groupTurns(log: GameEvent[]): TurnReplay[] {
  const turns: TurnReplay[] = [];
  let cur: TurnReplay | null = null;

  for (const ev of log) {
    switch (ev.type) {
      case 'TurnStarted':
        cur = emptyTurn(ev.turn, ev.income);
        turns.push(cur);
        break;
      case 'TargetRevealed':
        if (cur) cur.target = ev.target;
        break;
      case 'Submitted':
        cur?.submissions.push({
          playerId: ev.playerId,
          skill: ev.skill,
          bid: ev.bid,
        });
        break;
      case 'VisionConflict':
        if (cur)
          cur.visionConflict = { winner: ev.winner, refunded: ev.refunded };
        break;
      case 'VisionResolved':
        if (cur)
          cur.vision = {
            playerId: ev.playerId,
            peeked: ev.peeked,
            kept: ev.kept,
          };
        break;
      case 'AuctionResolved':
        if (cur)
          cur.auction = {
            winner: ev.winner,
            bid: ev.bid,
            tiebreak: ev.tiebreak,
          };
        break;
      case 'NumberChosen':
        if (cur) cur.chosen = { playerId: ev.playerId, value: ev.value };
        break;
      case 'Marked':
        cur?.marked.push({ value: ev.value, markedBy: ev.markedBy });
        break;
      case 'Settled':
        if (cur)
          cur.settled = {
            payer: ev.payer,
            paid: ev.paid,
            received: ev.received,
            toBank: ev.toBank,
          };
        break;
      case 'SkillRefunded':
        cur?.refunds.push({
          playerId: ev.playerId,
          amount: ev.amount,
          reason: ev.reason,
        });
        break;
      case 'GameFinished':
        // 決着は ResultPanel が担うためターンには含めない。
        break;
    }
  }

  return turns;
}
