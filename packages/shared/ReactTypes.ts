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

export type Usable<T> = Thenable<T> | ReactContext<T>

/**
 * untracked
 * pending
 * fulfilled
 * rejected
 */
export interface ThenableImp<T, Result, Err> {
  then(
    onFulfilled: (value: T) => Result,
    onRejected: (err: Err) => Result
  ): void | Wakeable<Result>
}

export interface Wakeable<Result> {
  then(
    onFulfilled: () => Result,
    onRejected: () => Result
  ): void | Wakeable<Result>
}

export interface UntrackedThenable<T, Result, Err>
  extends ThenableImp<T, Result, Err> {
  status?: void
}

export interface PendingThenable<T, Result, Err>
  extends ThenableImp<T, Result, Err> {
  status: 'pending'
}

export interface FulfilledThenable<T, Result, Err>
  extends ThenableImp<T, Result, Err> {
  status: 'fulfilled'
  value: T
}

export interface RejectedThenable<T, Result, Err>
  extends ThenableImp<T, Result, Err> {
  status: 'rejected'
  reason: Err
}

export type Thenable<T, Result = void, Err = any> =
  | UntrackedThenable<T, Result, Err>
  | PendingThenable<T, Result, Err>
  | FulfilledThenable<T, Result, Err>
  | RejectedThenable<T, Result, Err>
