/**
 * 意思決定(CPU)のインターフェース。
 *
 * `Agent` は `GameState` 全体ではなく `PublicView` / `SecretView` のみを受け取る。
 * これにより「CPU は非公開情報を参照しない」という PRD の受け入れ条件を
 * 型で構造的に保証する(docs/repository-structure.md「src/agents/」節)。
 *
 * 人間プレイヤーに対応する Agent 実装は作らない(手番は UI から直接 reduce に渡る)。
 */

import type { PublicView, SecretView, SkillId } from '../core/types';

export interface Agent {
  submit(
    pub: PublicView,
    sec: SecretView
  ): { skill: SkillId | null; bid: number };
  chooseNumber(
    pub: PublicView,
    sec: SecretView,
    candidates: number[]
  ): number | null;
  selectVision(pub: PublicView, sec: SecretView, peeked: number[]): number;
  /** UI 表示用。意思決定には影響しない。 */
  tell(pub: PublicView, sec: SecretView): string;
}
