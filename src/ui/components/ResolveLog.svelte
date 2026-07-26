<script lang="ts">
  /**
   * 直近の解決イベントを日本語 1 行へ整形して表示する(演出は最小)。
   * events の内容は core が確定済み。ここでは表示整形のみでルール判断はしない。
   */
  import type { GameEvent, PlayerId } from '../../core/types';

  interface Props {
    events: GameEvent[];
    names: Record<PlayerId, string>;
  }
  let { events, names }: Props = $props();

  /** 表示に値するイベントのみ 1 行へ。対象外は null(相手の予知内容など秘匿寄りは伏せる)。 */
  function formatEvent(ev: GameEvent): string | null {
    switch (ev.type) {
      case 'TurnStarted': {
        const capped =
          ev.capped.length > 0
            ? `(上限超過切り捨て: ${ev.capped.map((p) => names[p]).join('・')})`
            : '';
        return `── ターン ${ev.turn} ── 収入 +${ev.income}🪙 ${capped}`.trim();
      }
      case 'VisionConflict':
        return `予知が競合 → ${names[ev.winner]} が獲得(他は返金)`;
      case 'VisionResolved':
        return `${names[ev.playerId]} が予知で山札を操作`;
      case 'AuctionResolved':
        return `${names[ev.winner]} が ${ev.bid}🪙 で落札${ev.tiebreak ? '(優先権で決着)' : ''}`;
      case 'NumberChosen':
        return ev.value === null
          ? `${names[ev.playerId]} はパス`
          : `→ ${ev.value} を選択`;
      case 'Marked':
        return ev.markedBy.length > 0
          ? `${ev.value} をマーク: ${ev.markedBy.map((p) => names[p]).join('・')}`
          : `${ev.value} は誰の盤面にも無し`;
      case 'GameFinished':
        return 'ゲーム終了';
      default:
        return null;
    }
  }

  let lines = $derived(
    events
      .map(formatEvent)
      .filter((l): l is string => l !== null)
      .slice(-8)
  );
</script>

<div class="log" aria-label="解決ログ" aria-live="polite">
  {#if lines.length === 0}
    <p class="empty">まだ解決はありません</p>
  {:else}
    {#each lines as line, i (i)}
      <p class="line">{line}</p>
    {/each}
  {/if}
</div>

<style>
  .log {
    display: grid;
    gap: 0.15rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    border-radius: 8px;
    font-size: 0.8rem;
    max-block-size: 9rem;
    overflow-y: auto;
  }
  .line,
  .empty {
    margin: 0;
  }
  .empty {
    opacity: 0.6;
  }
</style>
