import { Dispatch, Dispatcher } from 'react/src/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import internals from 'shared/internals'
import { FiberNode } from './fiber'
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
} from './updateQueue'
import { scheduleUpdateOnFiber } from './workLoop'

let currentlyRenderingFiber: FiberNode | null = null
let workInProgressHook: Hook | null = null

const { currentDispatcher } = internals

interface Hook {
  memoizedState: any
  updateQueue: unknown
  next: Hook | null
}

// render function component with hooks
export function renderWithHooks(wip: FiberNode) {
  currentlyRenderingFiber = wip
  wip.memoizedState = null

  const current = wip.alternate

  if (current !== null) {
    // update
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount
  }

  const Component = wip.type
  const props = wip.pendingProps
  const children = Component(props)

  currentlyRenderingFiber = null

  return children
}

// ========
// Hooks implementation
// ========
const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
}

function mountState<State>(
  initialState: () => State | State
): [State, Dispatch<State>] {
  const hook = mountWorkInProgressHook()

  const memoizedState =
    initialState instanceof Function ? initialState() : initialState
  const updateQueue = createUpdateQueue<State>()
  hook.updateQueue = updateQueue
  hook.memoizedState = memoizedState

  const dispatch = dispatchSetState.bind(
    null,
    // @ts-ignore
    currentlyRenderingFiber,
    updateQueue
  )
  updateQueue.dispatch = dispatch

  return [memoizedState, dispatch]
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const update = createUpdate(action)
  enqueueUpdate(updateQueue, update)
  scheduleUpdateOnFiber(fiber)
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null,
  }

  if (workInProgressHook === null) {
    // first hook on mount

    if (currentlyRenderingFiber === null) {
      throw new Error(
        'hooks can only be used in the context of function component'
      )
    } else {
      workInProgressHook = hook
      currentlyRenderingFiber.memoizedState = workInProgressHook
    }
  } else {
    // following hooks on mount
    workInProgressHook.next = hook
    workInProgressHook = hook
  }

  return workInProgressHook
}
