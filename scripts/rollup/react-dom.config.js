import alias from '@rollup/plugin-alias'
import generatePackageJson from 'rollup-plugin-generate-package-json'
import { getBasePlugins, getPackageJSON, resolvePkgPath } from './utils'

const { peerDependencies, name, module } = getPackageJSON('react-dom')
const pkgPath = resolvePkgPath(name)
const distPath = resolvePkgPath(name, true)

export default [
  // react-dom
  {
    input: `${pkgPath}/${module}`,
    output: [
      // old version for compatibility
      {
        name: 'ReactDOM',
        file: `${distPath}/index.js`,
        format: 'umd',
      },
      // react 18+
      {
        name: 'ReactDOMClient',
        file: `${distPath}/client.js`,
        format: 'umd',
      },
    ],
    // we don't want to bundle peer deps into the dist files
    external: [Object.keys(peerDependencies)],
    plugins: [
      ...getBasePlugins(),
      alias({
        entries: {
          hostConfig: '${pkgPath}/src/hostConfig.ts',
        },
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: distPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          main: 'index.js',
          peerDependencies: {
            react: version,
          },
        }),
      }),
    ],
  },
  // react-test-utils
  {
    input: `${pkgPath}/test-utils.ts`,
    output: [
      // old version for compatibility
      {
        name: 'testUtils',
        file: `${distPath}/test-utils.js`,
        format: 'umd',
      },
    ],
    external: ['react-dom', 'react'],
    plugins: getBasePlugins(),
  },
]
