/**
 * 自動対戦シミュレーションの CLI エントリ。
 *
 *   npm run sim -- --games 10000 --seed 1 --agents leo,sara,allIn
 *
 * プライマリー KPI の既定計測は「実際の対戦(レオ・サラ + 能動的な第三席)」を代表させる
 * ため第三席に allIn(全力入札=攻めの人間像)を置く。貯め込み(hoarder)は「非入札戦略が
 * 支配しないか」を見る支配的戦略クロスチェック用に別途回す(docs/product-requirements.md
 * 「成功指標(KPI)」)。
 *
 * N 戦を回して KPI 7 項目を集計し、目標レンジと PASS/WARN 付きで出力する。
 * KPI が目標を割っても異常終了しない(バランス調整は継続作業のため。CI を赤にしない)。
 * `console` は sim/ 層でのみ許可される(ESLint 規則)。
 */

import { DEFAULT_CONFIG } from '../core/config';
import type { PlayerId } from '../core/types';
import { createAgent } from '../agents/registry';
import type { Agent } from '../agents/types';
import { playOne } from './play';
import { extractGame, summarize } from './metrics';
import type { Metrics, SkillKey } from './metrics';

const PLAYER_IDS: PlayerId[] = ['p0', 'p1', 'p2'];

interface Options {
  games: number;
  seed: number;
  agents: string[];
}

/** `--key value` / `--key=value` を解析する。未知フラグは無視しない(throw)。 */
function parseArgs(argv: string[]): Options {
  const opts: Options = {
    games: 10_000,
    seed: 1,
    agents: ['leo', 'sara', 'allIn'],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inlineVal = eq >= 0 ? arg.slice(eq + 1) : undefined;
    const nextVal = () => {
      if (inlineVal !== undefined) return inlineVal;
      const v = argv[++i];
      if (v === undefined) throw new Error(`${key} に値がありません`);
      return v;
    };

    switch (key) {
      case '--games':
        opts.games = Number(nextVal());
        break;
      case '--seed':
        opts.seed = Number(nextVal());
        break;
      case '--agents':
        opts.agents = nextVal()
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      default:
        throw new Error(`未知のオプション: ${arg}`);
    }
  }

  if (!Number.isInteger(opts.games) || opts.games <= 0) {
    throw new Error(`--games は正の整数である必要があります: ${opts.games}`);
  }
  // rng.ts は seed を整数前提とする(非整数は 32bit 切り詰めのタイミングがずれる)。
  if (!Number.isInteger(opts.seed)) {
    throw new Error(`--seed は整数である必要があります: ${opts.seed}`);
  }
  if (opts.agents.length !== DEFAULT_CONFIG.playerCount) {
    throw new Error(
      `--agents は ${DEFAULT_CONFIG.playerCount} 名を指定してください(現在: ${opts.agents.join(', ') || 'なし'})`
    );
  }
  return opts;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** 目標レンジ内かどうかで PASS/WARN を返す。 */
function judge(value: number, min: number, max: number): string {
  return value >= min && value <= max ? 'PASS' : 'WARN';
}

function report(metrics: Metrics, opts: Options, elapsedMs: number): string {
  const m = metrics;
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('オークション・ビンゴ シミュレーション結果');
  lines.push('='.repeat(60));
  lines.push(
    `games=${m.games}  seed=${opts.seed}  agents=${opts.agents.join(',')}  elapsed=${(elapsedMs / 1000).toFixed(2)}s`
  );
  lines.push('');
  lines.push('--- プライマリー KPI(目標) ---');
  lines.push(
    `ビンゴ発生率        : ${pct(m.bingoRate)}   (≥95%)        [${judge(m.bingoRate, 0.95, 1)}]`
  );
  lines.push(
    `スキル使用率        : ${pct(m.skillUsageRate)}   (40-60%)      [${judge(m.skillUsageRate, 0.4, 0.6)}]`
  );
  lines.push(
    `落札×勝率 相関(r)  : ${m.auctionWinCorrelation.toFixed(3)}   (参考)         [INFO]  ※第三席の攻撃性で符号が反転する参考指標。中心性は支配的戦略 KPI で担保`
  );
  lines.push(
    `支配的戦略の勝率    : ${pct(m.dominantStrategyWinRate)}   (<50%)        [${judge(m.dominantStrategyWinRate, 0, 0.4999999)}]`
  );
  lines.push(
    `平均決着ターン      : ${m.avgFinishTurn.toFixed(2)}   (16-20)       [${judge(m.avgFinishTurn, 16, 20)}]`
  );
  lines.push(
    `終盤 単一スキル支配 : ${pct(m.lateSkillDominance)}   (≤70%)        [${judge(m.lateSkillDominance, 0, 0.7)}]  ※終盤にスキルを買った提出内の最大シェア`
  );
  lines.push(
    `パス率              : ${pct(m.passRate)}   (1-15%)       [${judge(m.passRate, 0.01, 0.15)}]`
  );
  lines.push('');
  lines.push('--- スロット別勝率(支配的戦略の検証) ---');
  for (const s of m.strategyWinRates) {
    lines.push(`  ${s.playerId} ${s.agent.padEnd(10)}: ${pct(s.winRate)}`);
  }
  lines.push('');
  lines.push('--- 終盤(残り5ターン)のスキル選択比率 ---');
  const skillKeys: SkillKey[] = ['none', 'shift', 'vision', 'greed'];
  const label: Record<SkillKey, string> = {
    none: 'なし',
    shift: '偏向',
    vision: '予知',
    greed: '強奪',
  };
  for (const k of skillKeys) {
    lines.push(`  ${label[k].padEnd(6)}: ${pct(m.lateSkillShare[k])}`);
  }
  lines.push('='.repeat(60));
  return lines.join('\n');
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  const agents = {} as Record<PlayerId, Agent>;
  const agentBySlot = {} as Record<PlayerId, string>;
  PLAYER_IDS.forEach((pid, i) => {
    agents[pid] = createAgent(opts.agents[i]);
    agentBySlot[pid] = opts.agents[i];
  });

  const start = performance.now();
  const games = [];
  for (let i = 0; i < opts.games; i++) {
    const state = playOne(agents, DEFAULT_CONFIG, opts.seed + i);
    games.push(extractGame(state));
  }
  const elapsedMs = performance.now() - start;

  const metrics = summarize(games, agentBySlot);
  console.log(report(metrics, opts, elapsedMs));
}

main();
