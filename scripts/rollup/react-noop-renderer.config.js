import alias from '@rollup/plugin-alias'
import generatePackageJson from 'rollup-plugin-generate-package-json'
import { getBasePlugins, getPackageJSON, resolvePkgPath } from './utils'

const { peerDependencies, name, module } = getPackageJSON('react-noop-renderer')
const pkgPath = resolvePkgPath(name)
const distPath = resolvePkgPath(name, true)

export default [
  // react-noop-renderer
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        name: 'ReactNoopRenderer',
        file: `${distPath}/index.js`,
        format: 'umd',
      },
    ],
    // we don't want to bundle peer deps into the dist files
    external: [Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...getBasePlugins({
        typescript: {
          exclude: ['./packages/react-dom/**/*'],
          tsconfigOverride: {
            compilerOption: {
              paths: {
                hostConfig: [`./${name}/src/hostConfig.ts`],
              },
            },
          },
        },
      }),
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`,
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
