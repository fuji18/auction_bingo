/**
 * GameState → PublicView / SecretView の射影。純粋関数のみ。
 *
 * この射影が「CPU は非公開情報を参照しない」というバリアの実体。
 * `PublicView` は秘匿フィールド(deck の中身・他者の submissions・visionPeek)を
 * 構造的に含めないため、これを受け取る側は参照しようがない。
 * P1 のサーバー化では「クライアントへ送ってよい情報」= PublicView と一致させる。
 */

import type {
  GameEvent,
  GameState,
  PlayerId,
  PublicTurnRecord,
  PublicView,
  SecretView,
} from './types';

/**
 * 全員共通の公開情報へ射影する。deck は枚数のみ、他者の提出・予知は含めない。
 */
export function toPublicView(state: GameState): PublicView {
  return {
    config: state.config,
    turn: state.turn,
    target: state.target,
    deckSize: state.deck.length,
    tokenIndex: state.tokenIndex,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      board: p.board,
      coins: p.coins,
      reserved: state.reserved[p.id] ?? 0,
    })),
    history: buildHistory(state.log),
  };
}

/**
 * 指定プレイヤーの秘密情報へ射影する。visionPeek はその本人分のみ、
 * 予知が成功していないターンは null。他者の秘密情報は引数に取らないため参照不能。
 */
export function toSecretView(state: GameState, playerId: PlayerId): SecretView {
  // GameState は「予知なし」を空配列で持つが、SecretView は null で表す
  // (型定義どおり「予知が成功したターンのみ number[]」)。
  const peek = state.visionPeek[playerId];
  return {
    playerId,
    visionPeek: peek && peek.length > 0 ? peek : null,
  };
}

/**
 * イベントログから過去ターンの公開記録を再構成する。
 *
 * 採録するのは「開札済み(AuctionResolved が発行された)」ターンのみ。
 * 開札で提出内容が公開されるため、この条件が「進行中ターンの提出を露出しない」
 * バリアと一致する(submitting フェーズの現ターンは AuctionResolved を持たない)。
 *
 * イベント型は #4 で確定済み。reduce(#7)がこれらのイベントを発行することを前提とする。
 */
function buildHistory(log: GameEvent[]): PublicTurnRecord[] {
  const records: PublicTurnRecord[] = [];
  let cur: {
    turn: number;
    target: number;
    submissions: PublicTurnRecord['submissions'];
    winner: PlayerId | null;
    chosen: number | null;
    resolved: boolean;
  } | null = null;

  const flush = () => {
    if (cur && cur.resolved) {
      records.push({
        turn: cur.turn,
        target: cur.target,
        submissions: cur.submissions,
        winner: cur.winner,
        chosen: cur.chosen,
      });
    }
  };

  for (const ev of log) {
    switch (ev.type) {
      case 'TurnStarted':
        flush();
        cur = {
          turn: ev.turn,
          target: 0,
          submissions: [],
          winner: null,
          chosen: null,
          resolved: false,
        };
        break;
      case 'TargetRevealed':
        if (cur) cur.target = ev.target;
        break;
      case 'Submitted':
        if (cur)
          cur.submissions.push({
            playerId: ev.playerId,
            skill: ev.skill,
            bid: ev.bid,
          });
        break;
      case 'AuctionResolved':
        if (cur) {
          cur.winner = ev.winner;
          cur.resolved = true;
        }
        break;
      case 'NumberChosen':
        if (cur) cur.chosen = ev.value;
        break;
      default:
        break;
    }
  }
  flush();

  return records;
}
