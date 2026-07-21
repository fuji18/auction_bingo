# 開発ガイドライン (Development Guidelines)

> 本書は「どう書くか・どう進めるか」を定義する。汎用的な TypeScript の作法ではなく、**本プロジェクトで守らないと壊れるもの**を優先して記述する。

## 最優先の規約 — 決定性

本プロジェクトのすべての機能(リプレイ・シミュレーション・セーブ復元・デバッグ)は、**同一のシードと操作列から同一の結果が再現される**という一点に依存している。これを壊す変更は、他のどんな利点があっても受け入れない。

### `core/` と `agents/` で禁止すること

```typescript
// ❌ 絶対に書いてはいけない
const n = Math.random();
const now = Date.now();
const t = new Date();
console.log(state);
if (window.innerWidth < 400) { /* ... */ }
```

```typescript
// ✅ 乱数は必ず state から取り出し、新しい state を返す
const [value, nextRng] = nextInt(state.rng, 40);
return { ...state, rng: nextRng };
```

**これらは `eslint.config.js` でエラーになる。** 規約を人間の注意力で守らせない。

### `reduce` は入力 state を破壊しない

```typescript
// ❌ 悪い例: 引数を直接書き換える
function reduce(state: GameState, actions: Action[]) {
  state.turn += 1;             // 呼び出し元の state が変わってしまう
  state.players[0].coins -= 5; // リプレイ・巻き戻しが不可能になる
  return { state, events };
}

// ✅ 良い例: 新しいオブジェクトを返す
function reduce(state: GameState, actions: Action[]) {
  const players = state.players.map((p) =>
    p.id === winner ? { ...p, coins: p.coins - paid } : p
  );
  return { state: { ...state, turn: state.turn + 1, players }, events };
}
```

**変更のない部分は参照を使い回してよい**(上の例で落札者以外の `PlayerState` はそのまま)。性能のためであり、非破壊性とは両立する。

### 乱数の消費順序を変えない

`rng` は消費した回数まで状態に含む。**盤面生成の順序、シャッフルの回数、テルのノイズ判定の位置を変えると、同じシードから別の結果が出る。** リファクタリングで処理順を入れ替えるときは、`tests/determinism.test.ts` が守ってくれる範囲を超えていないか必ず確認する。

意図的に乱数の消費を変える場合(バランス調整など)は、**コミットメッセージにその旨を明記する**。既存のセーブデータとリプレイが再現しなくなるため。

## コーディング規約

### 命名規則

`docs/repository-structure.md` の「命名規則」に従う。要約:

| 種別 | 規則 | 例 |
|---|---|---|
| 型・インターフェース | PascalCase | `GameState` / `BalanceConfig` |
| 関数・変数 | camelCase | `completedLines` / `tokenIndex` |
| モジュールレベル定数 | UPPER_SNAKE_CASE | `DEFAULT_CONFIG` / `LINE_INDICES` |
| Boolean | `is` / `has` / `can` で始める | `isMarked` / `hasReach` / `canAfford` |
| Svelte コンポーネント | PascalCase.svelte | `BoardView.svelte` |

**インターフェースに `I` 接頭辞は付けない。**

### ゲーム用語は用語集に従う

```typescript
// ✅ 良い例: docs/glossary.md の語彙をそのまま使う
interface Submission { skill: SkillId | null; bid: number }
const candidates = shiftRange(target, range);

// ❌ 悪い例: 独自の言い換え
interface Bet { power: string | null; amount: number }
const options = calcOptions(num, r);
```

**仕様と実装で語彙がずれると、`docs/functional-design.md` のどの規則がどのコードに対応するのか追えなくなる。** ゲーム用語(ターゲット / 落札 / 予約 / 優先権トークン / リーチ / パス など)は `docs/glossary.md` の表記を識別子にそのまま反映する。

### 型定義

**判別可能ユニオンを使い、`switch` の網羅性をコンパイラに検査させる。**

```typescript
// ✅ 良い例
function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'TurnStarted':
      return /* ... */;
    case 'AuctionResolved':
      return /* ... */;
    // ... 全ケース
    default: {
      const exhaustive: never = event;  // ケース漏れがあればここで型エラー
      throw new Error(`未知のイベント: ${JSON.stringify(exhaustive)}`);
    }
  }
}
```

イベント種別を追加したときに対応漏れを検出できる。**`GameEvent` や `Action` を扱う `switch` には必ずこの `never` チェックを置く。**

**`any` を使わない。** 型が決まらない場合は `unknown` を使い、絞り込んでから扱う。ESLint では `warn` にしてあるが、レビューでは `[必須]` 扱いとする。

### 関数設計

- **`core/` はすべて純粋関数**として書く。副作用を持たない、同じ入力に同じ出力を返す。
- **早期リターン**でネストを浅く保つ。
- **引数は3つまで**を目安とし、超える場合はオブジェクトで受ける。

```typescript
// ❌ 悪い例
function settle(state, winnerId, bid, divisor, cap, refunds) { }

// ✅ 良い例
function settle(state: GameState, params: SettleParams): SettleResult { }
```

### コメント規約

**「何をしているか」ではなく「なぜそうするか」を書く。**

```typescript
// ✅ 良い例
// 予知は今ターンの target には影響しない。target は既に山札から
// 抜かれているため(functional-design.md ステップ2を参照)。
const peeked = state.deck.slice(0, config.skills.vision.peek);

// ❌ 悪い例
// 山札の先頭3枚を取得する
const peeked = state.deck.slice(0, config.skills.vision.peek);
```

**ルール由来のマジックナンバーには、必ず根拠へのポインタを添える。**

```typescript
// ✅ 良い例
// 分配は floor(bid / 4)。divisor が playerCount + 1 未満だと
// 分配総額が入札額を超えてコインが増殖する(config.ts の validateConfig を参照)。
const received = Math.floor(paid / config.economy.distributionDivisor);
```

公開関数には JSDoc を付ける。引数と戻り値が型から自明な場合、`@param` / `@returns` の繰り返しは不要で、**その関数が何を保証するか**を書く。

```typescript
/**
 * 落札者が選べる候補を算出する。
 *
 * 範囲外(1未満・40超)はクランプも循環もせず、その候補を除外する。
 * 列をまたぐことは許す(target=8 で偏向なら {7,8,9})。
 */
function candidatesFor(target: number, range: number, config: BalanceConfig): number[];
```

### エラーハンドリング

**`core/` は原則として例外を投げない。**

| 状況 | 扱い |
|---|---|
| 不正なアクション(コイン超過・負の入札・フェーズ不一致) | **`reduce` が拒否し、state を変更せず events にも記録しない。** 例外を投げない |
| `config` の制約違反 | `validateConfig` が起動時に throw する。**開発時のバグであり、実行時には起きない** |
| 到達しないはずの分岐 | `never` チェックで throw する。**バグの検出が目的** |
| セーブデータの破損 | `ui/` 側で捕捉し、セーブを破棄して新規ゲームへ |

```typescript
// ✅ 良い例: 不正な提出は静かに拒否する
if (bid + skillCost > player.coins) {
  return { state, events: [] };  // 変更なし
}
```

**理由**: `reduce` が例外を投げると、シミュレーションが1万戦の途中で止まり、UI ではエラー境界の実装が必要になる。不正アクションは「UI 側で事前に防ぐべきもの」であり、`core/` に到達した時点で無視すればよい。

エラーメッセージに内部状態を含めない。

## テスト

### 方針

- **`core/` はテストを先に書く**(TDD)。ルールが仕様として先に決まっているため、期待値を先に書ける数少ない領域。
- **`ui/` にテストの数値目標は課さない。**
- **モックは使わない。** `core/` は純粋関数で外部依存を持たないため、モックが必要になった時点で設計が間違っている。

### カバレッジ目標

| 対象 | 目標 |
|---|---|
| `src/core/` | **90% 以上** |
| `src/agents/` | 主要な判断分岐を網羅 |
| `src/sim/` | 集計ロジックのみ |
| `src/ui/` | 目標なし |

### テスト命名

**日本語で書く。**

```typescript
describe('candidatesFor', () => {
  it('スキルなしのとき target のみを返す', () => { });
  it('偏向のとき target±1 の3個を返す', () => { });
  it('target が 1 のとき 0 以下を除外する', () => { });
  it('target が 40 のとき 41 以上を除外する', () => { });
  it('列をまたぐ候補を除外しない', () => { });
});
```

テンプレートの `create_emptyTitle_throwsValidationError` 形式は使わない。**本プロジェクトのテストはゲームルールの記述そのものであり、`docs/functional-design.md` と読み比べられることが最優先**だから。ドキュメントの文言をそのままテスト名にできる形を選ぶ。

### 必ず書く境界値

ルールに境界がある箇所は、**テストが無い実装をマージしない**。

- `target = 1` / `target = 40`(候補の範囲外除外)
- コイン上限 30 ちょうど / 超過
- 入札 0 / 全員が 0
- 分配の端数(`floor(bid/4)` と銀行回収額の合計が入札額に一致すること)
- 予知の競合(2人 / 3人)
- 同時ビンゴ
- タイブレークの4段階すべて

### テストの構造

```typescript
// ✅ 良い例: 準備・実行・検証を分ける
it('落札できなかった場合、偏向のコストが返金される', () => {
  // 準備
  const state = createGame(DEFAULT_CONFIG, 12345);

  // 実行
  const { state: next, events } = reduce(state, [
    { type: 'SUBMIT', playerId: 'p0', skill: 'shift', bid: 3 },
    { type: 'SUBMIT', playerId: 'p1', skill: null, bid: 9 },
    { type: 'SUBMIT', playerId: 'p2', skill: null, bid: 1 },
  ]);

  // 検証
  expect(events).toContainEqual(
    expect.objectContaining({ type: 'SkillRefunded', playerId: 'p0', reason: 'lost-auction' })
  );
});
```

**シードはテスト内にリテラルで書く。** 共有の定数にすると、1箇所の変更で無関係なテストが落ちる。

## Git 運用ルール

### ブランチ戦略

**`feature/*` → `develop` → `main` の2段構成とする。**

```
main                         ← 常にデプロイ可能。auction-bingo.fujioha.com に対応する
 └─ develop                  ← 開発の最新状態。チケットのマージ先
     ├─ feature/core-reducer
     ├─ feature/cpu-agents
     └─ fix/distribution-rounding
```

| ブランチ | 用途 | 直接コミット |
|---|---|---|
| `main` | 常にデプロイ可能な状態。リリース単位で `develop` からマージする | 禁止 |
| `develop` | 開発の最新状態。個々のチケットはここへマージする | 禁止 |
| `feature/[機能名]` | 新機能 | 可 |
| `fix/[修正内容]` | バグ修正 | 可 |
| `refactor/[対象]` | リファクタリング | 可 |
| `docs/[対象]` | ドキュメントのみの変更 | 可 |

**例外**: プロジェクト開始前のドキュメント整備(`/kickoff` フェーズ)は `main` への直接コミットを許容する。実装が始まった時点でこの例外は終了し、以降は必ず `feature/*` を切る。

### レビューがどこで効くか(重要)

2段構成では、自動レビューの起動タイミングがブランチによって異なる。**これを理解していないと、レビューされないまま実装が積み上がる。**

| タイミング | CI(lint / 型 / テスト / ビルド) | Claude 自動レビュー |
|---|---|---|
| `feature/*` → `develop` の PR | ✅ 走る | ❌ **走らない** |
| `develop` → `main` の PR | ✅ 走る | ✅ 走る(オープン時 / ready_for_review 時) |
| `main` / `develop` への push | ✅ 走る | ❌ 走らない |

`claude-code-review.yml` は `main` 向け PR に限定されている(意図的なコスト削減)。したがって:

- **feature コードの主レビューは、実装中に起動する `code-reviewer` subagent が担う。** 自動レビューを当てにしない
- `develop` → `main` の PR が最終ゲートになる。**ここをスキップして `main` に直接マージしない**
- 個別に再レビューが必要なときは、PR 上で `@claude` にメンションする

### 運用の注意

- `develop` は現在 `main` より6コミット遅れている(独自コミットは無し)。**実装開始前に `main` の内容へ同期する**
- `feature/*` は `develop` から切る。`main` から切らない
- `develop` が `main` から乖離しすぎないよう、**チケット2〜3件ごとに `main` へマージする**

### コミットメッセージ規約

**Conventional Commits 形式・本文は日本語**で書く。

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type**: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore` / `build` / `perf`

**scope**(本プロジェクトの標準): `core` / `agents` / `sim` / `ui` / `docs` / `ci`

```
feat(core): ターン解決のリデューサを実装

提出から精算までの7ステップを decisive に処理する。
予知は target 決定後に解決するため、今ターンの target には影響しない。

- 予知の競合を優先権トークン順で決着させる
- 偏向・強奪は落札時のみ徴収し、落札失敗時は返金する
- 分配は floor(bid / 4)、残りは銀行が回収する

Closes #12
```

**subject は命令形の現在形で、句点を付けない。** 50文字程度に収める。

**★ 乱数の消費順序を変える変更では、body に必ずその旨を書く**(既存のセーブとリプレイが再現しなくなるため)。

### プルリクエスト

**作成前のチェック**(`/check` で一括実行できる):

- [ ] `npm run lint` が通る
- [ ] `npm run typecheck` が通る
- [ ] `npm test` が通る
- [ ] `npm run format:check` が通る
- [ ] `npm run build` が通る
- [ ] `.steering/*/tasklist.md` の未完了項目を確認した

**PR テンプレート**:

```markdown
## 概要
[変更内容の簡潔な説明]

## 変更理由
[なぜこの変更が必要か。docs/ の該当節へのポインタ]

## 変更内容
- [変更点1]
- [変更点2]

## 決定性への影響
- [ ] 乱数の消費順序を変えていない
- [ ] 変えた場合、その理由と影響範囲: [記述]

## テスト
- [ ] ユニットテストを追加した
- [ ] 境界値をカバーした
- [ ] 手動で動作確認した

## 残課題
[tasklist.md の未完了項目があれば記載]

Closes #[Issue番号]
```

**「決定性への影響」を必須項目にする。** 本プロジェクトで最も静かに壊れやすく、壊れたことに気づきにくい性質だから。

### マージ方針

| マージ | 方式 | 理由 |
|---|---|---|
| `feature/*` → `develop` | **Squash merge** | ブランチ内の試行錯誤を履歴に持ち込まない。1チケット = 1コミットになる |
| `develop` → `main` | **通常のマージコミット** | リリース単位の区切りを履歴に残す。squash すると `develop` の個々のチケットが1つに潰れる |

- マージ後は `feature/*` ブランチを削除する。`develop` は削除しない。
- `main` / `develop` への直接 push は行わない(実装開始後)。

## コードレビュー基準

`code-reviewer` subagent(実装中の主レビュー)と、`main` 向け PR の自動レビューが担う。以下は両者に共通する観点。

### 本プロジェクト固有の観点(最優先)

- [ ] **`core/` に副作用・外部依存が入っていないか**(`Math.random` / `Date` / DOM / `console`)
- [ ] **`reduce` が入力 state を破壊していないか**
- [ ] **乱数の消費順序を変えていないか**。変えた場合、PR に記載があるか
- [ ] **`agents/` が `GameState` 全体を受け取っていないか**(`PublicView` / `SecretView` のみか)
- [ ] **`ui/` にルール判断が漏れ出していないか**
- [ ] **バランス定数がコード中にリテラルで書かれていないか**(`config` から引いているか)
- [ ] **`docs/functional-design.md` の規則と実装が一致しているか**。仕様変更を伴う場合、docs が更新されているか
- [ ] **境界値のテストがあるか**

### 一般的な観点

- **機能性**: 要件を満たすか。エッジケースを考慮しているか
- **可読性**: 命名が用語集に従っているか。「なぜ」のコメントがあるか
- **保守性**: 責務が分離されているか。重複がないか
- **パフォーマンス**: 不要なディープコピーがないか(1万戦シミュレーションに効く)

### レビューコメントの優先度

- `[必須]`: 修正しないとマージしない
- `[推奨]`: 修正が望ましい
- `[提案]`: 検討してほしい
- `[質問]`: 理解のための質問

```markdown
✅ 良い例
[必須] ここで `Math.random()` を呼ぶと、同一シードからの再現ができなくなります。
`nextInt(state.rng, 40)` を使い、返された rng を state に戻してください。

❌ 悪い例
random は使わないでください。
```

**理由を書く。** 規約の存在を根拠にせず、それを守らないと何が壊れるかを書く。

## 開発フロー

### 実装の進め方

1. **チケットを選ぶ**: `/next-ticket`(GitHub Issues の `ticket` ラベル)
2. **計画する**: `.steering/[YYYYMMDD]-[タスク名]/` に `requirements.md` / `design.md` / `tasklist.md` を作成(`steering` スキル モード1)
3. **実装する**: tasklist を更新しながら進める(モード2)
4. **レビューする**: `code-reviewer` subagent を起動する
5. **検証する**: `/check` を通す。**失敗が残っている状態で「完了」と報告しない**
6. **PR を作成する**: `Closes #N` を含める。未完了項目があれば PR ボディに明記する
7. **記録する**: Issue に `.steering/` のディレクトリ名と PR URL をコメントする

### スコープガード

**P0 以外を実装しない。** P1 / P2 の前倒し実装はユーザー承認を得てから行う。優先度は `docs/product-requirements.md` に定義されている。

### 詰まったときの回復

**同じエラーの修正に2回連続で失敗したら、同じアプローチを繰り返さない。** 原因の仮説を書き出してから別のアプローチを取る。

### バランス調整のサイクル

バランス調整は実装とは別のリズムで進む。

1. `src/core/config.ts` または `src/agents/constants.ts` の値を変更する
2. `npm run sim -- --games 10000 --seed 1` を実行する
3. KPI 7項目を確認する(`docs/product-requirements.md`)
4. 変更した値と、その結果の KPI を**コミットメッセージに記録する**

```
chore(core): 予知のコストを 5 から 6 に引き上げる

終盤の予知選択比率が 78% で目標(70%以下)を超えていたため。
1万戦の結果: 予知比率 78% → 61%、ビンゴ発生率 97.1% → 96.8%、
スキル使用率 52% → 49%。
```

**数値の根拠を残さない調整は、後から再検討できない。**

## 開発環境セットアップ

### 必要なツール

| ツール | バージョン | 入手方法 |
|--------|-----------|---------|
| Docker | — | devcontainer の実行に必要 |
| VS Code + Dev Containers 拡張 | — | |
| Node.js | v24 | **devcontainer が提供する。ホストへの導入は不要** |

### セットアップ手順

```bash
# 1. リポジトリをクローンし、VS Code で開く
git clone https://github.com/fuji18/auction_bingo.git
cd auction_bingo
code .

# 2. 「Reopen in Container」を選択する(依存関係は自動でインストールされる)

# 3. 開発サーバーを起動する
npm run dev          # http://localhost:4330

# 4. 検証(コミット前)
npm run lint
npm run typecheck
npm test
npm run build
```

環境変数は不要(P0 は外部サービスに接続しない)。

### コマンド一覧

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー(port 4330) |
| `npm run build` | 静的ビルド → `dist/` |
| `npm run preview` | ビルド結果の確認 |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | svelte-check |
| `npm test` / `test:watch` / `test:coverage` | Vitest |
| `npm run format` / `format:check` | Prettier |
| `npm run sim` | 自動対戦シミュレーション(実装後に追加) |

### 品質の自動化

| タイミング | 実行内容 |
|---|---|
| ファイル編集時 | Claude Code の hook が Prettier と lint / typecheck を実行 |
| コミット時 | husky + lint-staged が ESLint / Prettier / secretlint を実行 |
| push / PR 時 | CI が lint・typecheck・test・format・build・secretlint・audit・ハーネス整合を実行(**PR は対象ブランチを問わず走る**) |
| `main` 向け PR のオープン / ready_for_review 時 | 自動コードレビュー(`CLAUDE_CODE_OAUTH_TOKEN` の設定が必要)。**`develop` 向け PR では走らない** |
