import { describe, it, expect } from 'vitest';
import { hoarder } from './baseline/hoarder';
import { allIn } from './baseline/allIn';
import { noSkill } from './baseline/noSkill';
import { random } from './baseline/random';
import { leo } from './leo';
import { sara } from './sara';
import { createAgent, AGENTS } from './registry';
import { emptyBoard, pubWith, secOf, playGame } from './testkit';
import { skillCostOf } from './shared';

const boards = () => ({
  p0: emptyBoard(),
  p1: emptyBoard(),
  p2: emptyBoard(),
});

describe('baseline hoarder / allIn', () => {
  it('hoarder は常に入札 0・スキル無し', () => {
    const pub = pubWith(boards());
    expect(hoarder.submit(pub, secOf('p0'))).toEqual({ skill: null, bid: 0 });
  });

  it('allIn は全コインを入札・スキル無し', () => {
    const pub = pubWith(boards());
    pub.players[0].coins = 12;
    expect(allIn.submit(pub, secOf('p0'))).toEqual({ skill: null, bid: 12 });
  });
});

describe('baseline noSkill', () => {
  it('スキルは常に null、desire>0 で強め・0 で控えめ', () => {
    const active = pubWith(boards(), { target: 3 }); // desire(0)=1
    const idle = pubWith(boards(), { target: 40 }); // desire(0)=0
    expect(noSkill.submit(active, secOf('p0'))).toEqual({
      skill: null,
      bid: 8,
    }); // round(15×0.5)
    expect(noSkill.submit(idle, secOf('p0'))).toEqual({ skill: null, bid: 2 }); // round(15×0.1)
  });
});

describe('baseline random', () => {
  it('合法な範囲(feasible skill・[0,maxBid] の整数 bid)を返し、決定的', () => {
    const pub = pubWith(boards());
    pub.players[0].coins = 13;
    const a = random.submit(pub, secOf('p0'));
    const b = random.submit(pub, secOf('p0'));
    expect(a).toEqual(b); // 同一 state から決定的
    const cost = skillCostOf(pub.config, a.skill);
    expect(cost).toBeLessThanOrEqual(13); // feasible
    expect(Number.isInteger(a.bid)).toBe(true);
    expect(a.bid).toBeGreaterThanOrEqual(0);
    expect(a.bid).toBeLessThanOrEqual(13 - cost);
  });
});

describe('registry', () => {
  it('名前から Agent を引ける', () => {
    expect(createAgent('leo')).toBe(AGENTS.leo);
    expect(createAgent('hoarder')).toBe(AGENTS.hoarder);
  });
  it('未知の名前は throw', () => {
    expect(() => createAgent('unknown')).toThrow();
  });
});

describe('統合: agents が最後まで合法手を打ち、ゲームが決着する', () => {
  it('leo/sara/hoarder で finished に到達し result が出る', () => {
    const end = playGame({ p0: leo, p1: sara, p2: hoarder }, 42);
    expect(end.phase).toBe('finished');
    expect(end.result).not.toBeNull();
  });

  it('random/allIn/noSkill でも決着する', () => {
    const end = playGame({ p0: random, p1: allIn, p2: noSkill }, 7);
    expect(end.phase).toBe('finished');
    expect(end.result).not.toBeNull();
  });

  it('同一シード・同一 agents で決定的に同じ結果', () => {
    const a = playGame({ p0: leo, p1: sara, p2: random }, 123);
    const b = playGame({ p0: leo, p1: sara, p2: random }, 123);
    expect(a.result).toEqual(b.result);
  });
});
