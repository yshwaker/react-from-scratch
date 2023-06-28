import generatePackageJson from 'rollup-plugin-generate-package-json'
import { getBasePlugins, resolvePkgPath } from './utils'

const pkgPath = resolvePkgPath('react')
const distPath = resolvePkgPath('react', true)

export default [
  // react
  {
    input: `${pkgPath}/index.ts`,
    output: {
      name: 'React',
      file: `${distPath}/index.js`,
      format: 'umd',
    },
    plugins: [
      ...getBasePlugins(),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: distPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          main: 'index.js',
        }),
      }),
    ],
  },
  // jsx-runtime
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: {
      name: 'JSXRuntime',
      file: `${distPath}/jsx-runtime.js`,
      format: 'umd',
    },
    plugins: getBasePlugins(),
  },
  // jsx-dev-runtime
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: {
      name: 'JSXDEVRuntime',
      file: `${distPath}/jsx-dev-runtime.js`,
      format: 'umd',
    },
    plugins: getBasePlugins(),
  },
]
