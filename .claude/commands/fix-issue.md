---
description: GitHub Issueを読み込み、steeringフローで修正を実装してPRを作成する
---

# GitHub Issueの修正

指定されたGitHub Issueの内容を読み込み、ステアリングファイルで計画を立ててから修正を実装し、PRを作成するコマンドです。

**引数:** Issue番号（例: `/fix-issue 42`）

---

## 手順

### ステップ1: Issueの読み込み

1. Issue番号が指定されていない場合は、`gh issue list --state open` でオープンなIssue一覧を表示し、どれを対応するかユーザーに確認して終了する。
2. Issueの内容を取得する:
   ```bash
   gh issue view [Issue番号]
   ```
3. Issueから以下を把握する: 問題の内容、再現手順、期待される動作、関連ファイルのヒント。

### ステップ2: 原因調査

1. `CLAUDE.md` と関連する `docs/` の永続ドキュメントを読む。
2. GrepでIssueに関連するコードを検索し、原因箇所を特定する。
3. 原因が特定できない・Issueの内容が曖昧な場合は、調査結果と質問を `gh issue comment` で残すことを提案し、ユーザーの判断を仰ぐ。

### ステップ3: ブランチとステアリングファイルの作成

1. ブランチを作成する: `fix/[YYYYMMDD]-issue-[Issue番号]`
   ```bash
   git checkout -b fix/[YYYYMMDD]-issue-[Issue番号]
   ```
2. `.steering/[YYYYMMDD]-issue-[Issue番号]/` を作成し、`Skill('steering')` の**計画モード**で `requirements.md`・`design.md`・`tasklist.md` を生成する。
   - `requirements.md` にはIssueの内容とIssue番号を記載する
   - 軽微な修正（1〜2ファイル・数行程度）の場合、design.mdは簡潔でよい

### ステップ4: 実装

1. `Skill('steering')` の**実装モード**で `tasklist.md` に従って修正を実装する。
2. 修正に対応するテストを追加または更新する（回帰防止）。

### ステップ5: 検証

1. `/check`(test-runner subagent に委譲)を実行し、全チェックをパスさせる。
2. 可能であれば、Issueに記載された再現手順で問題が解消したことを確認する。

### ステップ6: コミットとPR作成

1. 変更をコミット・プッシュする:
   ```bash
   git add [変更ファイル]
   git commit -m "fix: [修正内容の要約] (#[Issue番号])"
   git push -u origin [ブランチ名]
   ```
2. PRを作成する（ベースブランチは `docs/development-guidelines.md` のブランチ戦略に従う。未定義ならデフォルトブランチ `main`。ボディは `.github/pull_request_template.md` の構成に従う）:
   ```bash
   gh pr create \
     --title "fix: [修正内容の要約]" \
     --base [ブランチ戦略に従ったベースブランチ] \
     --body "## 概要
   [修正内容と原因の説明。主な変更ファイル]

   ## 関連 Issue

   Closes #[Issue番号]

   ## ステアリング

   [.steering/ ディレクトリ名]

   ## 検証
   - [x] /check(lint・型チェック・テスト・フォーマット)がパス
   - [x] [Issueの再現手順で解消を確認した内容]

   🤖 Generated with [Claude Code](https://claude.com/claude-code)"
   ```
3. PRのURLをユーザーに報告する。
