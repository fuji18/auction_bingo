/**
 * storage の往復・破棄・不正データ処理をユニットテストする。
 * jsdom を足さず、Storage インターフェースの in-memory フェイクで node 環境で回す。
 */
import { describe, it, expect } from 'vitest';
import type { Action } from '../core/types';
import {
  SAVE_KEY,
  SAVE_VERSION,
  saveGame,
  loadGame,
  clearGame,
} from './storage';

/** Web Storage の使用サブセットを Map で実装したフェイク。 */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

const sampleActions: Action[] = [
  { type: 'SUBMIT', playerId: 'p0', skill: 'shift', bid: 8 },
  { type: 'CHOOSE', playerId: 'p0', value: 26 },
];

describe('saveGame / loadGame', () => {
  it('保存した seed + actions を往復で復元できる', () => {
    const storage = fakeStorage();
    saveGame(storage, 123456789, sampleActions);
    expect(loadGame(storage)).toEqual({
      seed: 123456789,
      actions: sampleActions,
    });
  });

  it('未保存なら null', () => {
    expect(loadGame(fakeStorage())).toBeNull();
  });

  it('破損 JSON なら null', () => {
    const storage = fakeStorage();
    storage.setItem(SAVE_KEY, '{ not json');
    expect(loadGame(storage)).toBeNull();
  });

  it('version 不一致なら null(破棄対象)', () => {
    const storage = fakeStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: SAVE_VERSION + 1, seed: 1, actions: [] })
    );
    expect(loadGame(storage)).toBeNull();
  });

  it('形不正(seed 非数値・actions 非配列)なら null', () => {
    const storage = fakeStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: SAVE_VERSION, seed: 'x', actions: [] })
    );
    expect(loadGame(storage)).toBeNull();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: SAVE_VERSION, seed: 1, actions: null })
    );
    expect(loadGame(storage)).toBeNull();
  });
});

describe('clearGame', () => {
  it('保存を破棄すると loadGame は null', () => {
    const storage = fakeStorage();
    saveGame(storage, 1, sampleActions);
    clearGame(storage);
    expect(loadGame(storage)).toBeNull();
  });
});
