import { Action } from 'shared/ReactTypes'

export interface Dispatcher {
  useState: <T>(initialState: () => T | T) => [T, Dispatch<T>]
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