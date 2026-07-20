---
description: initial-requirements.mdを起点にプロジェクト開始フロー全体(スタック整合→ドキュメント→チケット→ハーネス→最初のチケット)を一気通貫でガイドする
---

# プロジェクトキックオフ

テンプレートから作った新リポジトリで、`docs/ideas/initial-requirements.md` に書かれたアイデアを起点に、開発開始までの全セットアップを対話的に進めるコマンドです。各フェーズの完了をユーザーに確認してから次へ進みます。

**引数:** なし

---

## フェーズ0: 前提確認

1. `docs/ideas/initial-requirements.md` を読む。
   - 存在しない、またはテンプレートの雛形のまま(プロダクト名が `[プロダクト名]` のまま等)の場合は、「アイデアを記入してから再実行してください。記入例: `docs/template-dev/initial-requirements.example.md`」と案内して終了する。
2. `docs/ideas/` 内の他のファイルも読む(`*.example.md` と `docs/template-dev/` は読み込み対象外)。
3. `docs/` に正式版ドキュメントが既にある場合は、`/kickoff` ではなく通常の開発フロー(`/next-ticket` 等)を案内して終了する。
4. **Step 0 チェック**: README の Step 0 で案内している手動セットアップの実施状況をユーザーに確認する(フェーズ5で README を書き換えると案内が消えるため、ここで拾う):
   - Actions シークレット `CLAUDE_CODE_OAUTH_TOKEN` の設定(未設定の間、PR 自動レビューと `@claude` メンションはスキップされる)
   - Settings → Code security の Secret scanning + Push protection の有効化
   - 未実施の項目があっても中断はせず、フェーズ6の完了報告に**残課題として明記**する。

## フェーズ1: 技術スタックの整合チェック

1. アイデアの「技術的な検討事項」とテンプレート既定(Node.js / TypeScript / npm / vitest / eslint / prettier)を突き合わせる。
2. **異なるスタック**(モバイルアプリ、Python 等)の場合、以下をユーザーに提示して承認を得る:
   - 検証コマンドの置換方針(例: Android なら `./gradlew lint` / `./gradlew test`)
   - `.devcontainer/` の更新方針(必要なランタイム・SDK)。**Node feature は異スタックでも残す**(post_create.sh の Claude Code インストール `npm install -g` と、npx 起動の MCP(Context7)が依存するため)
   - TS ツールチェーン(package.json / tsconfig.json / vitest.config.ts / eslint.config.js / .prettierrc / src/ プレースホルダ)の削除または置換
   - `.gitignore`(Node 専用エントリを新スタックの成果物・キャッシュの ignore に置換。漏れると生成物がコミット候補に混入する)
   - **CI とハーネスの npm 前提部分**の置換(漏れると CI が常に赤になる・hook が無言で動かなくなる):
     - `.github/workflows/ci.yml`(`npm ci` / `npm run lint` 等の各ステップと Node セットアップ)
     - `.github/dependabot.yml`(`npm` / `devcontainers` ecosystem と ignore ルールを新スタックの ecosystem に置換)
     - `.husky/pre-commit` + package.json の `lint-staged` / `prepare`(pre-commit フックを新スタックのツールで再構成。secretlint の実行手段も含める)
     - `.claude/scripts/lint-on-edit.sh`(`npm run lint` / `npm run typecheck` の直書きと対象拡張子 `*.ts|*.js` を新スタックに合わせる)
     - `.claude/settings.json` の PostToolUse インライン hook(`npx --no-install prettier` の直書き。新スタックのフォーマッタに置換する。放置すると `|| true` で黙って空振りし、Edit/Write 直後の自動フォーマットが静かに無効になる)
     - `.claude/hooks/session-start.sh`(リモート環境の依存インストールが `npm install` 固定 → 新スタックのインストールコマンドに置換。serena 規模検知の対象拡張子 `*.ts / *.tsx` も新スタックの拡張子に合わせる)
     - `.claude/settings.json` の `permissions.allow` / `ask`(npm / npx 前提の allowlist を新スタックの検証コマンドに置換。放置すると死に設定+新コマンドが毎回 permission prompt になる)
   - `CLAUDE.md` の技術スタック節の更新
3. 承認された置換作業を実行する(この置換自体も `.steering/` に記録する)。
4. 同じスタックの場合は `src/` のプレースホルダ(`index.ts` / `index.test.ts`)を最初の実装時に削除する旨だけ伝えて次へ。

## フェーズ1.5: 効率化 MCP の提案

1. `.claude/docs/mcp-introduction-guide.md` を読む。
2. アイデアとフェーズ1で確定した技術スタックから、プロジェクト特性に合致する MCP を「条件付き」の表から選んで提案する(該当なしなら「既定の Context7 のみで開始」と伝えて次へ):
   - 例: Web フロントエンドあり → Playwright MCP、DB あり → DB 系 MCP(読み取り専用)
   - 提案時は「何に使うか」「ツールスキーマの固定費(毎セッションのコンテキスト消費)」の両方を伝え、**開発初期から使う確度が高いものだけ**を勧める(後からの追加は容易。迷ったら入れない)
3. ユーザーが承認した MCP のみ導入する(ガイドの「導入・削除の手順」に従う: `.mcp.json` 追記 + CLAUDE.md に使いどころ 1〜2 行 + 必要なら `post_create.sh` にインストール処理)。
4. 導入した場合、反映には Claude Code の再起動が必要である旨を伝える(再起動は /kickoff 完了後でよい)。

## フェーズ2: 永続ドキュメントの作成

`Skill('setup-project')` 相当のフロー(`/setup-project`)を実行し、6 つの永続ドキュメントを 1 ファイルずつ承認を取りながら作成する。initial-requirements.md の内容(特に P0/P1/P2 の優先度・非機能要件・成功指標)を最大限反映する。

## フェーズ3: 実装チケットへの分割

`/setup-tickets` のフローを実行し、GitHub Issues に段階的な実装チケットを発行する(`ticket` + 優先度ラベル)。**P0 機能のみをチケット化**し、P1/P2 は backlog として区別する(スコープガード)。

## フェーズ4: ハーネス層の追加

`/harness-setup` のフローを実行する。フェーズ1で確定した検証コマンドを hooks に反映する。

## フェーズ5: リポジトリのプロダクト化

1. `README.md` をプロダクトの README(プロダクト名・概要・開発方法)に書き換える。
2. テンプレートの手順書としての旧内容は削除してよい(原本はテンプレートリポジトリに残っている)。
3. **package.json のメタデータ**を書き換える: `name`(テンプレートの `claude-code-template` のまま残さない)・`description`・`keywords`。書き換え後に `npm install` を実行して package-lock.json の name を同期する。
4. **`.devcontainer/devcontainer.json` の `name`** をプロダクト名に書き換える。
5. **ライセンス方針**をユーザーに確認して反映する:
   - 公開(OSS): `LICENSE` の Copyright 名義を自分のものに書き換える(package.json の `license` は `MIT` のまま)
   - 非公開: `LICENSE` を削除し、package.json を `"license": "UNLICENSED"` に変更する
6. **`CLAUDE.md` の整合**を取る:
   - 「開発プロセス」の**初回セットアップ節を削除**し、日常的な使い方だけを残す(完了済みのテンプレート利用手順を毎セッション読み込ませない)
   - 技術スタック節の「※ テンプレート既定値。…」注記を削除する(フェーズ1で実態確認済みのため)
   - README への参照(「コマンド早見表」「詳細は README.md を参照」等)を書き換え後の README と整合させる(コマンド早見表をプロダクト README に残すか、CLAUDE.md 側の参照を削除する)
   - ディレクトリ構造節から、削除するもの(`docs/template-dev/` 等)への言及を除去する
7. `docs/template-dev/` の削除を提案する(記入例が不要になったら。恒久参照されるガイドは `.claude/docs/` にあるため丸ごと削除してよい)。

## フェーズ6: 開始

1. チケット Issue(`gh issue list --label ticket`)から最初に着手すべきもの(依存なし・最優先)を 1 つ提示する。
2. フェーズ0の Step 0 チェックで未実施だった項目があれば、**残課題として再掲**する。
3. `/next-ticket` で着手する方法を案内して終了する。

## 完了条件

- フェーズ1の置換(必要な場合)が完了し、検証コマンドが実行可能
- `docs/` に 6 つの永続ドキュメントが存在し、チケット Issue が発行されている
- ハーネス層(hooks / permissions / subagents)が設定済み
- README・package.json・devcontainer 名・ライセンスがプロダクト用になっている
- 次の一手(最初のチケット)と Step 0 の残課題(あれば)が提示されている
