import commonjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'
import path from 'path'
import ts from 'rollup-plugin-typescript2'

const pkgPath = path.resolve(__dirname, '../../packages')
const distPath = path.resolve(__dirname, '../../dist/node_modules')

export function resolvePkgPath(pkgName, isDist) {
  return `${isDist ? distPath : pkgPath}/${pkgName}`
}

export function getBasePlugins({
  alias = {
    __DEV__: true,
  },
  typescript = {},
} = {}) {
  return [replace(alias), commonjs(), ts(typescript)]
}
