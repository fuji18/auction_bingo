<script lang="ts">
  /**
   * 5×5 盤面の表示。ルール判断はせず、core の状態と lineHighlights を描画するだけ。
   * マーク済み・FREE・リーチ・完成を「色 + 記号」の両方で区別する(色覚特性への配慮)。
   *
   * board は [col][row]。画面は列 B/I/N/G/O(c=0..4)を左右、row(r=0..4)を上下に置く。
   */
  import type { Board } from '../../core/types';
  import { lineHighlights } from '../../core/board';

  interface Props {
    board: Board;
    /** 相手盤面。縮小し、数字を省いてマークとリーチ/完成ラインのみ強調する。 */
    compact?: boolean;
    /** この数字を持つマスに枠を出す(スキルの候補プレビュー・落札候補の視認用)。 */
    highlight?: number[];
    /** アクセシビリティ用の見出し。 */
    label?: string;
  }
  let { board, compact = false, highlight = [], label }: Props = $props();

  const COLS = ['B', 'I', 'N', 'G', 'O'];
  const IDX = [0, 1, 2, 3, 4];
  let hl = $derived(lineHighlights(board));
  let hset = $derived(new Set(highlight));

  function stateOf(c: number, r: number) {
    const cell = board[c][r];
    return {
      value: cell.value,
      free: cell.value === 'FREE',
      marked: cell.marked,
      reach: hl.reach[c][r],
      complete: hl.complete[c][r],
      preview: typeof cell.value === 'number' && hset.has(cell.value),
    };
  }
</script>

<div class="board" class:compact role="grid" aria-label={label ?? 'ビンゴ盤面'}>
  {#if !compact}
    <div class="head" aria-hidden="true">
      {#each COLS as col (col)}<span>{col}</span>{/each}
    </div>
  {/if}
  <div class="grid">
    {#each IDX as r (r)}
      {#each IDX as c (c)}
        {@const s = stateOf(c, r)}
        <div
          class="cell"
          class:marked={s.marked && !s.free}
          class:free={s.free}
          class:reach={s.reach && !s.complete}
          class:complete={s.complete}
          class:preview={s.preview}
          role="gridcell"
          title={s.complete
            ? '完成ライン'
            : s.reach
              ? 'リーチライン'
              : s.free
                ? 'FREE(マーク済み)'
                : s.marked
                  ? 'マーク済み'
                  : '未マーク'}
        >
          <span class="sym" aria-hidden="true"
            >{s.free ? '★' : s.marked ? '●' : ''}</span
          >
          {#if !compact}
            <span class="num">{s.free ? 'FREE' : s.value}</span>
          {/if}
        </div>
      {/each}
    {/each}
  </div>
</div>

<style>
  .board {
    display: inline-block;
  }
  .head,
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
  }
  .head {
    gap: 2px;
    margin-block-end: 2px;
    font-size: 0.7rem;
    font-weight: 700;
    text-align: center;
    opacity: 0.7;
  }
  .grid {
    gap: 2px;
  }
  .cell {
    position: relative;
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    border-radius: 4px;
    font-size: 0.82rem;
    inline-size: 2.1rem;
  }
  .compact .cell {
    inline-size: 1.05rem;
    border-radius: 2px;
    font-size: 0.6rem;
  }
  /* マーク済み: 塗りつぶし + ● 記号 */
  .cell.marked {
    background: color-mix(in srgb, royalblue 35%, transparent);
    border-color: royalblue;
  }
  /* FREE: マーク済みだが別色 + ★ 記号 */
  .cell.free {
    background: color-mix(in srgb, teal 35%, transparent);
    border-color: teal;
  }
  /* リーチ: 枠線を強調(破線) */
  .cell.reach {
    border-width: 2px;
    border-style: dashed;
    border-color: darkorange;
  }
  /* 完成: 最も強い強調(実線太枠 + 下地) */
  .cell.complete {
    border-width: 2px;
    border-style: solid;
    border-color: crimson;
    box-shadow: inset 0 0 0 1px crimson;
  }
  /* 候補プレビュー: 選べるようになる数字の枠 */
  .cell.preview {
    outline: 2px solid gold;
    outline-offset: 1px;
  }
  .sym {
    position: absolute;
    inset-block-start: 1px;
    inset-inline-end: 2px;
    font-size: 0.6em;
    line-height: 1;
  }
  .compact .sym {
    position: static;
    font-size: 0.8em;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
</style>
