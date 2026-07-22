/**
 * 名前 → Agent の解決。#9 の `npm run sim -- --agents leo,sara,hoarder` が
 * 文字列から Agent を引くために使う(sim 側が個別ファイルへ import で散らばらないように)。
 */

import type { Agent } from './types';
import { leo } from './leo';
import { sara } from './sara';
import { hoarder } from './baseline/hoarder';
import { allIn } from './baseline/allIn';
import { noSkill } from './baseline/noSkill';
import { random } from './baseline/random';

/** 利用可能な Agent の一覧(名前は sim の --agents で使う識別子)。 */
export const AGENTS = {
  leo,
  sara,
  hoarder,
  allIn,
  noSkill,
  random,
} satisfies Record<string, Agent>;

export type AgentName = keyof typeof AGENTS;

/** 名前から Agent を引く。未知の名前は throw する。 */
export function createAgent(name: string): Agent {
  if (name in AGENTS) return AGENTS[name as AgentName];
  throw new Error(
    `未知の Agent 名: ${name}(利用可能: ${Object.keys(AGENTS).join(', ')})`
  );
}
