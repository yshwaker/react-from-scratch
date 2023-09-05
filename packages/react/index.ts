import { Usable } from 'shared/ReactTypes'
import currentBatchConfig from './src/currentBatchConfig'
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from './src/currentDispatcher'
import { HookDeps } from 'react-reconciler/src/fiberHooks'
export {
  REACT_FRAGMENT_TYPE as Fragment,
  REACT_SUSPENSE_TYPE as Suspense,
} from 'shared/ReactSymbols'
export { createContext } from './src/context'
export { memo } from './src/memo'

// * expose hooks from current dispatcher, like a proxy
export const useState: Dispatcher['useState'] = (initialState: any) => {
  const dispatcher = resolveDispatcher()
  return dispatcher.useState(initialState)
}

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
  const dispatcher = resolveDispatcher()
  return dispatcher.useEffect(create, deps)
}

export const useTransition: Dispatcher['useTransition'] = () => {
  const dispatcher = resolveDispatcher()
  return dispatcher.useTransition()
}

export const useRef: Dispatcher['useRef'] = (initialValue) => {
  const dispatcher = resolveDispatcher()
  return dispatcher.useRef(initialValue)
}

export const useContext: Dispatcher['useContext'] = (context) => {
  const dispatcher = resolveDispatcher()
  return dispatcher.useContext(context)
}

export const use: Dispatcher['use'] = <T>(usable: Usable<T>) => {
  const dispatcher = resolveDispatcher()
  return dispatcher.use(usable)
}

export const useCallback: Dispatcher['useCallback'] = <T>(
  callback: T,
  deps: HookDeps
) => {
  const dispatcher = resolveDispatcher()
  return dispatcher.useCallback(callback, deps)
}

export const useMemo: Dispatcher['useMemo'] = <T>(
  nextCreate: () => T,
  deps: HookDeps
) => {
  const dispatcher = resolveDispatcher()
  return dispatcher.useMemo(nextCreate, deps)
}

// internal data shared among packages
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
  currentBatchConfig,
}

export const version = '0.0.0'

// TODO: createElement should be jsx or jsxDEV based on env
export { jsx as createElement, isValidElement } from './src/jsx'
