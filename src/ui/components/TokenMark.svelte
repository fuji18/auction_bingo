<script lang="ts">
  // 優先権トークンの保持者を示すアイコン。色だけに依存させないため記号(◆)+ラベル。
</script>

<span
  class="token"
  title="優先権トークン(タイブレークの決着順で先頭)"
  aria-label="優先権"
>
  ◆<span class="label">優先</span>
</span>

<style>
  .token {
    display: inline-flex;
    align-items: center;
    gap: 0.15em;
    padding: 0.05em 0.4em;
    border-radius: 999px;
    background: color-mix(in srgb, orange 30%, transparent);
    border: 1px solid orange;
    color: inherit;
    font-size: 0.72rem;
    line-height: 1.4;
    white-space: nowrap;
  }
</style>
