import { Action, ReactContext, Usable } from 'shared/ReactTypes'

export interface Dispatcher {
  useState: <T>(initialState: () => T | T) => [T, Dispatch<T>]
  useEffect: (callback: () => void, deps?: any[]) => void
  useTransition: () => [boolean, (callback: () => void) => void]
  useRef: <T>(initialValue: T) => { current: T }
  useContext: <T>(context: ReactContext<T>) => T
  use: <T>(usable: Usable<T>) => T
}

export type Dispatch<State> = (action: Action<State>) => void

const currentDispatcher: { current: Dispatcher | null } = {
  current: null,
}

export function resolveDispatcher(): Dispatcher {
  const dispatcher = currentDispatcher.current

  if (dispatcher === null) {
    throw new Error(
      'hooks can only be used in the context of function component'
    )
  }

  return dispatcher
}

export default currentDispatcher
