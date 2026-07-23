# tasklist — issue #24 タイトル画面と画面遷移

- [x] 1. `game.svelte.ts`: constructor の自動開始を撤廃し `hasSave()` / `resume()` を追加、`restoreOrNew` を削除
- [x] 2. `ResultPanel.svelte`: `ontitle` prop と「タイトルへ」ボタンを追加
- [x] 3. `App.svelte`: `screen` 状態・タイトル画面 UI・`canContinue`・`ontitle` 配線
- [x] 4. `game.test.ts`: 新ライフサイクル API に追従(復元・破損・未開始・不正手)
- [x] 5. `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` を通す(全緑)
- [x] 6. code-reviewer による検証(Major 1・Minor 2 を反映済み)
- [x] 7. コミット・PR(develop 向け・`Closes #24`)・Issue コメント → PR #27
