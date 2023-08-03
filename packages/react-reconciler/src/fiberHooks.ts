import { Dispatch, Dispatcher } from 'react/src/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import internals from 'shared/internals'
import { FiberNode } from './fiber'
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes'
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
} from './updateQueue'
import { scheduleUpdateOnFiber } from './workLoop'

let currentlyRenderingFiber: FiberNode | null = null
let workInProgressHook: Hook | null = null // trace the Hook in wip fiber node's hook list
let currentHook: Hook | null = null // trace the Hook in `current` fiber node's hook list
let renderLane: Lane = NoLane

const { currentDispatcher } = internals

interface Hook {
  memoizedState: any
  updateQueue: unknown
  next: Hook | null
}

// render function component with hooks
export function renderWithHooks(wip: FiberNode, lane: Lane) {
  currentlyRenderingFiber = wip
  wip.memoizedState = null
  renderLane = lane

  const current = wip.alternate

  if (current !== null) {
    // update
    currentDispatcher.current = HooksDispatcherOnUpdate
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount
  }

  const Component = wip.type
  const props = wip.pendingProps
  const children = Component(props)

  // reset after rendering
  currentlyRenderingFiber = null
  workInProgressHook = null
  currentHook = null
  renderLane = NoLane

  return children
}

// ========
// Hooks implementation
// ========
const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
}

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
}

function updateState<State>(): [State, Dispatch<State>] {
  // get hook data of current useState
  const hook = updateWorkInProgressHook()

  // new state
  const queue = hook.updateQueue as UpdateQueue<State>
  // pending update enqueued previously by calling dispatch function
  const pending = queue.shared.pending
  queue.shared.pending = null

  if (pending !== null) {
    const { memoizedState } = processUpdateQueue(
      hook.memoizedState,
      pending,
      renderLane
    )
    hook.memoizedState = memoizedState
  }

  return [hook.memoizedState, queue.dispatch as Dispatch<State>]
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
  const lane = requestUpdateLanes()
  const update = createUpdate(action, lane)
  enqueueUpdate(updateQueue, update)
  scheduleUpdateOnFiber(fiber, lane)
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

function updateWorkInProgressHook(): Hook {
  // TODO update during rendering, e.g. directly invoke dispatch() in function component
  let nextCurrentHook: Hook | null = null

  if (currentHook === null) {
    // first hook on FC update
    if (currentlyRenderingFiber === null) {
      throw new Error(
        'hooks can only be used in the context of function component'
      )
    } else {
      const currentFiber = currentlyRenderingFiber.alternate
      if (currentFiber !== null) {
        nextCurrentHook = currentFiber.memoizedState
      } else {
        nextCurrentHook = null
      }
    }
  } else {
    // following hook on FC update
    nextCurrentHook = currentHook.next
  }

  if (nextCurrentHook === null) {
    // curr: h1, h2
    // wip:  h1, h2, h3..
    throw new Error('Rendered more hooks than during the previous render.')
  } else {
    currentHook = nextCurrentHook
  }

  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null,
  }

  if (workInProgressHook === null) {
    // first hook on mount

    if (currentlyRenderingFiber === null) {
      throw new Error(
        'hooks can only be used in the context of function component'
      )
    } else {
      workInProgressHook = newHook
      currentlyRenderingFiber.memoizedState = workInProgressHook
    }
  } else {
    // following hooks on mount
    workInProgressHook.next = newHook
    workInProgressHook = newHook
  }

  return workInProgressHook
}
