import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from './src/currentDispatcher'

// * expose hooks from current dispatcher, like a proxy
export const useState: Dispatcher['useState'] = (initialState: any) => {
  const dispatcher = resolveDispatcher()
  return dispatcher.useState(initialState)
}

// internal data shared among packages
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
}

export const version = '0.0.0'

// TODO: createElement should be jsx or jsxDEV based on env
export { jsx as createElement, isValidElement } from './src/jsx'
