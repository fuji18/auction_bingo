# Issue #8 CPU(レオ・サラ)とベースライン戦略 — 要求

## 目的
読み合いの手応えを生む 2 体の CPU(レオ・サラ)と、#9 のバランス検証に使う
ベースライン戦略群を実装する。CPU のロジックは非公開だが、テルとリプレイで
事後検証できる。閾値・係数はロジックと分離し、#9 で数値調整する。

## 出所(根拠)
- docs/functional-design.md「4. CPU の意思決定」節(desire / レオ・サラの式 /
  chooseNumber / selectVision / テル生成)
- docs/product-requirements.md「5. CPU 対戦相手」
- src/agents/types.ts の `Agent` インターフェース(#6 で確定・変更しない)

## 受け入れ条件(Issue より)
- [ ] レオ・サラが Agent インターフェースを実装し、PublicView/SecretView のみを受け取る
- [ ] chooseNumber が「自分の最長ラインを伸ばす候補優先、無ければ相手のリーチを
      完成させない/パス」を実装
- [ ] selectVision が予知の3枚から desire 最大を選ぶ
- [ ] テルに15%のノイズが入る(rng を消費)
- [ ] baseline 4戦略(hoarder / allIn / noSkill / random)が実装されている
- [ ] `npm test` / `npm run typecheck` / `npm run lint` が通る

## スコープ外
- シミュレーションの実行と集計(#9)
- 閾値の最終調整(#9 で数値を見て行う)
- 人間プレイヤー用の Agent(作らない。UI から直接 reduce)
