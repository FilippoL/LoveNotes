module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  root: true,
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
  },
};

