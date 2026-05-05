module.exports = {
  'src/**/*.{ts,tsx}': [
    'eslint --fix --max-warnings=0',
    () => 'tsc --noEmit' // Function syntax prevents file path injection
  ]
}
