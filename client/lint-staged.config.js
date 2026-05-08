export default {
  'src/**/*.{ts,tsx}': [
    'prettier --write',
    'eslint --fix --max-warnings=0',
    () => 'tsc --noEmit'
  ]
}
