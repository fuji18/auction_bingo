---
description: GitHub Issues のチケットから次に着手すべきものを選定し、ラベルでステータス管理しながらadd-featureフローで実装する
---

# 次のチケットに着手

GitHub Issues のチケット(`ticket` ラベル付き Issue)を消化するための日常コマンドです。ステータスはラベル(`in-progress`)と open/closed で管理し、チケットファイルの編集・コミットは発生しません。

**引数:** なし(任意で Issue 番号を指定してよい。例: `/next-ticket 12`)

---

## 手順

### ステップ1: チケットの選定

1. チケット Issue の一覧と状態を取得する:
   ```bash
   gh issue list --label ticket --state open --json number,title,labels,body --limit 100
   ```
2. **`in-progress` の Issue が既にある場合**は、新しいチケットに着手せず次の分岐に従う:
   - その Issue に対応するオープン PR がある(`gh pr list` で確認)→ マージ待ち。PR の確認・マージを提案して終了する
   - オープン PR がない → 作業が中断している。対応する `.steering/` を提示して `/resume-work` を案内して終了する
3. 引数で Issue 番号が指定されていればそれを選ぶ。指定がなければ以下の条件で選定する:
   - `in-progress` ラベルが付いていないこと
   - ボディの `depends: #N` で参照される Issue がすべて closed であること
   - 優先度ラベルが最も高いこと(P0 > P1 > P2。同順位ならフェーズ順・番号順)
4. 選定結果(Issue 番号・タイトル・理由)を 1〜2 行でユーザーに提示してから着手する。

### ステップ2: ステータス更新(着手)

```bash
gh issue edit [番号] --add-label in-progress
```

### ステップ3: 実装

Issue のボディ(スコープ・受け入れ条件・技術メモ)を要求として、`/add-feature` と同じフロー(ブランチ作成 → steering 計画 → 実装ループ → 並列検証(code-reviewer + test-runner) → 振り返り → コミット・PR)を実行する。

- `.steering/` のディレクトリ名は `[YYYYMMDD]-issue[番号]-[短い名前]` とする
- PR ボディに **`Closes #[番号]`** を必ず含める(マージ時に Issue が自動クローズされる)
- Issue に書かれていない機能(P1/P2 の前倒し等)を実装しない

### ステップ4: 作業記録の残置

PR 作成まで完了したら、Issue にコメントで記録を残す(ステータス編集は不要。クローズは PR マージが自動で行う):

```bash
gh issue comment [番号] --body "実装完了。PR: [PR URL] / steering: .steering/[ディレクトリ名]"
```

### ステップ5: 報告

- 完了したチケットと PR URL を報告する
- 残りチケット数と、次に着手可能なチケットを 1 行で提示する
- 次のチケットに移る前の `/clear` を推奨する(コンテキストの持ち越しは不要。CLAUDE.md のコンテキスト管理ルール)
- 全チケットがクローズ済みの場合は、`/sync-docs` の実行と P1 チケットの検討(`/setup-tickets`)を提案する
