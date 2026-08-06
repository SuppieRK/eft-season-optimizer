export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['coverage/**', 'dist/**'],
  rules: { 'no-descending-specificity': null },
};
