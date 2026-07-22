/**
 * `node --import ./scripts/register-loader.mjs src/sim/run.ts` で使う登録エントリ。
 * ts-loader.mjs の resolve フックを現在の Node プロセスに登録する。
 */

import { register } from 'node:module';

register('./ts-loader.mjs', import.meta.url);
