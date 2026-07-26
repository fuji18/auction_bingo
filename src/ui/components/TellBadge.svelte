<script lang="ts">
  // CPU の状態を 1 語で示すテル。意思決定には影響しない表示専用(agents/types.ts の tell)。
  interface Props {
    text: string;
  }
  let { text }: Props = $props();
</script>

{#if text}
  <span
    class="tell"
    aria-label="CPU の様子(確率的なヒントで確定情報ではありません)"
    title="テルは確率的なヒントで、確定情報ではありません">「{text}」</span
  >
{/if}

<style>
  .tell {
    font-size: 0.78rem;
    color: color-mix(in srgb, currentColor 65%, transparent);
    white-space: nowrap;
  }
</style>
