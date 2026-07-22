import { describe, it, expect } from 'vitest';
import type { BalanceConfig } from './config';
import { DEFAULT_CONFIG, validateConfig } from './config';

/** DEFAULT_CONFIG を安全に複製し、一部だけ上書きするためのヘルパー。 */
function cloneConfig(): BalanceConfig {
  return structuredClone(DEFAULT_CONFIG);
}

describe('validateConfig', () => {
  it('DEFAULT_CONFIG は制約を満たす', () => {
    expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
  });

  it('distributionDivisor が playerCount + 1 を下回ると throw する', () => {
    const config = cloneConfig();
    config.economy.distributionDivisor = config.playerCount; // 3 < 3+1
    expect(() => validateConfig(config)).toThrow(/distributionDivisor/);
  });

  it('列範囲が互いに素でない(重複する)と throw する', () => {
    const config = cloneConfig();
    // [1,8] と [8,16] が 8 で重複する。
    config.board.columns = [
      [1, 8],
      [8, 16],
      [17, 24],
      [25, 32],
      [33, 40],
    ];
    expect(() => validateConfig(config)).toThrow(/互いに素/);
  });

  it('列範囲に隙間があると(プールを覆えないと)throw する', () => {
    const config = cloneConfig();
    // [9,16] と [18,24] の間に 17 の隙間がある。
    config.board.columns = [
      [1, 8],
      [9, 16],
      [18, 24],
      [25, 32],
      [33, 40],
    ];
    expect(() => validateConfig(config)).toThrow(/隙間/);
  });

  it('pickPerColumn が列範囲の広さを超えると throw する', () => {
    const config = cloneConfig();
    // 各列の広さは 8。9 は超過。
    config.board.pickPerColumn = 9;
    expect(() => validateConfig(config)).toThrow(/pickPerColumn/);
  });

  it('列数が盤面サイズと一致しないと throw する', () => {
    const config = cloneConfig();
    config.board.columns = [
      [1, 8],
      [9, 16],
    ];
    expect(() => validateConfig(config)).toThrow(/列数/);
  });

  it('列範囲が整数でないと throw する', () => {
    const config = cloneConfig();
    config.board.columns = [
      [1, 8.5],
      [9, 16],
      [17, 24],
      [25, 32],
      [33, 40],
    ];
    expect(() => validateConfig(config)).toThrow(/整数/);
  });

  it('列範囲の min > max だと throw する', () => {
    const config = cloneConfig();
    config.board.columns = [
      [8, 1],
      [9, 16],
      [17, 24],
      [25, 32],
      [33, 40],
    ];
    expect(() => validateConfig(config)).toThrow(/min <= max/);
  });
});
