# tasklist — Issue #23

- [x] 1. `Agent` に `tendency: string` を追加(src/agents/types.ts)
- [x] 2. leo / sara / baseline 4種 に `tendency` を定義
- [x] 3. `Game.tendencyOf(id)` を追加(src/ui/game.svelte.ts)
- [x] 4. App.svelte: CPU 名直下に傾向文を常時表示
- [x] 5. TellBadge.svelte: テル注記(title ツールチップ)
- [x] 6. App.svelte: フェアネス `<details>`(テル注記・非公開情報不参照の明言)
- [x] 7. game.test.ts に tendencyOf のテストを追加
- [x] 8. `/check`(lint / typecheck / test / build)を通す — 178 テスト通過

## 検証結果

- lint / typecheck / test(178) / format / build すべて通過
- code-reviewer レビュー実施
