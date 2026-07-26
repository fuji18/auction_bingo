/**
 * リプレイ整形(groupTurns)の回帰ガード。
 *
 * シード固定で Game を決着まで自動プレイし、その log(core が確定させた events 列)から
 * groupTurns が全開示レコードを再構成できること・同一シードで決定的に一致することを確認する。
 * DOM 非依存のため Storage をフェイクして node 環境で回す(game.test.ts と同型)。
 */
import { describe, it, expect } from 'vitest';
import { Game } from '../game.svelte';
import type { GameEvent } from '../../core/types';
import { DECIDED_BY_LABELS, groupTurns } from './replay';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

/**
 * 人間役を決着まで自動入力し log を返す。
 * preferVision=true のとき提出フェーズで予知を優先購入し、予知の全開示を発生させる。
 */
function playToEnd(seed: number, preferVision: boolean): GameEvent[] {
  const game = new Game(fakeStorage());
  game.newGame(seed);
  let guard = 0;
  while (game.state.phase !== 'finished') {
    if (guard++ > 10_000) throw new Error('決着しませんでした(無限ループ)');
    const legal = game.myLegal;
    if (legal.phase === 'submitting') {
      const vision = legal.options.find((o) => o.skill === 'vision');
      if (preferVision && vision) game.submit('vision', 0);
      else game.submit(legal.options[0].skill, 0);
    } else if (legal.phase === 'vision') {
      game.selectVision(legal.peeked[0]);
    } else if (legal.phase === 'choosing') {
      game.choose(legal.candidates[0] ?? null);
    } else {
      break;
    }
  }
  return game.state.log;
}

describe('groupTurns(リプレイ整形)', () => {
  it('ターン数が result.turn と一致し、各ターンに人数分の提出がある', () => {
    const game = new Game(fakeStorage());
    game.newGame(12345);
    // 決着まで進める。
    let guard = 0;
    while (game.state.phase !== 'finished') {
      if (guard++ > 10_000) throw new Error('無限ループ');
      const legal = game.myLegal;
      if (legal.phase === 'submitting') game.submit(legal.options[0].skill, 0);
      else if (legal.phase === 'vision') game.selectVision(legal.peeked[0]);
      else if (legal.phase === 'choosing')
        game.choose(legal.candidates[0] ?? null);
    }
    const turns = groupTurns(game.state.log);
    const result = game.state.result!;

    expect(turns.length).toBe(result.turn);
    for (const t of turns) {
      expect(t.submissions.length).toBe(game.state.players.length);
      expect(t.target).toBeGreaterThan(0);
    }
  });

  it('提出の skill/bid が Submitted イベントと一致する(全開示)', () => {
    const log = playToEnd(777, false);
    const turns = groupTurns(log);
    // ログ中の Submitted を素朴に数えて突き合わせる。
    const submittedCount = log.filter((e) => e.type === 'Submitted').length;
    const groupedCount = turns.reduce((n, t) => n + t.submissions.length, 0);
    expect(groupedCount).toBe(submittedCount);

    // 落札のあったターンは精算内訳が取れる。
    const withAuction = turns.filter((t) => t.auction !== null);
    for (const t of withAuction) {
      // 落札者が数字を選んだ(パス以外)なら精算が発生する。
      if (t.chosen && t.chosen.value !== null) {
        expect(t.settled).not.toBeNull();
        expect(t.settled!.payer).toBe(t.auction!.winner);
      }
    }
  });

  it('予知で操作したターンが peeked(3枚)と kept を含めて開示される', () => {
    const log = playToEnd(2024, true);
    const turns = groupTurns(log);
    const visionTurns = turns.filter((t) => t.vision !== null);
    // 予知優先の人間がいるので少なくとも 1 ターンは予知が成立する。
    expect(visionTurns.length).toBeGreaterThan(0);
    for (const t of visionTurns) {
      expect(t.vision!.peeked.length).toBe(3);
      expect(t.vision!.peeked).toContain(t.vision!.kept);
    }
  });

  it('同一シードから決定的に再現される(2回流して一致)', () => {
    const a = groupTurns(playToEnd(999, false));
    const b = groupTurns(playToEnd(999, false));
    expect(a).toEqual(b);
  });

  it('決着基準ラベルが 5 種すべて定義されている', () => {
    const keys = Object.keys(DECIDED_BY_LABELS).sort();
    expect(keys).toEqual(
      ['bingo', 'coins', 'markCount', 'none', 'reachCount'].sort()
    );
  });
});
