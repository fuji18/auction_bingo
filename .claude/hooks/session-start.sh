#!/bin/bash
# SessionStart hook:
#   1) Claude Code on the web(リモート環境)では依存関係をインストールする
#   2) resume / clear 時は「現在地」(ブランチ・in-progress Issue・未完了タスク)を
#      コンテキストに自動注入する(チケット区切りの /clear 運用を支える)。
#      web リモートでは毎セッションが startup のため、startup でも注入する
#   3) startup 時にコード規模を検知し、serena MCP 再導入の目安超過を通知する
set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"
SOURCE="$(printf '%s' "$INPUT" | jq -r '.source // "startup"' 2>/dev/null || echo "startup")"

cd "${CLAUDE_PROJECT_DIR:-.}"

# --- 1) 依存関係(リモート環境のみ。devcontainer では post_create.sh が担う) ---
# node_modules があればスキップし、resume / clear のたびの再インストールを避ける
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -f package.json ] && [ ! -d node_modules ]; then
  # stdout はセッションのコンテキストに注入されるため、ログは stderr へ逃がす
  if npm install --no-audit --no-fund 1>&2; then
    echo "依存関係: npm install 完了(リモート環境)"
  else
    echo "⚠️ npm install に失敗した。検証コマンドの実行前に原因を確認すること"
  fi
fi

# --- ハーネスの自壊検知: hook スクリプトの実行権限が落ちていないか ---
# PreToolUse hook は実行失敗時にフェイルオープン(素通り)になるため、ここで警告する
for s in .claude/scripts/*.sh; do
  if [ -f "$s" ] && [ ! -x "$s" ]; then
    echo "⚠️ hook スクリプトに実行権限がない: $s(chmod +x で復旧すること。PreToolUse はフェイルオープンになる)"
  fi
done

# --- 2) serena MCP 再導入の規模検知(startup 時のみ・検知は自動、判断は人間) ---
# しきい値と判断材料・再導入手順は .claude/docs/serena-reintroduction.md を参照
# (.mcp.json には context7 等の他サーバーもあるため、serena エントリの有無で判定する)
if [ "$SOURCE" = "startup" ] && ! grep -qs '"serena"' .mcp.json; then
  TS_FILES="$(git ls-files '*.ts' '*.tsx' 2>/dev/null | wc -l)"
  TS_LOC="$(git ls-files '*.ts' '*.tsx' 2>/dev/null | xargs -r cat 2>/dev/null | wc -l)"
  if [ "${TS_LOC:-0}" -gt 30000 ] || [ "${TS_FILES:-0}" -gt 300 ]; then
    echo "コード規模が serena MCP 再導入の目安を超えた(TS: ${TS_LOC} 行 / ${TS_FILES} ファイル)。.claude/docs/serena-reintroduction.md を読み、再導入をユーザーに提案すること"
  fi
fi

# --- 3) resume / clear 時の現在地オリエンテーション ---
# web リモート(CLAUDE_CODE_REMOTE=true)は /clear せず新セッションを作る運用のため startup も対象
if [ "$SOURCE" = "resume" ] || [ "$SOURCE" = "clear" ] || { [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ "$SOURCE" = "startup" ]; }; then
  echo "## 現在地(SessionStart 自動オリエンテーション)"
  echo "- ブランチ: $(git branch --show-current 2>/dev/null || echo '不明')"

  CHANGES="$(git status --short 2>/dev/null | head -10 || true)"
  if [ -n "$CHANGES" ]; then
    echo "- 未コミット変更:"
    printf '%s\n' "$CHANGES" | sed 's/^/  /'
  else
    echo "- 未コミット変更: なし"
  fi

  if command -v gh >/dev/null 2>&1; then
    ISSUES="$(gh issue list --label in-progress --state open --limit 5 2>/dev/null || true)"
    if [ -n "$ISSUES" ]; then
      echo "- in-progress チケット:"
      printf '%s\n' "$ISSUES" | sed 's/^/  /'
    fi
  else
    echo "- in-progress チケット: 未取得(gh CLI が無い環境。GitHub MCP ツールで確認する)"
  fi

  # ディレクトリ名の日付規約(YYYYMMDD-)で最新を選ぶ(mtime はクローン直後に信頼できない)
  LATEST_STEERING="$(ls -1d .steering/*/ 2>/dev/null | sort -r | head -1 || true)"
  if [ -n "$LATEST_STEERING" ] && [ -f "${LATEST_STEERING}tasklist.md" ]; then
    UNDONE="$(grep -E '^[[:space:]]*- \[ \]' "${LATEST_STEERING}tasklist.md" 2>/dev/null | head -10 || true)"
    if [ -n "$UNDONE" ]; then
      echo "- 最新ステアリング(${LATEST_STEERING})の未完了タスク:"
      printf '%s\n' "$UNDONE" | sed 's/^/  /'
      echo "- 作業を再開する場合は /resume-work、次のチケットに進む場合は /next-ticket"
    fi
  fi
fi

exit 0
