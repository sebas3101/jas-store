import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Reglas de React Hooks (obligatorias para evitar bugs sutiles)
      ...reactHooks.configs.recommended.rules,
      // Validar que los componentes sean compatibles con HMR de Vite
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Permitir `any` explícito con comentario — ya hay usos controlados en el código
      '@typescript-eslint/no-explicit-any': 'warn',
      // Permitir variables no usadas con prefijo _ (convención del proyecto)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
