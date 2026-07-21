import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    // ゲームロジックは純粋なリデューサで DOM に依存しないため既定は node。
    // Svelte コンポーネントのテストを書く際は該当ファイルで環境を切り替える。
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.{ts,svelte.ts}',
      'tests/**/*.{test,spec}.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.steering/**',
        '**/*.config.{ts,js}',
        '**/types/**',
      ],
      // カバレッジ閾値はテスト資産が育ってから有効化する(/harness-setup 時に検討)。
      // プロジェクト初期に有効だと /check が常に赤になるため既定では無効。
      // thresholds: {
      //   branches: 80,
      //   functions: 80,
      //   lines: 80,
      //   statements: 80,
      // },
    },
  },
});
