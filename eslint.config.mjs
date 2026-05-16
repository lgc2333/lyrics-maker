import antfu from '@antfu/eslint-config'
import prettier from 'eslint-config-prettier'

// import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss'
// import eslintParserVue from 'vue-eslint-parser'

export default antfu(
  {},
  // disable temporarily because this is slowing down eslint
  // {
  //   extends: [eslintPluginBetterTailwindcss.configs.recommended],
  //   settings: { 'better-tailwindcss': { entryPoint: 'src/style.css' } },
  //   files: ['**/*.vue'],
  //   languageOptions: { parser: eslintParserVue },
  //   rules: {
  //     'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
  //     'better-tailwindcss/enforce-canonical-classes': 'warn',
  //     'better-tailwindcss/enforce-shorthand-classes': 'off',
  //     'better-tailwindcss/enforce-consistent-important-position': 'off',
  //     'better-tailwindcss/no-unknown-classes': 'off',
  //     'better-tailwindcss/enforce-consistent-variable-syntax': 'off',
  //   },
  // },
  prettier,
  {
    rules: {
      'antfu/if-newline': 'off',
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'ts/no-redeclare': ['error', { ignoreDeclarationMerge: true }],
      'vue/v-on-event-hyphenation': 'off',
    },
  },
)
