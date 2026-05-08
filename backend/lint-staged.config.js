module.exports = {
  'src/**/*.{ts,tsx}': [
    'prettier --write',
    'eslint --fix --max-warnings=0',
    () => 'tsc --noEmit' // Function syntax prevents file path injection
  ]
}
