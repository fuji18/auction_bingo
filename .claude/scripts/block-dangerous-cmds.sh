#!/bin/bash
# PreToolUse(Bash) hook: 破壊的コマンドのパターン検査(第二防衛線)。
# permissions.deny は前方一致のみのため、引数順の違い(git push origin --force)や
# パイプ・サブシェル内の危険コマンドはここで検査する。
# パターンはプロジェクトの実態に合わせて追加・削除してよい(/harness-setup で拡張)。
#
# 注意: これは文字列パターンによるベストエフォートの防衛線であり、サンドボックスではない。
# 変数展開・bash -c・eval 等による迂回は原理的に防げない。本当の境界は
# permission mode と実行環境の隔離(devcontainer / リモート環境)が担う。
set -uo pipefail

cmd="$(jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

patterns=(
  # rm -rf 系でルート・ホーム全体を対象にするもの(/* と ~/* も含む)
  'rm[[:space:]]+-[^[:space:]]*r[^[:space:]]*[[:space:]]+(/|~/?)(\*)?([[:space:]]|$)'
  # force push(引数順を問わない。--force-with-lease は許可)
  'git[[:space:]]+push[[:space:]]+.*--force([[:space:]]|$)'
  'git[[:space:]]+push[[:space:]]+.*[[:space:]]-f([[:space:]]|$)'
  # force push の refspec 構文(git push origin +main)
  'git[[:space:]]+push[[:space:]]+[^[:space:]]+[[:space:]]+\+[^[:space:]]'
  # 履歴の書き換え(/commit コマンドの禁止事項をハーネスでも保証する)
  'git[[:space:]]+commit[[:space:]]+.*--amend'
  # パッケージ公開
  '(npm|pnpm|yarn)[[:space:]]+publish'
  # 破壊的 SQL(大文字表記のみ検査。誤検知時はパターンを調整する)
  'DROP[[:space:]]+(TABLE|DATABASE|SCHEMA)'
  'TRUNCATE[[:space:]]+TABLE'
)

for p in "${patterns[@]}"; do
  if printf '%s' "$cmd" | grep -qE "$p"; then
    echo "block-dangerous-cmds.sh: 危険パターン '$p' にマッチしたためブロックしました。本当に必要な操作なら、理由をユーザーに説明して承認を得てください。" >&2
    exit 2
  fi
done

exit 0
