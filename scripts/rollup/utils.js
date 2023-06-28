import commonjs from '@rollup/plugin-commonjs'
import path from 'path'
import ts from 'rollup-plugin-typescript2'

const pkgPath = path.resolve(__dirname, '../../packages')
const distPath = path.resolve(__dirname, '../../dist/node_modules')

export function resolvePkgPath(pkgName, isDist) {
  return `${isDist ? distPath : pkgPath}/${pkgName}`
}

export function getBasePlugins({ typescript = {} } = {}) {
  return [commonjs(), ts(typescript)]
}
