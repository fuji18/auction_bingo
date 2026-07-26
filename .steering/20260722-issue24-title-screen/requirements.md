# requirements — issue #24 UI: タイトル画面と画面遷移

## 対象 Issue
- #24（P0・フェーズ3）depends: #11(closed)
- 根拠: docs/functional-design.md「画面遷移」節

## 背景
functional-design.md の画面遷移図には `Title → Playing`(はじめる)/ `Result → Title`(タイトルへ)が定義されているが、実装にタイトル画面が無く、起動時に自動でセーブ復元/新規開始していた。#11 でスコープ外とされたまま未実装(sync-docs で検出)。

## スコープ(やること)
- タイトル画面(`Title` 状態)の追加
- `Title → Playing`(はじめる = 新規)導線。セーブがある場合は「つづきから」も提示
- `Result → Title`(タイトルへ)導線

## スコープ外
- 設定画面・難易度選択などの新規メニュー項目
- ルール判断の UI 実装(禁止・従来通り core に委譲)

## 受け入れ条件
- [ ] 起動時にタイトル画面が表示される
- [ ] 「はじめる」で対戦画面に遷移する
- [ ] 決着画面から「タイトルへ」でタイトルに戻れる
- [ ] セーブの復元挙動が画面遷移と矛盾しない
- [ ] `npm run build` / `npm run typecheck` / `npm run lint` が通る

## 画面遷移(functional-design.md より)
```
[*] --> Title
Title --> Playing: はじめる
Title --> Playing: 途中のゲームを再開
Playing --> Result: ビンゴ達成 / 25ターン経過
Result --> Replay --> Result
Result --> Playing: もう一度
Result --> Title: タイトルへ
```
