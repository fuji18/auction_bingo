# オークション・ビンゴ (AUCTION BINGO)

確率を金で買う対戦型 Web ボードゲーム。運任せのビンゴを「オークション」「有料の確率操作」「読めない CPU」で再構築する。

- **確率を飼い慣らす**: 数字が出るのを祈るのではなく、コインを投じて欲しい数字を能動的に引き寄せる
- **二重のコスト構造**: 限られたコインを、落札する確率(オークション)か、落札したときの選択肢(スキル)かで毎ターン悩む
- **納得できるフェアネス**: CPU の内部ロジックは非公開だが、傾向は常時開示し、試合後リプレイで手の内を完全開示する

`fujioha.com` プラットフォームのスポークとして、`auction-bingo.fujioha.com`(予定)で公開する。

## 技術スタック

- **Svelte 5** + **Vite 8** + **TypeScript 6**(静的 Web アプリ)
- テスト: Vitest 4 / 型: svelte-check / Lint: ESLint 10 + eslint-plugin-svelte
- 配信: Cloudflare Pages(`wrangler.toml`)
- 開発環境: devcontainer(Node.js v24)

ゲームロジックは UI・通信・乱数から独立した**純粋なリデューサ**として実装し、将来のオンライン対戦に備える。詳細は `docs/architecture.md`。

## セットアップ

devcontainer で開くことを前提とする(Node.js は devcontainer が提供)。

```bash
git clone https://github.com/fuji18/auction_bingo.git
cd auction_bingo
code .
# 「Reopen in Container」を選択(依存は自動インストール)

npm run dev        # 開発サーバー http://localhost:4330
```

## コマンド

| コマンド                                           | 内容                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`                                      | 開発サーバー(port 4330)                                                                       |
| `npm run build`                                    | 静的ビルド → `dist/`                                                                          |
| `npm run preview`                                  | ビルド結果の確認                                                                              |
| `npm run lint` / `lint:fix`                        | ESLint                                                                                        |
| `npm run typecheck`                                | svelte-check                                                                                  |
| `npm test` / `test:watch` / `test:coverage`        | Vitest                                                                                        |
| `npm run format` / `format:check`                  | Prettier                                                                                      |
| `npm run sim -- --games N --seed S --agents a,b,c` | 自動対戦シミュレーション(KPI 計測)。既定は `--games 10000 --seed 1 --agents leo,sara,hoarder` |

## ドキュメント

`docs/` に永続ドキュメント6点(北極星)を置く。基本設計を記述し、頻繁には更新しない。

| ドキュメント                                                  | 内容                                              |
| ------------------------------------------------------------- | ------------------------------------------------- |
| [`product-requirements.md`](docs/product-requirements.md)     | 何を作るか。ビジョン・ペルソナ・KPI・機能要件     |
| [`functional-design.md`](docs/functional-design.md)           | ゲームルールの正典。データモデル・ターン解決・CPU |
| [`architecture.md`](docs/architecture.md)                     | 技術構成・レイヤー規則・脅威モデル                |
| [`repository-structure.md`](docs/repository-structure.md)     | ディレクトリ・命名・依存規則                      |
| [`development-guidelines.md`](docs/development-guidelines.md) | 決定性の規約・Git 運用・レビュー基準              |
| [`glossary.md`](docs/glossary.md)                             | 用語集(日本語 ↔ 識別子の対応)                     |

ゲームデザインの設計判断とその経緯は [`docs/ideas/initial-requirements.md`](docs/ideas/initial-requirements.md)(Ver 3.3)。スポーク公開の構成ルールは [`docs/playbook/spoke-development-standards.md`](docs/playbook/spoke-development-standards.md)。

## 開発フロー

スペック駆動開発 + GitHub Issues でのチケット管理。詳細は `CLAUDE.md` と `docs/development-guidelines.md`。

1. `/next-ticket` で GitHub Issues のチケット(`ticket` ラベル)から次を選定して着手
2. `.steering/[日付]-[タスク名]/` に計画・タスクリストを作成
3. 実装 → `code-reviewer` subagent でレビュー → `/check` で検証
4. `feature/*` → `develop` → `main` の順で PR。`Closes #N` でチケットを自動クローズ

ブランチは `feature/*` から `develop` へマージし、リリース単位で `develop` → `main`。Claude の自動レビューは `main` 向け PR でのみ起動するため、feature の主レビューは実装中の `code-reviewer` が担う。

## コマンド早見表

| コマンド              | 用途                                                |
| --------------------- | --------------------------------------------------- |
| `/next-ticket`        | 次のチケットを選定して実装に着手                    |
| `/add-feature [機能]` | チケット外の新機能を実装                            |
| `/check`              | lint・型・テスト・フォーマットを一括実行            |
| `/commit`             | Conventional Commits でコミット                     |
| `/status`             | チケット・ステアリング・git の現在地                |
| `/sync-docs`          | 実装と docs/ の乖離を検出・更新                     |
| `/resume-work`        | 中断した作業を再開                                  |
| `/code-review ultra`  | 多エージェント並行レビュー(200行以上の重要変更のみ) |

## ライセンス

UNLICENSED。個人開発プロジェクトであり、コードの利用許諾はしていない。
