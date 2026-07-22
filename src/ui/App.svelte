<script lang="ts">
  /**
   * 対戦画面のルート。core の state を描画し、人間(p0)の入力を Game 経由で reduce に送るだけ。
   * ルール判断(合法性・落札者・ビンゴ)は一切持たず、legalActions が返す範囲でのみ入力させる。
   * CPU の手番は Game が自動進行させるため、UI は人間の入力待ち状態と決着だけを描画する。
   */
  import type { PlayerId, SkillId } from '../core/types';
  import { previewCandidates } from '../core/reduce';
  import { Game } from './game.svelte';
  import BoardView from './components/BoardView.svelte';
  import SubmitPanel from './components/SubmitPanel.svelte';
  import ResolveLog from './components/ResolveLog.svelte';
  import TellBadge from './components/TellBadge.svelte';
  import TokenMark from './components/TokenMark.svelte';
  import ResultPanel from './components/ResultPanel.svelte';
  import ReplayView from './replay/ReplayView.svelte';

  const HUMAN: PlayerId = 'p0';
  const game = new Game();

  // 提出中に選択したスキルの候補プレビュー(自盤面ハイライト用)。
  let previewSkill = $state<SkillId | null>(null);

  // 決着後の表示切替(決着画面 ⇄ リプレイ)。
  let resultView = $state<'result' | 'replay'>('result');

  function startNewGame(): void {
    resultView = 'result';
    game.newGame();
  }

  let pub = $derived(game.pub);
  let legal = $derived(game.myLegal);
  let tokenHolder = $derived(pub.players[pub.tokenIndex]?.id);
  let me = $derived(pub.players.find((p) => p.id === HUMAN));

  // 自盤面のハイライト: 提出中はスキルの候補プレビュー、数字選択中は落札候補。
  let myHighlight = $derived.by(() => {
    if (legal.phase === 'submitting' && legal.options.length > 0) {
      return previewCandidates(game.state, previewSkill);
    }
    if (legal.phase === 'choosing' && legal.candidates.length > 0) {
      return legal.candidates;
    }
    return [];
  });

  let result = $derived(game.state.result);

  function onSubmit(skill: SkillId | null, bid: number): void {
    previewSkill = null;
    game.submit(skill, bid);
  }
</script>

<main>
  <header class="topbar">
    <span class="turn"
      >ターン {game.state.turn} / {game.state.config.maxTurns}</span
    >
    <span class="coins">
      🪙 {me?.coins ?? 0}
      {#if me && me.reserved > 0}<span class="reserved"
          >(予約 {me.reserved})</span
        >{/if}
    </span>
  </header>

  <details class="fairness">
    <summary>このゲームの CPU について(フェアネス)</summary>
    <ul>
      <li>名前の下の傾向文は、各 CPU の意思決定のクセを説明したものです。</li>
      <li>
        提出前に出る 1 語のテル(例:「強気」「様子見」)は<strong
          >確率的なヒント</strong
        >で、確定情報ではありません。実際の入札とずれることがあります。
      </li>
      <li>
        CPU は<strong
          >非公開情報(他者の入札・山札・他者の予知結果)を参照しません</strong
        >。自分に見える公開情報と自分の秘密情報だけで手を決めます。
      </li>
    </ul>
  </details>

  <section class="target" aria-label="今ターンのターゲット">
    <span class="tlabel">ターゲット</span>
    <span class="tval">{game.state.target}</span>
    <span class="deck">山札 残り {pub.deckSize} 枚</span>
  </section>

  <section class="players">
    {#each pub.players as p (p.id)}
      <div class="player" class:me={p.id === HUMAN}>
        <div class="pinfo">
          <span class="pname">{p.name}</span>
          <span class="pcoins">🪙{p.coins}</span>
          {#if tokenHolder === p.id}<TokenMark />{/if}
          {#if p.id !== HUMAN}<TellBadge text={game.tellOf(p.id)} />{/if}
          {#if p.id !== HUMAN}
            <span class="tendency">{game.tendencyOf(p.id)}</span>
          {/if}
        </div>
        <BoardView
          board={p.board}
          compact={p.id !== HUMAN}
          highlight={p.id === HUMAN ? myHighlight : []}
          label={`${p.name} の盤面`}
        />
      </div>
    {/each}
  </section>

  <section class="action">
    {#if legal.phase === 'submitting' && legal.options.length > 0}
      {#key game.state.turn}
        <SubmitPanel
          options={legal.options}
          coins={me?.coins ?? 0}
          skills={game.state.config.skills}
          onskillchange={(s) => (previewSkill = s)}
          onsubmit={onSubmit}
        />
      {/key}
    {:else if legal.phase === 'vision' && legal.peeked.length > 0}
      <div class="vision">
        <p class="prompt">予知: 山札の先頭に仕込む 1 枚を選ぶ</p>
        <div class="choices">
          {#each legal.peeked as n (n)}
            <button type="button" onclick={() => game.selectVision(n)}
              >{n}</button
            >
          {/each}
        </div>
      </div>
    {:else if legal.phase === 'choosing' && legal.candidates.length > 0}
      <div class="choose">
        <p class="prompt">
          落札! マークする数字を選ぶ(自盤面の候補を金枠で表示)
        </p>
        <div class="choices">
          {#each legal.candidates as n (n)}
            <button type="button" onclick={() => game.choose(n)}>{n}</button>
          {/each}
          <button type="button" class="pass" onclick={() => game.choose(null)}
            >パス</button
          >
        </div>
      </div>
    {:else if legal.phase === 'finished' && result}
      {#if resultView === 'replay'}
        <ReplayView
          log={game.state.log}
          onback={() => (resultView = 'result')}
        />
      {:else}
        <ResultPanel
          {result}
          onreplay={() => (resultView = 'replay')}
          onnewgame={startNewGame}
        />
      {/if}
    {/if}
  </section>

  {#if legal.phase !== 'finished'}
    <section class="logsec" aria-label="解決ログ">
      <ResolveLog
        events={game.recent}
        names={{ p0: 'あなた', p1: 'レオ', p2: 'サラ' }}
      />
    </section>
  {/if}
</main>

<style>
  main {
    max-inline-size: 480px;
    margin-inline: auto;
    padding: 0.6rem;
    display: grid;
    gap: 0.7rem;
  }
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-weight: 700;
  }
  .reserved {
    font-size: 0.75rem;
    font-weight: 400;
    opacity: 0.7;
  }
  .target {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    padding: 0.4rem;
    border-radius: 10px;
    background: color-mix(in srgb, currentColor 8%, transparent);
  }
  .tlabel {
    font-size: 0.8rem;
    opacity: 0.75;
  }
  .tval {
    font-size: 2.4rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .deck {
    font-size: 0.72rem;
    opacity: 0.6;
  }
  .players {
    display: grid;
    gap: 0.5rem;
  }
  .player {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  }
  .player.me {
    border-color: color-mix(in srgb, royalblue 55%, transparent);
  }
  .pinfo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.4rem;
  }
  .pname {
    font-weight: 700;
  }
  .tendency {
    flex-basis: 100%;
    font-size: 0.72rem;
    opacity: 0.65;
    line-height: 1.3;
  }
  .fairness {
    font-size: 0.8rem;
    padding: 0.4rem 0.5rem;
    border-radius: 8px;
    background: color-mix(in srgb, currentColor 6%, transparent);
  }
  .fairness summary {
    cursor: pointer;
    font-weight: 700;
    opacity: 0.85;
  }
  .fairness ul {
    margin: 0.4rem 0 0.1rem;
    padding-inline-start: 1.1rem;
    display: grid;
    gap: 0.3rem;
    opacity: 0.85;
  }
  .pcoins {
    font-variant-numeric: tabular-nums;
  }
  .action {
    min-block-size: 2rem;
  }
  .prompt {
    margin: 0 0 0.4rem;
    font-weight: 700;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .choices button {
    min-inline-size: 2.6rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid royalblue;
    border-radius: 6px;
    background: color-mix(in srgb, royalblue 15%, transparent);
    color: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
  }
  .choices .pass {
    border-color: color-mix(in srgb, currentColor 40%, transparent);
    background: transparent;
    font-weight: 400;
  }
</style>
