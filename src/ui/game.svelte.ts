/**
 * 対戦の state 保持と手番オーケストレーション(runes)。
 *
 * `core/reduce` を呼んで `GameState` を描画可能な形で保持するだけの薄い層。
 * ルール判断(合法性・落札者・ビンゴ)は一切持たず、`legalActions`/`reduce` の結果を
 * 読むだけ。CPU(p1=レオ / p2=サラ)の手番は `sim/play.ts` と同型に自動進行させる。
 *
 * 保存は seed + 適用した全アクションで行い、復元は同じ actions を reduce で再計算する
 * (`storage.ts`)。「誰が UI 入力で誰が Agent か」を決めるのは core ではなく呼び出し側、
 * という設計(docs/repository-structure.md「src/agents/」)をこの層で体現する。
 */

import { DEFAULT_CONFIG } from '../core/config';
import { createGame, legalActions, reduce } from '../core/reduce';
import { toPublicView, toSecretView } from '../core/view';
import type {
  Action,
  ActionSpec,
  GameEvent,
  GameState,
  PlayerId,
  PublicView,
  SkillId,
} from '../core/types';
import type { Agent } from '../agents/types';
import { leo } from '../agents/leo';
import { sara } from '../agents/sara';
import { clearGame, loadGame, saveGame } from './storage';

/** 人間が操作する座席。残りは CPU。 */
const HUMAN: PlayerId = 'p0';

/** 座席 → CPU Agent。p0(人間)は持たない。 */
const CPU_AGENTS: Partial<Record<PlayerId, Agent>> = { p1: leo, p2: sara };

/** 新規ゲームのシード(1..2^31-1)。乱数は core に持ち込まず UI 層で生成する。 */
function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

/** ログ末尾の「直近ターン分」(最後の TurnStarted 以降)を返す。復元後の ResolveLog 初期表示用。 */
function lastTurnEvents(log: GameEvent[]): GameEvent[] {
  let start = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].type === 'TurnStarted') {
      start = i;
      break;
    }
  }
  return log.slice(start);
}

/**
 * 対戦1件の reactive な状態機械。App.svelte はこのインスタンスを 1 つ持ち、
 * ゲッターを描画し、人間の手番メソッド(submit/selectVision/choose)を呼ぶ。
 */
export class Game {
  /** 現在のゲーム状態(reactive)。 */
  state = $state<GameState>(createGame(DEFAULT_CONFIG, 1));
  /** 直近ターンの解決イベント(ResolveLog 表示用・reactive)。 */
  recent = $state<GameEvent[]>([]);

  private seed = 1;
  private actions: Action[] = [];
  private readonly storage: Storage;

  constructor(storage: Storage = localStorage) {
    this.storage = storage;
    this.restoreOrNew();
  }

  // ---- 表示用ゲッター(reactive、this.state を読むので自動追跡) ----

  /** 全員に見せてよい公開情報。 */
  get pub(): PublicView {
    return toPublicView(this.state);
  }

  /** 人間(p0)が現フェーズで取り得る合法アクションの範囲。 */
  get myLegal(): ActionSpec {
    return legalActions(this.state, HUMAN);
  }

  /** CPU のテル(1 語)。人間座席は空文字。 */
  tellOf(id: PlayerId): string {
    const agent = CPU_AGENTS[id];
    if (!agent) return '';
    return agent.tell(toPublicView(this.state), toSecretView(this.state, id));
  }

  // ---- 人間の手番(UI から呼ぶ) ----

  submit(skill: SkillId | null, bid: number): void {
    this.apply({ type: 'SUBMIT', playerId: HUMAN, skill, bid });
    this.driveCpu();
    this.persist();
  }

  selectVision(keep: number): void {
    this.apply({ type: 'SELECT_VISION', playerId: HUMAN, keep });
    this.driveCpu();
    this.persist();
  }

  choose(value: number | null): void {
    this.apply({ type: 'CHOOSE', playerId: HUMAN, value });
    this.driveCpu();
    this.persist();
  }

  /** 新しいゲームを開始する(保存を上書き)。 */
  newGame(seed: number = randomSeed()): void {
    this.seed = seed;
    this.actions = [];
    this.state = createGame(DEFAULT_CONFIG, seed);
    this.recent = [...this.state.log];
    this.driveCpu();
    this.persist();
  }

  // ---- 内部 ----

  /** 1 アクションを reduce に通す。適用できたら true、no-op(不正手)なら false。 */
  private apply(action: Action): boolean {
    const before = this.state.turn;
    const { state, events } = reduce(this.state, [action]);
    if (events.length === 0) return false;
    this.state = state;
    this.actions.push(action);
    // ターンが進んだら直近ログを一度クリアしてから今回分を積む。
    this.recent = state.turn !== before ? events : [...this.recent, ...events];
    return true;
  }

  /** 人間入力待ちか決着まで CPU 手番を自動で進める。 */
  private driveCpu(): void {
    while (this.state.phase !== 'finished' && !this.needsHuman()) {
      const action = this.cpuAction();
      if (!action) break; // 想定外の状態(手番不在)。
      // CPU が legalActions 範囲外の手を返し reduce に no-op で拒否されると、
      // 同じ状態から同じ手を再生成して同期無限ループ(タブ凍結)になる。
      // sim/play.ts の MAX_STEPS 相当の保険として、適用されなければ中断する。
      if (!this.apply(action)) break;
    }
  }

  /** 現フェーズが人間(p0)の入力を要するか。core が出した結果を読むだけ。 */
  private needsHuman(): boolean {
    const s = this.state;
    switch (s.phase) {
      case 'submitting':
        return !s.submissions.some((x) => x.playerId === HUMAN);
      case 'vision':
        return (s.visionPeek[HUMAN]?.length ?? 0) > 0;
      case 'choosing':
        return s.auctionWinner === HUMAN;
      default:
        return false;
    }
  }

  /** 現フェーズで手番の CPU が取るアクション。手番が人間/不在なら null。 */
  private cpuAction(): Action | null {
    const s = this.state;
    const pub = toPublicView(s);

    if (s.phase === 'submitting') {
      const submittedIds = s.submissions.map((x) => x.playerId);
      const pid = s.players
        .map((p) => p.id)
        .find((id) => id !== HUMAN && !submittedIds.includes(id));
      const agent = pid ? CPU_AGENTS[pid] : undefined;
      if (!pid || !agent) return null;
      const { skill, bid } = agent.submit(pub, toSecretView(s, pid));
      return { type: 'SUBMIT', playerId: pid, skill, bid };
    }

    if (s.phase === 'vision') {
      const pid = s.players
        .map((p) => p.id)
        .find((id) => (s.visionPeek[id]?.length ?? 0) > 0);
      const agent = pid ? CPU_AGENTS[pid] : undefined;
      if (!pid || !agent) return null;
      const keep = agent.selectVision(
        pub,
        toSecretView(s, pid),
        s.visionPeek[pid]
      );
      return { type: 'SELECT_VISION', playerId: pid, keep };
    }

    if (s.phase === 'choosing') {
      const pid = s.auctionWinner;
      const agent = pid ? CPU_AGENTS[pid] : undefined;
      if (!pid || !agent) return null;
      const value = agent.chooseNumber(pub, toSecretView(s, pid), s.candidates);
      return { type: 'CHOOSE', playerId: pid, value };
    }

    return null;
  }

  /** 進行中は保存、決着したら保存を破棄する。 */
  private persist(): void {
    if (this.state.phase === 'finished') {
      clearGame(this.storage);
    } else {
      saveGame(this.storage, this.seed, this.actions);
    }
  }

  /** 保存があれば復元、無ければ・壊れていれば新規開始する。 */
  private restoreOrNew(): void {
    const saved = loadGame(this.storage);
    if (saved) {
      try {
        const restored = reduce(
          createGame(DEFAULT_CONFIG, saved.seed),
          saved.actions
        );
        this.seed = saved.seed;
        this.actions = [...saved.actions];
        this.state = restored.state;
        // 復元後もその局面の直近ターンの解決ログを見せる(リロードでログだけ消えない)。
        this.recent = lastTurnEvents(restored.state.log);
        // 保存は人間手番後なので通常は何もしないが、念のため整える。
        this.driveCpu();
        this.persist();
        return;
      } catch {
        clearGame(this.storage);
      }
    }
    this.newGame();
  }
}
