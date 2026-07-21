# プロジェクトメモリ

## 技術スタック

- 開発環境: devcontainer
- Node.js v24(devcontainer / CI / `engines` で固定)、パッケージマネージャー: npm
- TypeScript 6.x / **Svelte 5** / **Vite 8**
- 検証: `npm run lint`(ESLint 10 + eslint-plugin-svelte) / `npm run typecheck`(**svelte-check**) / `npm test`(Vitest 4) / `npm run format:check`(Prettier + prettier-plugin-svelte)
- 配信: **静的サイト**(`vite build` → `dist/`)を Cloudflare Pages へ。設定は `wrangler.toml`

### ハブ&スポーク構成

本リポジトリは `fujioha_platform`(Astro のハブ)に対する**スポーク**であり、独立リポジトリ・独自サブドメイン(`auction-bingo.fujioha.com` を想定)で完結する。既存スポーク `kanji_gacha` と同じ構成(Vite + Svelte 5 + TypeScript + Cloudflare Pages)を踏襲する。

- ハブとは URL でのみ繋がる疎結合。共有パッケージ `@fujioha/ui` は Astro 専用のため**使わない**
- 公開時はハブ側に `apps/game/src/content/games/auction-bingo.json` の追加が必要(`src/content/config.ts` の `icon` enum にビンゴ向けの値が無いため schema 拡張も要る)

### 設計上の制約(オンライン化を見据える)

- ゲームロジックは `src/core/` に**純粋なリデューサ**として置き、UI・タイマー・乱数に依存させない
- 乱数は state 内の seed から生成する(`Math.random()` の直呼び禁止)
- CPU は `Agent: (公開情報, 自分の秘密情報) -> Action` インターフェースで実装する
- バランス定数はすべて設定ファイルに外出しし、`src/sim/` の自動対戦で検証する

## モデル運用方針(司令塔 = Opus / 委譲 = Sonnet・Haiku)

- **司令塔(メインセッション)は Opus**(`.claude/settings.json` で固定)。計画・設計判断・統合・ユーザーへの報告を担う
- **委譲できる作業は subagent へ**: レビュー(code-reviewer)・検証(implementation-validator)・ドキュメントレビュー(doc-reviewer)は Sonnet、品質チェック実行(test-runner)は Haiku、広範囲のコード探索は組み込みの Explore エージェント。独立したサブタスクが発生したら委譲し、待つ間も司令塔は作業を続ける
- **ログの長い作業は司令塔で直接実行しない**: lint・テスト実行は `/check`(test-runner に委譲)、docs/ と実装の突き合わせは `/sync-docs`(検出フェーズを subagent に委譲)を使い、司令塔にはサマリーだけを残す
- **subagent への受け渡しは参照で**: spawn プロンプトにファイル内容や Issue 本文を貼らず、パス・Issue 番号だけ渡して subagent 自身に読ませる。返しはサマリーのみを要求する
- **Fable 5 は最難関タスクのみ**(難度の高い設計、根本原因不明の調査)。`/model fable` で一時切替し、完了後 `/model opus` に戻す
- Agent Teams を使う場合、teammates は Sonnet を指定する(spawn プロンプトに明記)
- ハーネス層の追加・更新は `/harness-setup` を使う

## スペック駆動開発の基本原則

### 基本フロー

1. **ドキュメント作成**: 永続ドキュメント(`docs/`)で「何を作るか」を定義
2. **作業計画**: ステアリングファイル(`.steering/`)で「今回何をするか」を計画
3. **実装**: tasklist.mdに従って実装し、進捗を随時更新
4. **検証**: テストと動作確認
5. **更新**: 必要に応じてドキュメント更新

### 重要なルール

#### ドキュメント作成時

**1ファイルずつ作成し、必ずユーザーの承認を得てから次に進む**

承認待ちの際は、明確に伝える:
```
「[ドキュメント名]の作成が完了しました。内容を確認してください。
承認いただけたら次のドキュメントに進みます。」
```

#### 実装前の確認

新しい実装を始める前に、必ず以下を確認:

1. CLAUDE.mdを読む
2. 関連する永続ドキュメント(`docs/`)の**該当節のみ**読む(チケット Issue の「根拠」に挙がった節を起点にする。6ファイル全読みはしない)
3. 既存の類似実装を検索(ピンポイントな検索は Grep、複数ディレクトリ・命名規則をまたぐ広範囲の探索は Explore subagent に委譲し結論だけ受け取る)
4. 使用するライブラリの API 仕様が不確かなとき(メジャーバージョン更新直後・知識カットオフ以降のリリース等)は Context7(`mcp__context7__*`)で最新ドキュメントを引く(WebSearch での検索→全文取得の往復より安い。確信があるなら引かない)
5. 既存パターンを理解してから実装開始

#### プロジェクト開始時(技術スタック整合)

`docs/ideas/` の技術選定がテンプレート既定(Node.js/TypeScript)と異なる場合、実装を始める前に検証コマンド・devcontainer・TSツールチェーンの置換をタスク化し、CLAUDE.mdの技術スタック節を更新する(`/kickoff` フェーズ1が担当)。

#### スコープガード

アイデアやPRDに優先度(P0/P1/P2)がある場合、**P0以外を実装しない**。P1/P2の前倒し実装はユーザー承認を得てから行う。

#### 完了報告と回復のルール(when X, do Y)

- 実装タスクを完了と報告する前に、`/check`(test-runner に委譲)を通す。失敗が残っている場合は「完了」と報告せず、残課題として明示する
- PR 作成前に `.steering/*/tasklist.md` の未完了項目を確認し、残がある場合は PR ボディに明記する
- 同じエラーの修正に 2 回連続で失敗したら、同じアプローチを繰り返さない。原因の仮説を書き出してから別のアプローチを取る(必要なら `/model fable` への一時切替を提案し、完了後 `/model opus` に戻す)

#### チケット運用(GitHub Issues)

チケットは GitHub Issues(`ticket` + 優先度ラベル)で管理する(`/setup-tickets` が発行)。着手時に `in-progress` ラベルを付け、PR ボディの `Closes #N` でマージ時に自動クローズさせる。PR 作成後は Issue にコメントで `.steering/` ディレクトリ名とPR URLを記録する(`/next-ticket` が担当)。チケットファイルのステータス編集・コミットは行わない。

**`gh` CLI が使えない環境(Claude Code on the web のリモート実行等)では、コマンド・スキル内の `gh` 操作を同等の GitHub MCP ツール(`mcp__github__*`)で代替する。**

#### コンテキスト管理(チケット区切りで /clear)

チケット完了(PR 作成)を報告するとき、次のチケットに移る前の `/clear` をユーザーに推奨する。作業状態は Issue・`.steering/`・git に永続化済みで、コンテキストの持ち越しは不要(前チケットのツール結果を次チケットで再送し続けるのが最大のトークン浪費)。`/clear`・resume 後は SessionStart フックが現在地(ブランチ・in-progress Issue・未完了タスク)を自動注入する。

#### ステアリングファイル管理

作業ごとに `.steering/[YYYYMMDD]-[タスク名]/`(例: `20250115-add-user-profile`)を作成し、**作業計画・実装・検証時は `steering` スキルを使用する**:

- **作業計画時**: モード1(`requirements.md` / `design.md` / `tasklist.md` の作成)
- **実装時**: モード2(実装と tasklist.md 更新管理)
- **検証時**: モード3(振り返り・申し送り)

詳細な手順はsteeringスキル内に定義されています。

## ディレクトリ構造(要点)

- `docs/ideas/`: 下書き・アイデア(自由形式。`/setup-project` が自動で読み込む)。プロジェクト開始の起点は `initial-requirements.md`
- `docs/template-dev/`: テンプレート自体の開発記録と記入例(`*.example.md` 含め読み込み対象外。プロダクト開発開始後は削除可)
- `docs/`: 正式版の永続ドキュメント6つ(PRD / 機能設計 / 技術仕様 / リポジトリ構造 / 開発ガイドライン / 用語集)。基本設計を記述し頻繁には更新しない「北極星」
- 実装チケット: GitHub Issues で管理(`/setup-tickets` が発行。リポジトリ内にチケットファイルは置かない)
- `.steering/`: 作業単位の計画とタスクリスト。作業ごとに新規作成し、**履歴としてコミットして保持する**

詳細は `README.md` を参照。

## レビューの使い分け(トークン最適化済み)

- **機械的な品質ゲート**: CI(`ci.yml`)が push / PR ごとに lint・型チェック・フォーマット・テストを常時実行する(シークレット不要)
- **実装中(主レビュー)**: `code-reviewer` subagent(read-only、Sonnet)を起動する。docs/ とのスペック整合もここで確認する
- **PR 時(最終ゲート、自動は 1 回だけ)**: GitHub Actions は **main 向け PR のオープン時と ready_for_review 時のみ**走る。develop 等の統合ブランチ向け PR では走らない(意図的なコスト削減。feature コードの主レビューは実装中の code-reviewer が担う)。push ごとの再レビューも走らない。再レビューが必要なときは PR 上で `@claude` にメンションする
- **Agent Teams 並行レビュー / `/code-review ultra`**: **200 行以上 かつ 重要変更(認証・決済・データ移行・アーキテクチャ変更)** のときのみ提案する。通常の大きめ差分には使わない

## 開発プロセス

### 初回セットアップ

詳細な手順書は `README.md` を参照。

1. このテンプレートを使用(devcontainerで開く)
2. アイデアを `docs/ideas/initial-requirements.md` に書く
3. `/kickoff` を実行(スタック整合 → /setup-project → /setup-tickets → /harness-setup → README書き換えまで一気通貫)
   - ハブ&スポーク構成の場合は `/setup-spoke-standards` も実行する
4. `/next-ticket` でチケットを消化(または `/add-feature [機能]`)

### 日常的な使い方

基本は普通に会話で依頼する(ドキュメント編集・調査・相談など)。定型フローのみスラッシュコマンドを使う(各コマンドの説明はコマンド一覧に注入済み。早見表は `README.md` の「コマンド早見表」を参照)。

**ポイント**: スペック駆動開発の詳細を意識する必要はありません。Claude Codeが適切なスキルを判断してロードします。