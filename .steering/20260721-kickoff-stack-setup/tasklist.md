# タスクリスト: スタック整合(Svelte 5 + Vite 導入)

`/kickoff` フェーズ1。テンプレート既定(TS のみの Node プロジェクト)を、
スポーク標準である「Vite + Svelte 5 + TypeScript の静的Webアプリ」に置換する。

## 背景

- 公開先は `fujioha_platform`(Astro のハブ)配下のスポークとして `auction-bingo.fujioha.com` を想定
- 既存スポーク `kanji_gacha` が同構成の先例。React ではなく Svelte 5 を選ぶ根拠はこの既存標準への整合
- バージョンは kanji_gacha に合わせず、テンプレート側の新しい世代(TS 6 / ESLint 10 / Vitest 4 / Vite 8)を維持する。スポーク間で共有パッケージを使わない疎結合構成のため、揃えるべきは構成の形であってバージョンではない

## タスク

- [x] 依存追加(svelte 5.56 / vite 8.1 / @sveltejs/vite-plugin-svelte 7.2 / svelte-check 4.7 / eslint-plugin-svelte 3.22 / prettier-plugin-svelte 4.1 / globals)
- [x] `vite.config.ts` / `svelte.config.js` / `index.html` / `wrangler.toml` を作成
- [x] `tsconfig.json` を bundler 解決 + DOM lib + noEmit に変更
- [x] `eslint.config.js` に svelte flat config と browser/node globals を追加
- [x] `.prettierrc` に prettier-plugin-svelte を追加
- [x] `vitest.config.ts` に svelte プラグインを追加
- [x] `package.json` の scripts(build/dev/preview/typecheck)・lint-staged・name・description・keywords を更新
- [x] ハーネスの拡張子対応(`lint-on-edit.sh` / `session-start.sh` に `.svelte` を追加)
- [x] CI に `npm run build` ステップを追加
- [x] `CLAUDE.md` の技術スタック節を実態に更新
- [x] テンプレートのプレースホルダ(`src/index.ts` / `src/index.test.ts`)を削除し、最小のアプリ骨格を配置
- [x] 検証: lint / typecheck / test / format:check / build がすべて通ることを確認

## 検証結果

| コマンド | 結果 |
|---|---|
| `npm run lint` | 0 errors |
| `npm run typecheck` | 310 files, 0 errors, 0 warnings |
| `npm test` | No test files(`--passWithNoTests`) |
| `npm run format:check` | All matched files use Prettier code style |
| `npm run build` | 成功。JS 23.01 kB(gzip 9.39 kB) |

## 申し送り

- テストは最初のチケット(バランス検証基盤)で追加する。それまで `npm test` は `--passWithNoTests` で通る
- Svelte コンポーネントのテストを書く際は、`vitest.config.ts` の `environment: 'node'` を該当ファイルで切り替える
- ハブへの登録(`apps/game/src/content/games/auction-bingo.json`)は公開時の作業。`icon` enum の拡張がハブ側に必要
