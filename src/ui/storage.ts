/**
 * 進行中ゲームの localStorage 退避・復元。
 *
 * state 全体ではなく seed + actions[] だけを保存する(docs/functional-design.md
 * 「ファイル構造(データ保存)」)。復元は呼び出し側で
 * `reduce(createGame(config, seed), actions)` により再計算する。この形式は
 * ルール変更に強く、そのままリプレイ(#11)のデータ構造にも使える。
 *
 * テスト容易化と DOM 非依存化のため `Storage` を注入可能にする(既定は localStorage)。
 * ルール判断は一切持たない(保存 I/O のみ)。
 */

import type { Action } from '../core/types';

/** 進行中ゲーム1件の保存キー。 */
export const SAVE_KEY = 'auction-bingo:save';

/** スキーマ版。形が変わったら上げ、旧版のセーブは破棄する。 */
export const SAVE_VERSION = 1;

/** localStorage に載せる進行中ゲームのスナップショット。 */
export interface SaveData {
  version: number;
  seed: number;
  actions: Action[];
}

/** seed + actions を JSON 化して保存する(容量超過等の失敗は握りつぶす)。 */
export function saveGame(
  storage: Storage,
  seed: number,
  actions: Action[]
): void {
  const data: SaveData = { version: SAVE_VERSION, seed, actions };
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // 保存失敗(プライベートモード等)は進行を妨げないため無視する。
  }
}

/**
 * 保存済みゲームを読み出す。未保存・パース失敗・version 不一致・形不正は null。
 * null のとき呼び出し側は新規ゲームを開始する。
 */
export function loadGame(
  storage: Storage
): { seed: number; actions: Action[] } | null {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isValidSave(parsed)) return null;
  return { seed: parsed.seed, actions: parsed.actions };
}

/** 保存を破棄する(破損時・決着後・新規開始時)。 */
export function clearGame(storage: Storage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // 削除失敗は無視する。
  }
}

/** version と最低限の形(seed 数値・actions 配列)を検証する。中身の妥当性は復元時の reduce に委ねる。 */
function isValidSave(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === SAVE_VERSION &&
    typeof v.seed === 'number' &&
    Array.isArray(v.actions)
  );
}
