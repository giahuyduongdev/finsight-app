export default {
  // Format all supported file types
  '**/*.{ts,tsx,js,jsx,json,css,md}': ['prettier --write'],

  // Lint and type-check TypeScript/React files only
  'src/**/*.{ts,tsx}': ['eslint --fix --max-warnings=0', () => 'tsc --noEmit']
}
