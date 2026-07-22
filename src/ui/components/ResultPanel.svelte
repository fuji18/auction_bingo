<script lang="ts">
  /**
   * 決着画面。core が確定させた GameResult を描画するだけ(ルール判断なし)。
   * 「どの基準で決まったか」(decidedBy)と順位表を示し、勝敗の根拠を明示する
   * (docs/product-requirements.md「4. 勝利条件と決着」)。
   */
  import type { GameResult, PlayerId } from '../../core/types';
  import { DECIDED_BY_LABELS, playerName } from '../replay/replay';

  interface Props {
    result: GameResult;
    /** リプレイ表示へ切り替える。 */
    onreplay: () => void;
    /** 新しいゲームを開始する(もう一度)。 */
    onnewgame: () => void;
    /** タイトル画面へ戻る。 */
    ontitle: () => void;
  }
  let { result, onreplay, onnewgame, ontitle }: Props = $props();

  const HUMAN: PlayerId = 'p0';
  let winnerSet = $derived(new Set(result.winners));
  let solo = $derived(result.winners.length === 1);

  // 決着の一文: ビンゴ達成 か 25ターン経過 か + どの基準で決まったか。
  let headline = $derived.by(() => {
    const by = DECIDED_BY_LABELS[result.decidedBy];
    switch (result.kind) {
      case 'bingo':
        return 'ビンゴ達成で決着';
      case 'draw-bingo':
        return '同時ビンゴで引き分け';
      case 'timeup':
        return `25ターン経過 — ${by}で決着`;
      case 'draw-timeup':
        return `25ターン経過 — ${by}`;
    }
  });
</script>

<div class="result" aria-label="決着画面">
  <p class="title">ゲーム終了</p>

  <p class="winner" class:win={winnerSet.has(HUMAN)}>
    {#if solo}
      🏆 勝者: {playerName(result.winners[0])}
    {:else}
      引き分け: {result.winners.map(playerName).join('・')}
    {/if}
  </p>

  <p class="headline">
    決着基準: <strong>{DECIDED_BY_LABELS[result.decidedBy]}</strong>
    <span class="sub">({headline})</span>
  </p>

  <table class="standings">
    <thead>
      <tr>
        <th scope="col">順位</th>
        <th scope="col">プレイヤー</th>
        <th scope="col" title="完成ライン数">ライン</th>
        <th scope="col" title="リーチライン本数">リーチ</th>
        <th scope="col" title="総マーク数">マーク</th>
        <th scope="col" title="コイン残">🪙</th>
      </tr>
    </thead>
    <tbody>
      {#each result.standings as s, i (s.playerId)}
        <tr class:winrow={winnerSet.has(s.playerId)}>
          <td>{i + 1}</td>
          <td class="pname">
            {playerName(s.playerId)}
            {#if winnerSet.has(s.playerId)}<span aria-hidden="true">👑</span
              >{/if}
          </td>
          <td class="num">{s.lines}</td>
          <td class="num">{s.reachCount}</td>
          <td class="num">{s.markCount}</td>
          <td class="num">{s.coins}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="actions">
    <button type="button" class="replay" onclick={onreplay}>
      手の内を見る(リプレイ)
    </button>
    <button type="button" class="newgame" onclick={onnewgame}>
      もう一度
    </button>
    <button type="button" class="title" onclick={ontitle}> タイトルへ </button>
  </div>
</div>

<style>
  .result {
    display: grid;
    gap: 0.6rem;
  }
  .title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 800;
  }
  .winner {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
  }
  .winner.win {
    color: seagreen;
  }
  .headline {
    margin: 0;
    font-size: 0.9rem;
  }
  .headline .sub {
    opacity: 0.7;
    font-size: 0.8rem;
  }
  .standings {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .standings th,
  .standings td {
    padding: 0.35rem 0.4rem;
    border-block-end: 1px solid
      color-mix(in srgb, currentColor 15%, transparent);
    text-align: center;
  }
  .standings th {
    font-size: 0.72rem;
    opacity: 0.75;
    font-weight: 700;
  }
  .standings .pname {
    text-align: start;
    font-weight: 700;
  }
  .standings .num {
    font-variant-numeric: tabular-nums;
  }
  .winrow {
    background: color-mix(in srgb, seagreen 16%, transparent);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-block-start: 0.3rem;
  }
  .actions button {
    flex: 1 1 auto;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 700;
    cursor: pointer;
  }
  .replay {
    background: royalblue;
  }
  .newgame {
    background: seagreen;
  }
  .title {
    background: color-mix(in srgb, currentColor 55%, transparent);
  }
</style>
