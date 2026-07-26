/**
 * 情報バリアの統合テスト。
 *
 * PublicView が秘匿情報(deck の中身・他者の submissions・visionPeek)を
 * 構造的に含まないことを検証する。これは「CPU は非公開情報を参照しない」という
 * PRD の受け入れ条件を担保する境界であり、P1 でクライアントへ送る情報の定義でもある。
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../src/core/config';
import { createBoard } from '../src/core/board';
import type {
  GameEvent,
  GameState,
  PlayerId,
  PlayerState,
} from '../src/core/types';
import { toPublicView } from '../src/core/view';

/** 現ターンは submitting 中で、秘匿フィールドに sentinel を仕込んだ GameState。 */
function stateWithSecrets(): GameState {
  const ids: PlayerId[] = ['p0', 'p1', 'p2'];
  const players: PlayerState[] = ids.map((id, i) => {
    const [board] = createBoard(DEFAULT_CONFIG, { seed: 200 + i, counter: 0 });
    return { id, name: id, kind: 'cpu', board, coins: 15 };
  });
  // 開札前の現ターン。SENTINEL_BID(=999)は公開値に現れ得ない値。
  const log: GameEvent[] = [
    { type: 'TurnStarted', turn: 1, income: 1, capped: [] },
    { type: 'TargetRevealed', target: 7 },
  ];
  return {
    config: DEFAULT_CONFIG,
    rng: { seed: 1, counter: 0 },
    turn: 1,
    phase: 'submitting',
    deck: [40, 39, 38, 37, 36], // SENTINEL_DECK: 現物は非公開のはず
    target: 7,
    players,
    tokenIndex: 0,
    reserved: { p0: 4, p1: 0, p2: 0 },
    submissions: [
      { playerId: 'p0', skill: 'shift', bid: 999 }, // SENTINEL_BID
      { playerId: 'p1', skill: 'vision', bid: 998 },
    ],
    visionPeek: { p0: [997], p1: [], p2: [] }, // SENTINEL_PEEK
    auctionWinner: null,
    candidates: [],
    log,
    result: null,
  };
}

/** オブジェクトを再帰走査し、指定キーが 1 つでも存在すれば true。 */
function hasKeyDeep(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((v) => hasKeyDeep(v, key));
  if (value && typeof value === 'object') {
    if (key in value) return true;
    return Object.values(value).some((v) => hasKeyDeep(v, key));
  }
  return false;
}

describe('情報バリア: PublicView', () => {
  const pub = toPublicView(stateWithSecrets());
  const serialized = JSON.stringify(pub);

  it('deck の中身を持たず deckSize のみを持つ', () => {
    expect(hasKeyDeep(pub, 'deck')).toBe(false);
    expect(pub.deckSize).toBe(5);
  });

  it('進行中ターンの submissions / visionPeek をトップレベルに持たない', () => {
    // 注: 過去の開札済みターンの入札は history[].submissions として意図的に公開される。
    // ここで検証するのは「秘匿フィールドの生キー」が PublicView に露出しないこと。
    // fixture は開札前(history が空)なので、submissions/visionPeek はどこにも現れない。
    expect(hasKeyDeep(pub, 'visionPeek')).toBe(false);
    // state.submissions(★秘匿の生配列)由来のキーが露出していないこと。
    // history 経由の公開分は別キー(history)配下に入るため、この検証と両立する。
    expect(pub).not.toHaveProperty('submissions');
    expect(pub.players.every((p) => !('submissions' in p))).toBe(true);
  });

  it('他者の提出額(sentinel)がシリアライズ結果に漏れない', () => {
    expect(serialized).not.toContain('999');
    expect(serialized).not.toContain('998');
  });

  it('予知で覗いた値(sentinel)がシリアライズ結果に漏れない', () => {
    expect(serialized).not.toContain('997');
  });

  it('開札前の現ターンの提出は history に現れない', () => {
    expect(pub.history).toHaveLength(0);
  });
});
