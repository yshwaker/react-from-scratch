const { defaults } = require('jest-config')

module.exports = {
  ...defaults,
  rootDir: process.cwd(),
  modulePathIgnorePatterns: ['<rootDir>/.history'],
  moduleDirectories: [
    // resolve react, react-dom from
    'dist/node_modules',
    // 对于第三方依赖
    ...defaults.moduleDirectories,
  ],
  testEnvironment: 'jsdom',
}
