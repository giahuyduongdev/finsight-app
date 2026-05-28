module.exports = {
  // Format all supported file types
  '**/*.{ts,tsx,js,json,md}': ['prettier --write'],

  // Lint and type-check TypeScript files only
  'src/**/*.{ts,tsx}': [
    'eslint --fix --max-warnings=0',
    () => 'tsc --noEmit' // Function syntax prevents file path injection
  ]
}
