/**
 * react context can be nested, so the value of context are stored like a stack
 */
import { ReactContext } from 'shared/ReactTypes'

let prevContextValue: any = null
const prevContextValueStack: any[] = []

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
  prevContextValueStack.push(prevContextValue)
  prevContextValue = context._currentValue
  context._currentValue = newValue
}

export function popProvider<T>(context: ReactContext<T>) {
  context._currentValue = prevContextValue
  prevContextValue = prevContextValueStack.pop()
}
