# requirements — Issue #23 UI: CPU 傾向文・テル注記・非公開情報の明示

- Issue: #23(P0 / フェーズ3 / depends #11)
- 根拠: docs/product-requirements.md「5. CPU 対戦相手(2体)」受け入れ条件 / docs/functional-design.md「テルの生成」節

## 目的

「納得できるフェアネス」を UI 上で明示する。傾向文・テル注記・非公開情報不参照の明言が
issue #10/#11 の実装に含まれておらず、傾向文言はソースコメントにのみ存在する状態を解消する。

## 受け入れ条件(Issue より)

1. 各 CPU の傾向を説明する一文が、ゲーム中いつでも参照できる位置に表示される
2. テルが確定情報ではない旨が UI 上に明記される
3. CPU が非公開情報(他者の入札・山札・他者の予知結果)を参照しない旨が UI 上に明言される
4. `npm run build` / `npm run typecheck` / `npm run lint` が通る

## スコープ外

- テルの生成ロジック・CPU の意思決定ロジックの変更(表示のみ)
- 設定画面などの新規メニュー

## 制約

- 傾向文言の重複定義を避ける(コメントではなく参照可能な単一情報源に)
- 対象: src/ui/components/TellBadge.svelte, src/ui/App.svelte 周辺
