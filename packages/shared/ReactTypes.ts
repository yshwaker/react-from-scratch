export type Key = any
export type Ref =
  | {
      current: any
    }
  | ((instance: any) => void)
export type Props = any
export type ElementType = any

export interface React$Element {
  $$typeof: symbol | number
  type: ElementType
  key: Key
  ref: Ref
  props: Props
  __mark: string
}

export type Action<State> = State | ((prevState: State) => State)

export type ReactContext<T> = {
  $$typeof: symbol | number
  Provider: ReactProviderType<T> | null
  _currentValue: T // the state of the context
}

export type ReactProviderType<T> = {
  $$typeof: symbol | number
  _context: ReactContext<T> | null
}
