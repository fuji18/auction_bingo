<script lang="ts">
  /**
   * 試合後リプレイ。core が確定させた log(全 GameEvent[])を groupTurns でターン単位へ
   * 分割し、各ターンの入札額・購入スキル・選択数字・精算を全開示する
   * (docs/product-requirements.md「6. 試合後リプレイ」)。予知は覗いた 3 枚と選んだ 1 枚まで
   * 開示する(ResolveLog が伏せる部分もここでは全開示)。覗いた枚数は config.skills.vision.peek
   * 依存のため events の peeked.length をそのまま表示する。ルール判断は一切持たない。
   */
  import type { GameEvent, PlayerId } from '../../core/types';
  import { groupTurns, playerName, skillLabel } from './replay';

  interface Props {
    log: GameEvent[];
    /** 決着画面へ戻る。 */
    onback: () => void;
  }
  let { log, onback }: Props = $props();

  let turns = $derived(groupTurns(log));

  /** 精算の受取内訳を、受取額 > 0 の座席だけ型付きで返す。 */
  function receivedEntries(
    received: Record<PlayerId, number>
  ): { id: PlayerId; amount: number }[] {
    return (Object.entries(received) as [PlayerId, number][])
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => ({ id, amount }));
  }
</script>

<div class="replay" aria-label="試合後リプレイ">
  <header class="rhead">
    <button type="button" class="back" onclick={onback}>← 決着画面に戻る</button
    >
    <h2>リプレイ(手の内の全開示)</h2>
  </header>

  {#if turns.length === 0}
    <p class="empty">再生する記録がありません。</p>
  {:else}
    <ol class="turns">
      {#each turns as t (t.turn)}
        <li class="turn">
          <div class="thead">
            <span class="tno">ターン {t.turn}</span>
            <span class="target">ターゲット {t.target}</span>
            <span class="income">収入 +{t.income}🪙</span>
          </div>

          <div class="row">
            <span class="rlabel">提出</span>
            <ul class="subs">
              {#each t.submissions as sub (sub.playerId)}
                <li>
                  <span class="who">{playerName(sub.playerId)}</span>
                  <span class="skill">{skillLabel(sub.skill)}</span>
                  <span class="bid">{sub.bid}🪙</span>
                </li>
              {/each}
            </ul>
          </div>

          {#if t.visionConflict}
            <div class="row">
              <span class="rlabel">予知競合</span>
              <span
                >{playerName(t.visionConflict.winner)} が獲得(返金:
                {t.visionConflict.refunded.map(playerName).join('・') ||
                  'なし'})</span
              >
            </div>
          {/if}

          {#if t.vision}
            <div class="row">
              <span class="rlabel">予知</span>
              <span>
                {playerName(t.vision.playerId)} が山札の先頭 {t.vision.peeked
                  .length} 枚 [{t.vision.peeked.join(', ')}] を覗き、
                <strong>{t.vision.kept}</strong> を仕込んだ
              </span>
            </div>
          {/if}

          {#if t.auction}
            <div class="row">
              <span class="rlabel">落札</span>
              <span>
                {playerName(t.auction.winner)} が {t.auction.bid}🪙 で落札{t
                  .auction.tiebreak
                  ? '(優先権で決着)'
                  : ''}
              </span>
            </div>
          {/if}

          {#if t.chosen}
            <div class="row">
              <span class="rlabel">選択</span>
              <span>
                {#if t.chosen.value === null}
                  {playerName(t.chosen.playerId)} はパス
                {:else}
                  <strong>{t.chosen.value}</strong> を選択
                {/if}
              </span>
            </div>
          {/if}

          {#each t.marked as m (m.value)}
            <div class="row">
              <span class="rlabel">マーク</span>
              <span>
                {#if m.markedBy.length > 0}
                  {m.value} → {m.markedBy.map(playerName).join('・')}
                {:else}
                  {m.value} は誰の盤面にも無し
                {/if}
              </span>
            </div>
          {/each}

          {#if t.settled}
            <div class="row">
              <span class="rlabel">精算</span>
              <span>
                {playerName(t.settled.payer)} が {t.settled.paid}🪙 を支払い →
                {#if receivedEntries(t.settled.received).length === 0 && t.settled.toBank === 0}
                  分配なし
                {:else}
                  {#each receivedEntries(t.settled.received) as r (r.id)}
                    {playerName(r.id)} +{r.amount}🪙
                  {/each}
                  {#if t.settled.toBank > 0}/ 銀行 +{t.settled.toBank}🪙{/if}
                {/if}
              </span>
            </div>
          {/if}

          {#each t.refunds as r (r.playerId + r.reason)}
            <div class="row">
              <span class="rlabel">返金</span>
              <span>
                {playerName(r.playerId)} に {r.amount}🪙 返金({r.reason ===
                'lost-auction'
                  ? '落札失敗'
                  : '予知競合'})
              </span>
            </div>
          {/each}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .replay {
    display: grid;
    gap: 0.6rem;
  }
  .rhead {
    display: grid;
    gap: 0.4rem;
  }
  .rhead h2 {
    margin: 0;
    font-size: 1.05rem;
  }
  .back {
    justify-self: start;
    padding: 0.4rem 0.7rem;
    border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .empty {
    opacity: 0.7;
  }
  .turns {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .turn {
    display: grid;
    gap: 0.25rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    border-radius: 8px;
  }
  .thead {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    font-weight: 700;
    margin-block-end: 0.15rem;
  }
  .thead .target {
    font-variant-numeric: tabular-nums;
  }
  .thead .income {
    margin-inline-start: auto;
    font-size: 0.78rem;
    font-weight: 400;
    opacity: 0.7;
  }
  .row {
    display: grid;
    grid-template-columns: 3.5rem 1fr;
    gap: 0.4rem;
    align-items: start;
    font-size: 0.82rem;
  }
  .rlabel {
    font-size: 0.72rem;
    font-weight: 700;
    opacity: 0.65;
    padding-block-start: 0.1rem;
  }
  .subs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.6rem;
  }
  .subs li {
    display: inline-flex;
    gap: 0.3rem;
    align-items: baseline;
  }
  .subs .who {
    font-weight: 700;
  }
  .subs .skill {
    opacity: 0.8;
  }
  .subs .bid {
    font-variant-numeric: tabular-nums;
  }
</style>
