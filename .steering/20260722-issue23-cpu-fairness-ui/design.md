# design — Issue #23

## 傾向文の単一情報源

`Agent` インターフェース(src/agents/types.ts)に UI 表示専用の `tendency: string` を追加する。
既存の `tell`(「UI 表示用。意思決定には影響しない」)と同じ位置づけ。各 agent 実装
(leo/sara/baseline 4種)で 1 行の傾向文を定義する。これにより:

- 傾向文言がコメントではなく参照可能な値になる(単一情報源)
- 「非公開情報を参照しない」という型の保証(pub/sec のみ受け取る)と同じ場所に傾向が同居する

UI は `game.svelte.ts` に `tendencyOf(id)` ゲッターを追加し、`CPU_AGENTS` から引く
(`tellOf` と同型)。人間座席は空文字。

## UI(App.svelte)

1. **傾向文の常時表示**: 各 CPU プレイヤーの名前直下に `game.tendencyOf(p.id)` を
   小さいキャプションで常時表示(いつでも参照できる位置)。
2. **テル注記(近接)**: TellBadge に `title` ツールチップを持たせ、テル語の近くで
   「確率的なヒント。確定情報ではない」を示す。
3. **フェアネス明言(明記/明言)**: 常時アクセス可能な `<details class="fairness">`
   (summary「このゲームの CPU について」)に、テルが確定情報でない旨と、CPU が
   非公開情報(他者の入札・山札・他者の予知結果)を参照しない旨を文章で明記する。

## テスト

- game.test.ts に `tendencyOf` の単体テスト(CPU は非空、人間は空文字)を追加。
- ロジック不変(表示のみ)なので既存テストは全て緑のまま。
