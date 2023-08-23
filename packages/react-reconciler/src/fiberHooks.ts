import { Dispatch, Dispatcher } from 'react/src/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import internals from 'shared/internals'
import { FiberNode } from './fiber'
import { Flags, PassiveEffect } from './fiberFlags'
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes'
import { HookHasEffect, Passive } from './hookEffectTags'
import {
  Update,
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
  baseState: any
  baseQueue: Update<any> | null
}

type EffectCallback = () => void
type EffectDeps = any[] | null

export interface Effect {
  tag: Flags
  create: EffectCallback | void
  destroy: EffectCallback | void
  deps: EffectDeps
  next: Effect | null // all effects in a fiber is connected as a circular linked list, so we can ignore the hooks of other types
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null
}

// render function component with hooks
export function renderWithHooks(wip: FiberNode, lane: Lane) {
  currentlyRenderingFiber = wip
  // reset hooks linked list
  wip.memoizedState = null
  // reset effect linked list
  wip.updateQueue = null
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
  useEffect: updateEffect,
}

function mountEffect(create?: EffectCallback, deps?: EffectDeps) {
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

function updateEffect(create?: EffectCallback, deps?: EffectDeps) {
  const hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  let destroy: EffectCallback

  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState as Effect
    destroy = prevEffect.destroy as EffectCallback

    const prevDeps = prevEffect.deps
    // shallow compare
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps)
      return
    }

    // shallow compare: unequal
    ;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect
    hook.memoizedState = pushEffect(
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    )
  }
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
  if (prevDeps === null || nextDeps === null) {
    return false
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue
    }
    return false
  }
  return true
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
  const baseState = hook.baseState
  // pending update enqueued previously by calling dispatch function
  const pending = queue.shared.pending
  const current = currentHook as Hook
  let baseQueue = current.baseQueue

  if (pending !== null) {
    // save pending update and baseQueue into current tree
    // so that we can restart after interrupted by higher priority update
    if (baseQueue !== null) {
      // join baseQueue and pending queue
      const baseFirst = baseQueue.next
      const pendingFirst = pending.next
      baseQueue.next = pendingFirst
      pending.next = baseFirst
    }
    baseQueue = pending
    current.baseQueue = pending
    queue.shared.pending = null

    if (baseQueue !== null) {
      const {
        memoizedState,
        baseQueue: newBaseQueue,
        baseState: newBaseState,
      } = processUpdateQueue(baseState, baseQueue, renderLane)
      hook.memoizedState = memoizedState
      hook.baseState = newBaseState
      hook.baseQueue = newBaseQueue
    }
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
    baseQueue: null,
    baseState: null,
  }

  if (workInProgressHook === null) {
    // this is the first hook on mount
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

  // clone
  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null,
    baseQueue: currentHook.baseQueue,
    baseState: currentHook.baseState,
  }

  if (workInProgressHook === null) {
    // first hook

    if (currentlyRenderingFiber === null) {
      throw new Error(
        'hooks can only be used in the context of function component'
      )
    } else {
      workInProgressHook = newHook
      currentlyRenderingFiber.memoizedState = workInProgressHook
    }
  } else {
    // following hooks
    workInProgressHook.next = newHook
    workInProgressHook = newHook
  }

  return workInProgressHook
}
