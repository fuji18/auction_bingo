/**
 * コイン保存則の統合テスト。
 *
 * コインは「銀行回収・スキル代の徴収・上限切り捨て」というシンクを除いて増えない。
 * イベントログ全体から各シンクを再構成し、
 *   最終総コイン + Σシンク == 初期総額 + Σ付与 income(意図値)
 * が厳密に成立することを検証する。あわせて各 Settled の局所保存
 *   paid == Σreceived + toBank
 * と、コインが非負・coinCap を超えないことを確認する。
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../src/core/config';
import type { GameEvent, PlayerId, SkillId } from '../src/core/types';
import { playGame } from './support/driver';

const SEEDS = [1, 42, 123456789, 2026, 7, 100, 999];

/** そのターンの落札者が提出したスキル(精算時の shift/greed 徴収の再構成に使う)。 */
function winnerSkillInTurn(
  turnEvents: GameEvent[],
  payer: PlayerId
): SkillId | null {
  const sub = turnEvents.find(
    (e): e is Extract<GameEvent, { type: 'Submitted' }> =>
      e.type === 'Submitted' && e.playerId === payer
  );
  return sub ? sub.skill : null;
}

describe('コイン保存則', () => {
  it.each(SEEDS)('全編を通してコインが創出されない (seed=%i)', (seed) => {
    const config = DEFAULT_CONFIG;
    // クランプ喪失量を capped.length × income で再構成するため、income=1 に依存する
    // (income>1 では coins_before に応じて喪失量が income 未満になり得る)。
    // DEFAULT_CONFIG を変えたらこのガードで気づけるようにする。
    expect(config.economy.incomePerTurn).toBe(1);

    const { finalState, events } = playGame(config, seed);
    const n = config.playerCount;
    const visionCost = config.skills.vision.cost;
    const initialTotal = config.economy.initialCoins * n;

    let incomeGranted = 0;
    let sinkCapLoss = 0;
    let sinkBank = 0;
    let sinkVision = 0;
    let sinkWinnerSkill = 0;

    // ターン境界(TurnStarted)でイベントを区切りながら集計する。
    let turnEvents: GameEvent[] = [];
    const flush = () => {
      for (const e of turnEvents) {
        if (e.type === 'TurnStarted') {
          // e.income は実際に支給された1人あたり額(ターン1は0)。
          incomeGranted += e.income * n;
          sinkCapLoss += e.capped.length * e.income;
        } else if (e.type === 'VisionResolved') {
          sinkVision += visionCost;
        } else if (e.type === 'Settled') {
          const received = Object.values(e.received).reduce((a, b) => a + b, 0);
          // 局所保存: 入札額 = 分配 + 銀行回収。
          expect(e.paid).toBe(received + e.toBank);
          sinkBank += e.toBank;
          const skill = winnerSkillInTurn(turnEvents, e.payer);
          if (skill === 'shift' || skill === 'greed') {
            sinkWinnerSkill += config.skills[skill].cost;
          }
        }
      }
    };

    for (const e of events) {
      if (e.type === 'TurnStarted') {
        flush();
        turnEvents = [e];
      } else {
        turnEvents.push(e);
      }
    }
    flush();

    const finalTotal = finalState.players.reduce((a, p) => a + p.coins, 0);
    const totalSinks = sinkCapLoss + sinkBank + sinkVision + sinkWinnerSkill;

    expect(finalTotal + totalSinks).toBe(initialTotal + incomeGranted);
  });

  it.each(SEEDS)('コインが非負かつ coinCap を超えない (seed=%i)', (seed) => {
    const { finalState } = playGame(DEFAULT_CONFIG, seed);
    for (const p of finalState.players) {
      expect(p.coins).toBeGreaterThanOrEqual(0);
      expect(p.coins).toBeLessThanOrEqual(DEFAULT_CONFIG.economy.coinCap);
    }
  });
});
