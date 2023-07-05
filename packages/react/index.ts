import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from './src/currentDispatcher'
import { jsxDEV } from './src/jsx'

// * expose hooks from current dispatcher, like a proxy
export const useState: Dispatcher['useState'] = (initialState: any) => {
  const dispatcher = resolveDispatcher()
  return dispatcher.useState(initialState)
}

// internal data shared among packages
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
}

export default {
  version: '0.0.0',
  createElement: jsxDEV,
}
