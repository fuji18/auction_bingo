# スポーク開発構成ルール — 公開前に満たすべき開発段階の構成

`game.fujioha.com` / `hokkaido.fujioha.com` などの **ハブ**(`fujioha_platform` リポジトリの `apps/*`)に登録して公開する**スポーク**(個別のサイト・ゲーム)が、**開発段階で必ず備えるべき構成**を定義するルールです。

| 対象範囲 | ドキュメント |
|---|---|
| リポジトリ作成 〜 レジストリ登録**前**(本書) | 本書 |
| どう登録・デプロイするか | `fujioha_platform` の `docs/playbook/add-new-spoke.md` |
| 公開後に何を確認するか | `fujioha_platform` の `docs/post-launch-checklist.md` / `docs/seo-operations.md` |

## 適用範囲

- `apps/game` / `apps/hokkaido` などの各ハブに登録するスポーク。
- スポークは **独立リポジトリ・独立サブドメイン**(`<spoke>.fujioha.com`)。本書はスポーク側リポジトリの構成に適用する。
- 本リポジトリ(`auction_bingo`)は `apps/game` に登録する**ゲームのスポーク**であり、`auction-bingo.fujioha.com` を想定する。

## Claude への指示(最重要)

1. スポーク開発を始める前に、**本書と `fujioha_platform/docs/playbook/add-new-spoke.md` を必ず読む**。
2. **MUST** 項目を満たさないスポークは公開不可。実装は MUST を前提に進める。
3. 末尾の「公開前セルフチェックリスト」を **開発完了の定義 (DoD)** とし、登録 PR を出す前に自己検証する。
4. 本書と矛盾する判断が必要なとき、または MUST を満たせない事情があるときは、**勝手に決めずユーザーに確認する**。

凡例: **MUST** = 必須(未達なら公開不可) / **SHOULD** = 強く推奨(外す場合は理由を残す) / 参考 = 任意。

---

## 1. リポジトリ・ビルド構成(MUST)

- **Node 22 以上**で `npm ci && npm run build` が成功する(本リポジトリは Node v24 を `engines` で固定)。
- ビルド出力は **`dist/`**。
- スタックは自由だが **静的出力**を原則とする。SSR・サーバ状態・ユーザ生成コンテンツを持たない。**この前提が CSP を `default-src 'self'` で締められる根拠であり、ブラスト半径を限定する土台**になる。
- Cloudflare Pages の設定は `wrangler.toml` に置く(`pages_build_output_dir = "./dist"`)。
- 既存スポーク `kanji_gacha`(Vite + Svelte 5 + TypeScript)の構成に倣うと、CI・ヘッダ・デプロイの前例をそのまま流用できる。

## 2. ドメイン・オリジン構成(MUST)

- **1スポーク = 1リポジトリ = 1サブドメイン**(`<spoke>.fujioha.com`)。
- パスベース相乗り(`game.fujioha.com/<spoke>`)**禁止**。XSS の被害が全スポークに波及し、Service Worker のスコープが衝突し、Cookie 漏洩とブラスト半径の拡大を招くため。
- ネストサブドメイン(`<spoke>.game.fujioha.com`)**禁止**。Cloudflare Universal SSL が `*.fujioha.com` の1段までしか覆わないため(2段は Advanced Certificate Manager が必要で有料)。
- **スポーク同士は互いを知らない関係**にする。依存させない。

## 3. セキュリティヘッダ(MUST)

`public/_headers` に設定する(Cloudflare Pages が読む)。**セキュリティヘッダの「単一の正」はこのファイルとし、`index.html` に `<meta http-equiv="Content-Security-Policy">` を注入しない**(重複とドリフトを防ぐため。加えて meta では `frame-ancestors` を表現できない)。

実例は `kanji_gacha` の `public/_headers` を参照する。全パスに最低限:

```
/*
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'self'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

- **CSP は `default-src 'self'` を基点**とし、`object-src 'none'` / `frame-ancestors 'none'` / `base-uri 'self'` を含める。
- 外部許可元は**実際に使うものだけ**を最小で追加する。使わないなら1つも追加しない。
- `style-src` の `'unsafe-inline'` は、Svelte が動的な inline style 属性を出力するため実務上必要になる。**`script-src` には `'unsafe-inline'` を入れない**(本番ビルドがインライン JS を含まないことを確認する)。
- 外部スクリプトを読む場合は **SRI** を検討する。
- content-hash 付きアセットは長期キャッシュ(`max-age=31536000, immutable`)にする。

## 4. Service Worker 方針(MUST)

**オフライン動作がそのスポークの価値になる場合は、Service Worker を登録してよい。**

ハブ(`apps/*`)は自己破壊型 SW で SW を退場させているが、これはハブが頻繁に更新される一覧ページであるためで、**独立オリジンのスポークにはスコープ衝突の問題が存在しない**。既存スポーク `kanji_gacha` は `vite-plugin-pwa` で意図的に SW を登録している。

登録する場合は以下を **MUST** とする。

- **更新戦略を `autoUpdate`(`skipWaiting` + `clientsClaim`)にする。** 古いキャッシュが待ち続ける事故を防ぐ。
- **SW 本体と登録スクリプトを `no-cache` で配信する。**

  ```
  /sw.js
    Cache-Control: no-cache

  /registerSW.js
    Cache-Control: no-cache
  ```

- **CSP に `worker-src 'self'` を含める。** Web App Manifest を出す場合は `manifest-src 'self'` も。
- **キャッシュ対象とスコープを設定ファイルのコメントに明記する。** 何をプリキャッシュし、オフライン時に何が動くのかを、後から読んで分かる形で残す。

登録しない場合は、`_headers` から `/sw.js` の項も外してよい。

## 5. SEO 構成(MUST)

- `<html lang="ja">` と `<meta name="viewport">`。
- **ページ固有の `<title>` と `description`**。
- **canonical** を絶対URLで出力する。
- **OGP**: `public/og.png`(1200×630)と `og:title` / `og:description` / `og:image`(絶対URL)。
- `favicon`、`public/robots.txt`(`Allow: /` と `Sitemap:` 行)、`sitemap.xml`。単一ページのスポークは静的な `public/sitemap.xml` で足りる(`kanji_gacha` の前例)。
- 更新型コンテンツがあるスポークのみ RSS/Atom(任意)。

運用上の詳細は `fujioha_platform/docs/seo-operations.md` に従う。

## 6. ブランド一貫性(SHOULD)

**`@fujioha/ui` の `src/styles/tokens.css` の内容をスポークにコピーして使う。**

`@fujioha/ui` は Astro 専用(`.astro` コンポーネント + `peerDependencies: astro`)で、かつ GitHub Packages の非公開レジストリ配信のため、非 Astro スポークから npm 依存として入れると `.npmrc` と `NODE_AUTH_TOKEN` を CI と Cloudflare Pages の両方に設定する必要がある。**トークンは素の CSS なので、コピーのほうが構成が単純で壊れにくい。**

コピーする値: `--accent` / `--paper` / `--ink` / `--ink-soft` / `--mute` / `--faint` / `--rule` / `--maxw` とタイポグラフィ変数。

**⚠️ フォントの取り扱いに注意する。** `tokens.css` のフォント変数は Google Fonts のファミリ(Shippori Mincho B1 / Zen Kaku Gothic New / Newsreader)を先頭に指定している。これらを実際に読み込むと **CSP に `fonts.googleapis.com` / `fonts.gstatic.com` の許可が必要**になり、`default-src 'self'` の原則が緩む。

- **原則: Web フォントを読み込まず、システムフォントのフォールバックに任せる。** CSP を最厳格のまま保てる(`kanji_gacha` もこの方針)。
- 読み込む場合は、CSP の `style-src` / `font-src` に最小限で追加し、その判断理由を `_headers` のコメントに残す。

## 7. アクセシビリティ・モバイル(MUST)

- レスポンシブ。**幅 375px の縦画面で崩れない**こと。タップ領域とコントラストを確保する。
- 画像に `alt`、フォーカスの可視化、キーボード操作が可能なこと。
- **色のみで情報を伝えない**(状態は記号や形でも区別する)。
- **Lighthouse の Performance / Accessibility / Best Practices / SEO すべて 90+**。

## 8. プライバシー・計測(MUST)

- **localStorage / Cookie に PII を保存しない。**
- 計測は cookieless を推奨(Cloudflare Web Analytics)。導入時は CSP の `script-src` に `https://static.cloudflareinsights.com`、`connect-src` に `https://cloudflareinsights.com` を最小限で追加する。
- **secrets・トークンをフロントエンドやリポジトリに含めない。** pre-commit と CI で secretlint を実行する。

## 9. 品質・テスト(SHOULD)

- 型チェック・lint・ビルドが CI で通る。
- **壊れると致命的な中核ロジックにテストを置く。** 本リポジトリでは `src/core/`(ゲームルール)がこれに当たり、カバレッジ 90% 以上を目標とする(`docs/development-guidelines.md`)。

## 10. レジストリ整合(MUST)

公開時に `fujioha_platform` へ PR を出して登録するため、**開発段階で次のメタデータを先に確定する**。スキーマは `apps/game/src/content/config.ts` の zod 定義に準拠する。

`apps/game/src/content/games/<id>.json`:

| フィールド | 必須 | 制約 |
|---|---|---|
| `id` | ✅ | 英小文字とハイフンのみ。**ファイル名と一致させる**。サブドメインとも揃える |
| `jp` / `en` | ✅ | 日本語名 / 英語名 |
| `genre` / `genreEn` | ✅ | 例: `パズル` / `Puzzle` |
| `time` | ✅ | 目安プレイ時間。例: `~1 min` |
| `tag` | | `"new"` / `"wip"` / `null` |
| `icon` | ✅ | **`kanji` / `clock` / `map` / `rhythm` / `palette` のいずれか** |
| `hue` | ✅ | アクセント色(`#rrggbb`) |
| `url` | | `https://<id>.fujioha.com`。未デプロイなら `null` |
| `status` | ✅ | `published` のみが一覧に表示される |
| `featured` | | トップの目立たせ表示 |
| `publishedAt` | | `YYYY-MM-DD` |
| `image` | | サムネ。サイト相対パス |

**⚠️ `icon` の enum に無い意匠を使いたい場合は、ハブ側で `GameIcon.astro` に SVG を実装し、`config.ts` の enum を拡張する PR が別途必要になる。** これはハブ側リポジトリの作業であり、スポーク側の開発完了とは独立して進める必要があるため、**早い段階で必要性を判断する**。

---

## 公開前セルフチェックリスト(開発完了の定義)

登録 PR を出す前に、すべて満たすこと。

### 構成
- [ ] Node 22+ で `npm ci && npm run build` が成功し、`dist/` を出力する
- [ ] サブドメイン構成がフラットな `<spoke>.fujioha.com` になっている
- [ ] `public/_headers` にセキュリティヘッダ一式(CSP 含む)があり、外部許可元が最小
- [ ] `index.html` に meta CSP を注入していない
- [ ] SW を登録する場合: `autoUpdate` 戦略、`/sw.js` と `/registerSW.js` が `no-cache`、CSP に `worker-src 'self'`、キャッシュ対象がコメントで明記されている

### SEO / メタ
- [ ] `lang` / `viewport` / ページ固有の `title`・`description`
- [ ] canonical が正しい絶対URL
- [ ] OGP(`og.png` 1200×630 と `og:*` メタ)と favicon
- [ ] `robots.txt` と `sitemap.xml` が配信される

### 品質 / プライバシー
- [ ] Lighthouse の4カテゴリすべて 90+
- [ ] 幅 375px の縦画面とデスクトップの両方でレイアウトが崩れない
- [ ] localStorage / Cookie に PII を保存していない
- [ ] secrets を露出していない(secretlint が通る)
- [ ] 中核ロジックにテストがある

### レジストリ
- [ ] `apps/game/src/content/config.ts` のスキーマに合うメタデータが確定している
- [ ] `icon` が既存 enum で足りる。足りない場合、ハブ側の SVG 実装と enum 拡張の PR が用意できている
- [ ] `id` = ファイル名 = サブドメイン が一致している

---

## 参考

- 登録・デプロイ手順: `fujioha_platform/docs/playbook/add-new-spoke.md`
- 公開後の確認: `fujioha_platform/docs/post-launch-checklist.md`
- SEO 運用: `fujioha_platform/docs/seo-operations.md`
- 既存スポークの実装例: `fuji18/kanji_gacha`(Vite + Svelte 5 + TypeScript + PWA)
