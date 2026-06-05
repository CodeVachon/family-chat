/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  tabWidth: 4,
  useTabs: false,
  singleQuote: false,
  semi: true,
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  trailingComma: "none",
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "packages/ui/src/styles/globals.css",
  tailwindFunctions: ["cn", "cva"],
  overrides: [
    {
      files: "*.json",
      options: {
        tabWidth: 2,
      },
    },
    {
      files: "*.yml",
      options: {
        tabWidth: 2,
      },
    },
    {
      files: "*.sql",
      options: {
        newlineBeforeSemicolon: true,
      },
    },
  ],
}
