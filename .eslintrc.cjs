module.exports = {
  root: true,
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json']
  },
  extends: ['next/core-web-vitals', 'plugin:testing-library/react', 'prettier'],
  rules: {
    'testing-library/no-node-access': 'warn',
    'testing-library/no-container': 'warn'
  }
};
