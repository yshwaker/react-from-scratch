import currentBatchConfig from 'react/src/currentBatchConfig'
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher'
import { REACT_CONTEXT_TYPE } from 'shared/ReactSymbols'
import { Action, ReactContext, Thenable, Usable } from 'shared/ReactTypes'
import internals from 'shared/internals'
import { FiberNode } from './fiber'
import { Flags, PassiveEffect } from './fiberFlags'
import {
  Lane,
  NoLane,
  mergeLanes,
  removeLanes,
  requestUpdateLanes,
} from './fiberLanes'
import { HookHasEffect, Passive } from './hookEffectTags'
import { trackUsedThenable } from './thenable'
import {
  Update,
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
} from './updateQueue'
import { scheduleUpdateOnFiber } from './workLoop'
import { markWorkInProgressReceivedUpdate } from './beginWork'

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
  useTransition: mountTransition,
  useRef: mountRef,
  useContext: readContext,
  use,
}

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
  useTransition: updateTransition,
  useRef: updateRef,
  useContext: readContext,
  use,
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
    // saved in current
    current.baseQueue = pending
    queue.shared.pending = null
  }

  if (baseQueue !== null) {
    const prevState = hook.memoizedState
    const {
      memoizedState,
      baseQueue: newBaseQueue,
      baseState: newBaseState,
    } = processUpdateQueue(baseState, baseQueue, renderLane, (update) => {
      const skippedLane = update.lane
      const fiber = currentlyRenderingFiber as FiberNode
      // add back the lane of skipped update when the update is skipped
      fiber.lanes = mergeLanes(fiber.lanes, skippedLane)
    })

    if (!Object.is(prevState, memoizedState)) {
      markWorkInProgressReceivedUpdate()
    }

    hook.memoizedState = memoizedState
    hook.baseState = newBaseState
    hook.baseQueue = newBaseQueue
  }

  return [hook.memoizedState, queue.dispatch as Dispatch<State>]
}

function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  const hook = mountWorkInProgressHook()

  const memoizedState =
    initialState instanceof Function ? initialState() : initialState
  const updateQueue = createUpdateQueue<State>()
  hook.updateQueue = updateQueue
  hook.memoizedState = memoizedState
  hook.baseState = memoizedState

  const dispatch = dispatchSetState.bind(
    null,
    // @ts-ignore
    currentlyRenderingFiber,
    updateQueue
  )
  updateQueue.dispatch = dispatch

  return [memoizedState, dispatch]
}

function mountTransition(): [boolean, (callback: () => void) => void] {
  const [isPending, setPending] = mountState(false)
  const hook = mountWorkInProgressHook()
  const start = startTransition.bind(null, setPending)
  hook.memoizedState = start

  return [isPending, start]
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
  setPending(true) // sync update

  const prevTransition = currentBatchConfig.transition
  currentBatchConfig.transition = 1 // tell requestUpdateLanes() to return TransitionLane(concurrent mode)

  callback()
  setPending(false)

  currentBatchConfig.transition = prevTransition // reset lane priority
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  const [isPending] = updateState<boolean>()
  const hook = updateWorkInProgressHook()
  const start = hook.memoizedState

  return [isPending, start]
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLanes()
  const update = createUpdate(action, lane)
  enqueueUpdate(updateQueue, update, fiber, lane)
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

function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInProgressHook()
  const ref = { current: initialValue }
  hook.memoizedState = ref
  return ref
}

function updateRef<T>(initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook()
  return hook.memoizedState
}

// observe that the useContext doesn't use `mountWorkInProgressHook`
// thus, this hook doesn't have the limit other hooks have. it can be
// used inside conditional statement.
function readContext<T>(context: ReactContext<T>): T {
  const consumer = currentlyRenderingFiber
  if (consumer === null) {
    throw new Error(
      'hooks can only be used in the context of function component'
    )
  }
  const value = context._currentValue
  return value
}

function use<T>(usable: Usable<T>): T {
  if (usable !== null && typeof usable === 'object') {
    if (typeof (usable as Thenable<T>).then === 'function') {
      // thenable
      const thenable = usable as Thenable<T>
      return trackUsedThenable(thenable)
    } else if ((usable as ReactContext<T>).$$typeof === REACT_CONTEXT_TYPE) {
      // context
      const context = usable as ReactContext<T>
      return readContext(context)
    }
  }

  throw new Error('use() unsupported type: ' + usable)
}

export function resetHooksOnUnwind() {
  currentlyRenderingFiber = null
  currentHook = null
  workInProgressHook = null
}

export function bailoutHook(wip: FiberNode, renderLane: Lane) {
  const current = wip.alternate as FiberNode
  wip.updateQueue = current.updateQueue
  wip.flags &= ~PassiveEffect

  current.lanes = removeLanes(current.lanes, renderLane)
}
