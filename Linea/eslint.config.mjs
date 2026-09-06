import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  {
    files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' }
  },
  { files: ['scripts/afterPack.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  eslintConfigPrettier
)
