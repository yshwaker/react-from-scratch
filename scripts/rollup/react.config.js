import generatePackageJson from 'rollup-plugin-generate-package-json'
import { getBasePlugins, getPackageJSON, resolvePkgPath } from './utils'

const { name, module } = getPackageJSON('react')
const pkgPath = resolvePkgPath(name)
const distPath = resolvePkgPath(name, true)

export default [
  // react
  {
    input: `${pkgPath}/${module}`,
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
