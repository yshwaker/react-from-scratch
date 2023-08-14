import { Dispatch, Dispatcher } from 'react/src/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import internals from 'shared/internals'
import { FiberNode } from './fiber'
import { Flags, PassiveEffect } from './fiberFlags'
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes'
import { HookHasEffect, Passive } from './hookEffectTags'
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

type EffectCallback = () => void
type EffectDeps = any[] | null

export interface Effect {
  tag: Flags
  create: EffectCallback | void
  destroy: EffectCallback | void
  deps: EffectDeps
  next: Effect | null // all effects in a fiber is connected as a loop linked list, so we can ignore the hooks of other types
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null
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
  useEffect: mountEffect,
}

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = mountWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  ;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect // on mount, the callback need to be invoked

  hook.memoizedState = pushEffect(
    Passive | HookHasEffect,
    create,
    undefined, // on mount, the callback is not invoked yet, so we don't have the destroy callback yet
    nextDeps
  )
}

function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null,
  }

  const fiber = currentlyRenderingFiber as FiberNode
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>
  if (updateQueue === null) {
    const updateQueue = createFCUpdateQueue()
    fiber.updateQueue = updateQueue
    effect.next = effect
    updateQueue.lastEffect = effect
  } else {
    const lastEffect = updateQueue.lastEffect
    if (lastEffect === null) {
      effect.next = effect
      updateQueue.lastEffect = effect
    } else {
      const firstEffect = lastEffect.next
      lastEffect.next = effect
      effect.next = firstEffect
      updateQueue.lastEffect = effect
    }
  }
  return effect
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>
  updateQueue.lastEffect = null
  return updateQueue
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
