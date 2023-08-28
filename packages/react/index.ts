import currentBatchConfig from './src/currentBatchConfig'
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from './src/currentDispatcher'

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

// internal data shared among packages
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
  currentBatchConfig,
}

export const version = '0.0.0'

// TODO: createElement should be jsx or jsxDEV based on env
export { jsx as createElement, isValidElement } from './src/jsx'
