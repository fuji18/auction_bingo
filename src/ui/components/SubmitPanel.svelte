<script lang="ts">
  /**
   * 提出 UI: スキル選択 + 入札スライダー。ルール判断は持たず、legalActions が返した
   * options(買えるスキルと各 maxBid)の範囲でしか入力させない。超過入札は構造的に不可。
   */
  import type { SkillId } from '../../core/types';
  import type { BalanceConfig } from '../../core/config';

  interface Props {
    /** legalActions(submitting).options。買えないスキルは含まれない。 */
    options: { skill: SkillId | null; maxBid: number }[];
    /** 手持ちコイン(表示用)。 */
    coins: number;
    /** スキル代の表示用。 */
    skills: BalanceConfig['skills'];
    /** 選択スキルが変わるたびに通知(親が候補プレビューを盤面に出す)。 */
    onskillchange: (skill: SkillId | null) => void;
    /** 提出。 */
    onsubmit: (skill: SkillId | null, bid: number) => void;
  }
  let { options, coins, skills, onskillchange, onsubmit }: Props = $props();

  const SKILL_LABEL: Record<string, string> = {
    none: 'なし',
    shift: '偏向',
    vision: '予知',
    greed: '強奪',
  };

  const SKILL_ORDER: (SkillId | null)[] = [null, 'shift', 'vision', 'greed'];

  let selectedSkill = $state<SkillId | null>(null);
  let bid = $state(0);

  let current = $derived(options.find((o) => o.skill === selectedSkill));
  let maxBid = $derived(current?.maxBid ?? 0);

  // 選択スキルが変わったら入札を上限内に丸め、親へ通知(プレビュー用)。
  $effect(() => {
    onskillchange(selectedSkill);
  });
  $effect(() => {
    if (bid > maxBid) bid = maxBid;
  });

  function keyOf(skill: SkillId | null): string {
    return skill ?? 'none';
  }
  function costOf(skill: SkillId | null): number {
    return skill ? skills[skill].cost : 0;
  }
  function canBuy(skill: SkillId | null): boolean {
    return options.some((o) => o.skill === skill);
  }
  function select(skill: SkillId | null): void {
    selectedSkill = skill;
  }
</script>

<div class="panel">
  <div class="skills" role="group" aria-label="スキル選択">
    {#each SKILL_ORDER as skill (keyOf(skill))}
      <button
        type="button"
        class="skill"
        class:selected={selectedSkill === skill}
        disabled={!canBuy(skill)}
        onclick={() => select(skill)}
      >
        {SKILL_LABEL[keyOf(skill)]}
        {#if skill}<span class="cost">{costOf(skill)}🪙</span>{/if}
      </button>
    {/each}
  </div>

  <label class="bidrow">
    <span>入札額</span>
    <input type="range" min="0" max={maxBid} step="1" bind:value={bid} />
    <output class="bidval">{bid}</output>
  </label>

  <p class="note">
    手持ち {coins}🪙 / 入札可 {maxBid}🪙
    {#if selectedSkill === 'vision'}
      <span class="timing">(予知は選択直後に即時徴収)</span>
    {:else if selectedSkill === 'shift' || selectedSkill === 'greed'}
      <span class="timing"
        >({SKILL_LABEL[selectedSkill]}代は落札時のみ徴収・負ければ返金)</span
      >
    {/if}
  </p>

  <button
    type="button"
    class="submit"
    onclick={() => onsubmit(selectedSkill, bid)}
  >
    提出する
  </button>
</div>

<style>
  .panel {
    display: grid;
    gap: 0.6rem;
  }
  .skills {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.4rem;
  }
  .skill {
    display: grid;
    gap: 0.1rem;
    padding: 0.5rem 0.2rem;
    border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .skill.selected {
    border-color: royalblue;
    background: color-mix(in srgb, royalblue 20%, transparent);
    font-weight: 700;
  }
  .skill:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .cost {
    font-size: 0.72rem;
    opacity: 0.8;
  }
  .bidrow {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.5rem;
  }
  .bidrow input {
    inline-size: 100%;
  }
  .bidval {
    min-inline-size: 2ch;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    text-align: end;
  }
  .note {
    margin: 0;
    font-size: 0.78rem;
    opacity: 0.85;
  }
  .timing {
    display: block;
    color: color-mix(in srgb, currentColor 70%, transparent);
  }
  .submit {
    padding: 0.7rem;
    border: none;
    border-radius: 8px;
    background: royalblue;
    color: white;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
  }
</style>
