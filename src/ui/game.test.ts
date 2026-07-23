/**
 * Game(UI ドライバ)の end-to-end スモークテスト。
 *
 * 人間役を単純な方針で自動入力し、CPU 自動進行と core 統合が最後まで破綻せず
 * 決着することを確認する(手番駆動・phase 遷移・保存/復元の回帰ガード)。
 * DOM は不要なため Storage をフェイクして node 環境で回す。
 */
import { describe, it, expect } from 'vitest';
import { Game } from './game.svelte';

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

/** 人間役を最小方針で進め, 決着まで駆動する。 */
function playHumanToEnd(game: Game): void {
  let guard = 0;
  while (game.state.phase !== 'finished') {
    if (guard++ > 10_000) throw new Error('決着しませんでした(無限ループ)');
    const legal = game.myLegal;
    if (legal.phase === 'submitting') {
      // 買えるスキルの先頭 + 入札0(常に合法)。
      game.submit(legal.options[0].skill, 0);
    } else if (legal.phase === 'vision') {
      game.selectVision(legal.peeked[0]);
    } else if (legal.phase === 'choosing') {
      game.choose(legal.candidates[0] ?? null);
    } else {
      break;
    }
  }
}

describe('Game(UI ドライバ)', () => {
  it('構築直後はゲーム未開始・未保存(タイトル画面用)', () => {
    const storage = fakeStorage();
    const game = new Game(storage);
    // constructor は開始も保存もしない。つづきから条件は false。
    expect(game.hasSave()).toBe(false);
    expect(storage.getItem('auction-bingo:save')).toBeNull();
  });

  it('newGame から CPU 自動進行を挟みつつ決着まで到達し result が入る', () => {
    const game = new Game(fakeStorage());
    game.newGame();
    playHumanToEnd(game);
    expect(game.state.phase).toBe('finished');
    expect(game.state.result).not.toBeNull();
    expect(game.state.result!.winners.length).toBeGreaterThanOrEqual(1);
  });

  it('進行中は保存され, 別インスタンスの resume で状態が復元される', () => {
    const storage = fakeStorage();
    const game = new Game(storage);
    game.newGame();
    // 数手だけ進める。
    for (let i = 0; i < 3 && game.state.phase !== 'finished'; i++) {
      const legal = game.myLegal;
      if (legal.phase === 'submitting') game.submit(legal.options[0].skill, 0);
      else if (legal.phase === 'vision') game.selectVision(legal.peeked[0]);
      else if (legal.phase === 'choosing')
        game.choose(legal.candidates[0] ?? null);
    }
    const snapshot = {
      turn: game.state.turn,
      phase: game.state.phase,
      coins: game.state.players.map((p) => p.coins),
    };
    // 同じ Storage で作り直して resume = リロード後の「つづきから」相当。
    const restored = new Game(storage);
    expect(restored.hasSave()).toBe(true);
    expect(restored.resume()).toBe(true);
    expect(restored.state.turn).toBe(snapshot.turn);
    expect(restored.state.phase).toBe(snapshot.phase);
    expect(restored.state.players.map((p) => p.coins)).toEqual(snapshot.coins);
  });

  it('破損セーブは resume が false を返して破棄する', () => {
    const storage = fakeStorage();
    storage.setItem('auction-bingo:save', '{ broken');
    const game = new Game(storage);
    expect(game.resume()).toBe(false);
    // 破損セーブは復元不能として扱われ, つづきから条件は立たない。
    expect(game.hasSave()).toBe(false);
  });

  it('CPU 座席は傾向文を返し, 人間座席は空文字を返す', () => {
    const game = new Game(fakeStorage());
    // p1=レオ / p2=サラ は非空の傾向文を持つ(UI の常時表示の情報源)。
    expect(game.tendencyOf('p1').length).toBeGreaterThan(0);
    expect(game.tendencyOf('p2').length).toBeGreaterThan(0);
    // 人間(p0)には Agent が無いので空文字。
    expect(game.tendencyOf('p0')).toBe('');
  });

  it('不正手(範囲外の入札)は no-op で state を変えない', () => {
    const game = new Game(fakeStorage());
    game.newGame();
    const before = game.state.turn;
    const phaseBefore = game.state.phase;
    // coins を大きく超える入札は applySubmit が拒否する。
    game.submit(null, 9999);
    // 提出が拒否されれば submitting のまま・ターン不変。
    expect(game.state.turn).toBe(before);
    expect(game.state.phase).toBe(phaseBefore);
  });
});
