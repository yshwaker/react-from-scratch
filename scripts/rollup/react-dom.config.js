import alias from '@rollup/plugin-alias'
import generatePackageJson from 'rollup-plugin-generate-package-json'
import { getBasePlugins, resolvePkgPath } from './utils'

const pkgPath = resolvePkgPath('react-dom')
const distPath = resolvePkgPath('react-dom', true)

export default [
  // react-dom
  {
    input: `${pkgPath}/index.ts`,
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
]
