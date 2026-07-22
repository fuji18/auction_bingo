/**
 * Node ESM の resolve フック。拡張子なしの相対 import を `.ts` / `/index.ts` に補完する。
 *
 * 本リポジトリの `src/` は拡張子なし import(`'../core/reduce'`)を使うが、Node の
 * ネイティブ ESM は拡張子補完をしない。Node 24 は `.ts` の型ストリップをネイティブに
 * 行うため、解決さえできれば実行できる。ビルド不要・ゼロ依存で `npm run sim` を成立させる。
 *
 * `--import ./scripts/register-loader.mjs` 経由で登録する(register-loader.mjs 参照)。
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const relative = /^(\.\.?\/|\/)/.test(specifier);
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && relative && context.parentURL) {
      for (const suffix of ['.ts', '/index.ts']) {
        const url = new URL(specifier + suffix, context.parentURL);
        if (existsSync(fileURLToPath(url))) {
          return { url: url.href, shortCircuit: true };
        }
      }
    }
    throw err;
  }
}
