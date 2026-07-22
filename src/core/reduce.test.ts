/**
 * reduce の境界値ユニットテスト。
 *
 * ルールの境界(候補の範囲外除外・コイン上限・入札0・予知競合・パス・同時ビンゴ・
 * タイブレーク4段階)を、必要なフィールドだけ差し替えた state で決定的に固定する。
 * シードはテスト内にリテラルで書く(docs/development-guidelines.md「テストの構造」)。
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { createGame, reduce, legalActions } from './reduce';
import type { Action, Board, Cell, GameEvent, GameState } from './types';

function cell(value: number, marked = false): Cell {
  return { value, marked };
}

/** 5×5 の素の盤面。すべて一意の高い値・未マーク(FREE 無し)。 */
function plainBoard(markFirst = 0): Board {
  const b: Board = [];
  let n = 0;
  for (let c = 0; c < 5; c++) {
    const col: Cell[] = [];
    for (let r = 0; r < 5; r++) {
      col.push(cell(1000 + c * 5 + r, n < markFirst));
      n++;
    }
    b.push(col);
  }
  return b;
}

/** 列0の row0..3 をマーク済み、row4 を finalValue(未マーク)にした「あと1つでビンゴ」盤面。 */
function bingoReadyBoard(finalValue: number): Board {
  const b: Board = [];
  for (let c = 0; c < 5; c++) {
    const col: Cell[] = [];
    for (let r = 0; r < 5; r++) {
      if (c === 0 && r < 4) col.push(cell(2000 + r, true));
      else if (c === 0 && r === 4) col.push(cell(finalValue, false));
      else col.push(cell(3000 + c * 5 + r, false));
    }
    b.push(col);
  }
  return b;
}

/** ターン1・submitting の素の state を作り、指定フィールドだけ差し替える。 */
function submitState(overrides: Partial<GameState> = {}, seed = 1): GameState {
  return { ...createGame(DEFAULT_CONFIG, seed), ...overrides };
}

describe('候補の範囲外除外(ステップ4)', () => {
  it('target=1 で強奪なら候補は {1,2,3}', () => {
    const state = submitState({ target: 1 });
    const { state: next } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: 'greed', bid: 3 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
    ]);
    expect(next.phase).toBe('choosing');
    expect(next.auctionWinner).toBe('p0');
    expect(next.candidates).toEqual([1, 2, 3]);
  });

  it('target=40 で強奪なら候補は {38,39,40}', () => {
    const state = submitState({ target: 40 });
    const { state: next } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: 'greed', bid: 3 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
    ]);
    expect(next.candidates).toEqual([38, 39, 40]);
  });

  it('偏向は列をまたいでも候補に含める(target=8 → {7,8,9})', () => {
    const state = submitState({ target: 8 });
    const { state: next } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: 'shift', bid: 3 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
    ]);
    expect(next.candidates).toEqual([7, 8, 9]);
  });

  it('スキルなしなら候補は target 単独', () => {
    const state = submitState({ target: 20 });
    const { state: next } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 1 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
    ]);
    expect(next.candidates).toEqual([20]);
  });
});

describe('開札(ステップ3)', () => {
  it('入札0・全員0ならトークン保持者が0枚で落札(tiebreak=true)', () => {
    // ターン1のトークンは p0(座席0)。
    const state = submitState({ target: 10 });
    const { state: next, events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
    ]);
    expect(next.auctionWinner).toBe('p0');
    expect(events).toContainEqual({
      type: 'AuctionResolved',
      winner: 'p0',
      bid: 0,
      tiebreak: true,
    });
  });

  it('同額最高はトークン順で決まる(tiebreak=true)', () => {
    // tokenIndex を p1(座席1)にして、同額のとき p1 が勝つことを確認。
    const state = submitState({ target: 10, tokenIndex: 1 });
    const { state: next, events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 5 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 5 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 1 },
    ]);
    expect(next.auctionWinner).toBe('p1');
    expect(events).toContainEqual({
      type: 'AuctionResolved',
      winner: 'p1',
      bid: 5,
      tiebreak: true,
    });
  });

  it('単独最高は tiebreak=false', () => {
    const state = submitState({ target: 10 });
    const { events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 2 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 9 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 1 },
    ]);
    expect(events).toContainEqual({
      type: 'AuctionResolved',
      winner: 'p1',
      bid: 9,
      tiebreak: false,
    });
  });
});

describe('精算(ステップ6)', () => {
  it('分配 floor(bid/4) と銀行回収の合計が入札額に一致する', () => {
    const state = submitState({ target: 10 });
    const { events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 10 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
      { type: 'CHOOSE', playerId: 'p0', value: 10 },
    ]);
    const settled = events.find((e) => e.type === 'Settled') as Extract<
      GameEvent,
      { type: 'Settled' }
    >;
    // 各敗者 floor(10/4)=2、2人で4、銀行6。
    expect(settled.received).toEqual({ p0: 0, p1: 2, p2: 2 });
    expect(settled.toBank).toBe(6);
    expect(settled.paid).toBe(
      settled.received.p0 +
        settled.received.p1 +
        settled.received.p2 +
        settled.toBank
    );
  });

  it('落札できなかった偏向のコストは返金され、落札者の偏向コストは徴収される', () => {
    // 最終ターンにして精算後に income が乗らないようにし、コイン増減だけを見る。
    const base = createGame(DEFAULT_CONFIG, 1);
    const state = submitState({
      target: 10,
      turn: DEFAULT_CONFIG.maxTurns,
      players: base.players.map((p) => ({ ...p, board: plainBoard() })),
    });
    const { state: next, events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: 'shift', bid: 9 }, // 落札(cost4 徴収)
      { type: 'SUBMIT', playerId: 'p1', skill: 'shift', bid: 3 }, // 落札失敗(cost4 返金)
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
      { type: 'CHOOSE', playerId: 'p0', value: 10 },
    ]);
    expect(events).toContainEqual({
      type: 'SkillRefunded',
      playerId: 'p1',
      amount: 4,
      reason: 'lost-auction',
    });
    // p0: 15 - 9(bid) - 4(shift) = 2。
    expect(next.players.find((p) => p.id === 'p0')!.coins).toBe(2);
    // p1: 落札失敗、コスト返金 → 15 + floor(9/4)=2 = 17。
    expect(next.players.find((p) => p.id === 'p1')!.coins).toBe(17);
    // reserved は全クリア。
    expect(next.reserved).toEqual({ p0: 0, p1: 0, p2: 0 });
  });

  it('パスなら誰もマークしないが落札者は支払う', () => {
    const state = submitState({ target: 10 });
    const { events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 8 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
      { type: 'CHOOSE', playerId: 'p0', value: null },
    ]);
    expect(events.some((e) => e.type === 'Marked')).toBe(false);
    expect(events).toContainEqual({
      type: 'NumberChosen',
      playerId: 'p0',
      value: null,
    });
    // p0 は bid を支払う(パスでも)。
    const settled = events.find((e) => e.type === 'Settled') as Extract<
      GameEvent,
      { type: 'Settled' }
    >;
    expect(settled.paid).toBe(8);
  });
});

describe('コイン上限(ステップ0)', () => {
  it('coinCap ちょうどのプレイヤーは次ターン開始で income が消滅し capped に載る', () => {
    // p1 を上限(30)にしてターンを1つ回す。
    const players = createGame(DEFAULT_CONFIG, 1).players.map((p) =>
      p.id === 'p1' ? { ...p, coins: 30 } : p
    );
    const state = submitState({ target: 10, players });
    const { state: next, events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
      { type: 'CHOOSE', playerId: 'p0', value: null },
    ]);
    // 次ターンの TurnStarted。
    const started = [...events]
      .reverse()
      .find((e) => e.type === 'TurnStarted') as Extract<
      GameEvent,
      { type: 'TurnStarted' }
    >;
    expect(started.capped).toContain('p1');
    expect(next.players.find((p) => p.id === 'p1')!.coins).toBe(30);
  });
});

describe('予知の競合(ステップ2)', () => {
  it('2人が予知 → トークン順で成功者、他は全額返金・予約解除', () => {
    // tokenIndex を p2(座席2)にして、p1 と p2 が予知 → p2 が成功。
    const state = submitState({ target: 10, tokenIndex: 2 });
    const { state: next, events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p1', skill: 'vision', bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: 'vision', bid: 0 },
    ]);
    expect(next.phase).toBe('vision');
    expect(events).toContainEqual({
      type: 'VisionConflict',
      buyers: ['p1', 'p2'],
      winner: 'p2',
      refunded: ['p1'],
    });
    expect(events).toContainEqual({
      type: 'SkillRefunded',
      playerId: 'p1',
      amount: 5,
      reason: 'vision-conflict',
    });
    expect(next.reserved.p1).toBe(0);
    expect(next.reserved.p2).toBe(5); // 成功者は選択時に徴収されるまで予約が残る
    expect(next.visionPeek.p2.length).toBe(3);
  });

  it('3人が予知 → トークン順で1人成功、他2人返金', () => {
    const state = submitState({ target: 10, tokenIndex: 0 });
    const { state: next, events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: 'vision', bid: 0 },
      { type: 'SUBMIT', playerId: 'p1', skill: 'vision', bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: 'vision', bid: 0 },
    ]);
    expect(events).toContainEqual({
      type: 'VisionConflict',
      buyers: ['p0', 'p1', 'p2'],
      winner: 'p0',
      refunded: ['p1', 'p2'],
    });
    expect(next.visionPeek.p0.length).toBe(3);
  });

  it('予知は即時徴収され、選択後に開札へ進む', () => {
    const state = submitState({ target: 10, tokenIndex: 0 });
    const afterSubmit = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: 'vision', bid: 2 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
    ]);
    const peeked = afterSubmit.state.visionPeek.p0;
    const afterVision = reduce(afterSubmit.state, [
      { type: 'SELECT_VISION', playerId: 'p0', keep: peeked[0] },
    ]);
    expect(afterVision.events).toContainEqual({
      type: 'VisionResolved',
      playerId: 'p0',
      peeked,
      kept: peeked[0],
    });
    expect(afterVision.state.phase).toBe('choosing');
    // 予知コスト5を即時徴収 → 15 - 5 = 10。
    expect(afterVision.state.players.find((p) => p.id === 'p0')!.coins).toBe(
      10
    );
    // 選んだ数字が山札の先頭に来る。
    expect(afterVision.state.deck[0]).toBe(peeked[0]);
  });

  it('予知は今ターンの target に影響しない(効果は次ターン)', () => {
    const state = submitState({ target: 10, tokenIndex: 0 });
    const afterSubmit = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: 'vision', bid: 2 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
    ]);
    const targetBefore = afterSubmit.state.target;
    const peeked = afterSubmit.state.visionPeek.p0;
    // 先頭でない数字を選んでも、今ターンの target は既に山札から抜かれているため不変。
    const afterVision = reduce(afterSubmit.state, [
      {
        type: 'SELECT_VISION',
        playerId: 'p0',
        keep: peeked[peeked.length - 1],
      },
    ]);
    expect(afterVision.state.target).toBe(targetBefore);
    // 候補も target 由来で不変(スキルなし落札者なら target 単独)。
    expect(afterVision.state.candidates).toEqual([targetBefore]);
  });
});

describe('同時ビンゴ(ステップ7)', () => {
  it('落札者の選択で2人が同時に列を完成 → draw-bingo', () => {
    const V = 5;
    const base = createGame(DEFAULT_CONFIG, 1);
    const players = base.players.map((p) => {
      if (p.id === 'p0' || p.id === 'p1')
        return { ...p, board: bingoReadyBoard(V) };
      return { ...p, board: plainBoard() };
    });
    const state = submitState({ target: V, players });
    const { state: next, events } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 1 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
      { type: 'CHOOSE', playerId: 'p0', value: V },
    ]);
    expect(next.phase).toBe('finished');
    expect(next.result!.kind).toBe('draw-bingo');
    expect(next.result!.winners.sort()).toEqual(['p0', 'p1']);
    expect(next.result!.decidedBy).toBe('bingo');
    expect(events).toContainEqual({
      type: 'GameFinished',
      result: next.result,
    });
  });
});

describe('タイブレーク(ステップ7・maxTurns)', () => {
  /** turn=maxTurns の choosing 状態を作り、パスで決着させる。 */
  function timeupState(players: GameState['players']): GameState {
    const base = createGame(DEFAULT_CONFIG, 1);
    return {
      ...base,
      turn: DEFAULT_CONFIG.maxTurns,
      phase: 'choosing',
      target: 10,
      auctionWinner: 'p0',
      candidates: [],
      submissions: [
        { playerId: 'p0', skill: null, bid: 0 },
        { playerId: 'p1', skill: null, bid: 0 },
        { playerId: 'p2', skill: null, bid: 0 },
      ],
      players,
    };
  }

  const pass: Action = { type: 'CHOOSE', playerId: 'p0', value: null };

  it('reachCount で単独決着', () => {
    const base = createGame(DEFAULT_CONFIG, 1);
    const players = base.players.map((p) =>
      p.id === 'p0'
        ? { ...p, board: bingoReadyBoard(5) }
        : { ...p, board: plainBoard() }
    );
    const { state: next } = reduce(timeupState(players), [pass]);
    expect(next.result!.kind).toBe('timeup');
    expect(next.result!.decidedBy).toBe('reachCount');
    expect(next.result!.winners).toEqual(['p0']);
  });

  it('reachCount 同値 → markCount で決着', () => {
    const base = createGame(DEFAULT_CONFIG, 1);
    // 全員 reachCount 0。p0 だけマーク数3。
    const players = base.players.map((p) => {
      if (p.id === 'p0') return { ...p, board: plainBoard(3) };
      return { ...p, board: plainBoard(0) };
    });
    const { state: next } = reduce(timeupState(players), [pass]);
    expect(next.result!.decidedBy).toBe('markCount');
    expect(next.result!.winners).toEqual(['p0']);
  });

  it('reachCount・markCount 同値 → coins で決着', () => {
    const base = createGame(DEFAULT_CONFIG, 1);
    const players = base.players.map((p) => {
      const board = plainBoard(0);
      if (p.id === 'p1') return { ...p, board, coins: 20 };
      return { ...p, board, coins: 5 };
    });
    const { state: next } = reduce(timeupState(players), [pass]);
    expect(next.result!.decidedBy).toBe('coins');
    expect(next.result!.winners).toEqual(['p1']);
  });

  it('すべて同値 → draw-timeup・decidedBy none', () => {
    const base = createGame(DEFAULT_CONFIG, 1);
    const players = base.players.map((p) => ({
      ...p,
      board: plainBoard(0),
      coins: 10,
    }));
    const { state: next } = reduce(timeupState(players), [pass]);
    expect(next.result!.kind).toBe('draw-timeup');
    expect(next.result!.decidedBy).toBe('none');
    expect(next.result!.winners.sort()).toEqual(['p0', 'p1', 'p2']);
  });
});

describe('不正・フェーズ不一致アクション', () => {
  it('コイン超過・負入札・予約超過は state を変えず events も残さない', () => {
    const state = submitState({ target: 10 });
    // p0: 予約超過(shift cost4 + bid12 > coins15)。
    const r1 = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: 'shift', bid: 12 },
    ]);
    expect(r1.events).toEqual([]);
    expect(r1.state).toBe(state);
    // 負入札。
    const r2 = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: -1 },
    ]);
    expect(r2.events).toEqual([]);
    // コスト超過(手持ち15で買えないスキルは無いが、コインを下げて確認)。
    const poor = submitState({
      target: 10,
      players: createGame(DEFAULT_CONFIG, 1).players.map((p) =>
        p.id === 'p0' ? { ...p, coins: 3 } : p
      ),
    });
    const r3 = reduce(poor, [
      { type: 'SUBMIT', playerId: 'p0', skill: 'greed', bid: 0 },
    ]);
    expect(r3.events).toEqual([]);
  });

  it('phase と噛み合わないアクションは無視される', () => {
    const state = submitState({ target: 10 });
    // submitting 中に CHOOSE。
    const r = reduce(state, [{ type: 'CHOOSE', playerId: 'p0', value: 10 }]);
    expect(r.events).toEqual([]);
    expect(r.state).toBe(state);
  });

  it('二重提出は拒否される', () => {
    const state = submitState({ target: 10 });
    const once = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 1 },
    ]);
    const twice = reduce(once.state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 2 },
    ]);
    expect(twice.events).toEqual([]);
    expect(twice.state).toBe(once.state);
  });
});

describe('legalActions', () => {
  it('submitting: 手持ちで買えるスキルと入札上限を返す', () => {
    const state = submitState({ target: 10 });
    const spec = legalActions(state, 'p0');
    expect(spec.phase).toBe('submitting');
    if (spec.phase !== 'submitting') return;
    // 手持ち15なら null(15)/shift(11)/vision(10)/greed(9) すべて可能。
    expect(spec.options).toEqual([
      { skill: null, maxBid: 15 },
      { skill: 'shift', maxBid: 11 },
      { skill: 'vision', maxBid: 10 },
      { skill: 'greed', maxBid: 9 },
    ]);
  });

  it('choosing: 落札者には candidates とパス可、非落札者には空', () => {
    const state = submitState({ target: 10 });
    const { state: choosing } = reduce(state, [
      { type: 'SUBMIT', playerId: 'p0', skill: null, bid: 3 },
      { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 0 },
      { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 0 },
    ]);
    const winner = legalActions(choosing, 'p0');
    expect(winner).toEqual({
      phase: 'choosing',
      playerId: 'p0',
      candidates: [10],
      canPass: true,
    });
    const other = legalActions(choosing, 'p1');
    expect(other).toEqual({
      phase: 'choosing',
      playerId: 'p1',
      candidates: [],
      canPass: true,
    });
  });

  it('finished: phase のみ', () => {
    const base = createGame(DEFAULT_CONFIG, 1);
    const finished = { ...base, phase: 'finished' as const };
    expect(legalActions(finished, 'p0')).toEqual({ phase: 'finished' });
  });
});
