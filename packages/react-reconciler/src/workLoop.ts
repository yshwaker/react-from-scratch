import { scheduleMicroTask } from 'hostConfig'
import {
  unstable_NormalPriority as NormalPriority,
  unstable_scheduleCallback as scheduleCallback,
  unstable_cancelCallback,
  unstable_shouldYield,
} from 'scheduler'
import { beginWork } from './beginWork'
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitLayoutEffects,
  commitMutationEffects,
} from './commitWork'
import { completeWork } from './completeWork'
import {
  FiberNode,
  FiberRootNode,
  PendingPassiveEffects,
  createWorkInProgress,
} from './fiber'
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags'
import { resetHooksOnUnwind } from './fiberHooks'
import {
  Lane,
  NoLane,
  SyncLane,
  getNextLane,
  lanesToSchedulerPriority,
  markRootFinished,
  markRootSuspended,
  mergeLanes,
} from './fiberLanes'
import { throwException } from './fiberThrow'
import { unwindWork } from './fiberUnwindWork'
import { HookHasEffect, Passive } from './hookEffectTags'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { SuspenseException, getSuspenseThenable } from './thenable'
import { HostRoot } from './workTags'

let workInProgress: FiberNode | null = null
let wipRootRenderLane: Lane = NoLane
let rootDoesHasPassiveEffect = false

type RootExitStatus =
  | typeof RootInProgress
  | typeof RootIncomplete
  | typeof RootCompleted
  | typeof RootDidNotComplete
const RootInProgress = 0
const RootIncomplete = 1 // interupted in concurrent mode
const RootCompleted = 2 // completed
const RootDidNotComplete = 3 // incomplete due to supension
let wipRootExitStatus: RootExitStatus = RootInProgress

type SuspendedReason = typeof NotSuspended | typeof SuspensedOnData
const NotSuspended = 0
const SuspensedOnData = 1

let workInProgressSuspendedReason: SuspendedReason = NotSuspended
let workInProgressThrownValue: any = null

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateLaneFromFiberToRoot(fiber, lane)
  markRootUpdated(root, lane)
  ensureRootIsScheduled(root)
}

export function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getNextLane(root)
  const existingCallback = root.callbackNode
  if (updateLane === NoLane) {
    if (existingCallback !== null) {
      unstable_cancelCallback(existingCallback)
    }
    root.callbackNode = null
    root.callbackPriority = NoLane
    return
  }

  const currPriority = updateLane
  const prevPriority = root.callbackPriority

  // there is no higher priority work
  if (currPriority === prevPriority) {
    return
  }

  if (existingCallback !== null) {
    unstable_cancelCallback(existingCallback)
  }

  let newCallbackNode = null

  if (__DEV__) {
    console.log(
      `${
        updateLane === SyncLane ? 'micro' : 'macro'
      } task scheduling, priority:`,
      updateLane
    )
  }

  if (updateLane === SyncLane) {
    // sync priority, use micro task
    // add to the queue
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
    // run all callbacks as micro task
    scheduleMicroTask(flushSyncCallbacks)
  } else {
    // concurrent mode: use macro task
    const schedulerPriority = lanesToSchedulerPriority(updateLane)
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      // @ts-ignore
      performConcurrentWorkOnRoot.bind(null, root)
    )
  }

  root.callbackNode = newCallbackNode
  root.callbackPriority = currPriority
}

export function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

// find the fiberRootNode from the node down the fiber tree
function markUpdateLaneFromFiberToRoot(fiber: FiberNode, lane: Lane) {
  let node = fiber
  let parent = fiber.return

  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane)
    const alternate = parent.alternate
    if (alternate != null) {
      alternate.childLanes = mergeLanes(alternate.childLanes, lane)
    }

    node = parent
    parent = parent.return
  }

  if (node.tag === HostRoot) {
    return node.stateNode
  }

  return null
}

function performConcurrentWorkOnRoot(
  root: FiberRootNode,
  didTimeout: boolean
): any {
  // make sure all useEffect callbacks are executed
  // because high priority work can be created during these execution
  const currCallback = root.callbackNode
  const didFlushPassiveEffect = flushPassiveEffect(root.pendingPassiveEffects)
  if (didFlushPassiveEffect) {
    if (root.callbackNode !== currCallback) {
      // useEffect callback create update with higher priority
      return null
    }
  }

  const lane = getNextLane(root)
  const currCallbackNode = root.callbackNode
  if (lane === NoLane) {
    return null
  }

  const needSync = lane === SyncLane || didTimeout
  const exitStatus = renderRoot(root, lane, !needSync)

  switch (exitStatus) {
    case RootIncomplete:
      if (root.callbackNode !== currCallbackNode) {
        // have a higher priority callback schedule
        return null
      } else {
        // continue scheduling this work
        return performConcurrentWorkOnRoot.bind(null, root)
      }
    case RootCompleted:
      // finished work is whole wip tree
      const finishedWork = root.current.alternate
      root.finishedWork = finishedWork
      root.finishedLane = lane
      wipRootRenderLane = NoLane

      commitRoot(root)
      break
    case RootDidNotComplete:
      wipRootRenderLane = NoLane
      markRootSuspended(root, lane)
      ensureRootIsScheduled(root)
      break
    default:
      if (__DEV__) {
        console.error('not implemented yet')
      }
      break
  }
}

function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getNextLane(root)
  // ensure `performSyncWorkOnRoot` run only once for sync lane
  if (nextLane !== SyncLane) {
    // lower priority
    // or no lane
    ensureRootIsScheduled(root)
    return
  }

  const exitStatus = renderRoot(root, nextLane, false)

  switch (exitStatus) {
    case RootCompleted:
      // finished work is whole wip tree
      const finishedWork = root.current.alternate
      root.finishedWork = finishedWork
      root.finishedLane = nextLane
      wipRootRenderLane = NoLane

      commitRoot(root)
      break
    case RootDidNotComplete:
      wipRootRenderLane = NoLane
      markRootSuspended(root, nextLane)
      ensureRootIsScheduled(root)
      break
    default:
      if (__DEV__) {
        console.error('not implemented yet')
      }
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(`start ${shouldTimeSlice ? 'concurrent' : 'sync'} update`)
  }

  if (wipRootRenderLane !== lane) {
    // if we have a high priority work, we will discard the previous work, and start from the root again
    // otherwise, we reuse the wip tree when current work is resumed.
    prepareFreshStack(root, lane)
  }

  // we need this loop here because we can retry in case of error
  do {
    try {
      if (
        workInProgressSuspendedReason !== NotSuspended &&
        workInProgress !== null
      ) {
        const thrownValue = workInProgressThrownValue
        workInProgressSuspendedReason = NotSuspended
        workInProgressThrownValue = null
        // unwind
        throwAndUnwindWorkloop(
          root,
          workInProgress as FiberNode,
          thrownValue,
          lane
        )
      }

      shouldTimeSlice ? workloopConcurrent() : workloopSync()
      break
    } catch (e) {
      if (__DEV__) {
        console.error('error in workloop', e)
      }
      handleThrow(root, e)
    }
  } while (true)

  if (wipRootExitStatus !== RootInProgress) {
    return wipRootExitStatus
  }

  // interrupted
  if (shouldTimeSlice && workInProgress !== null) {
    return RootIncomplete
  }
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error('wip is not null when render stage finished')
  }
  // TODO error handling

  // finished render stage
  return RootCompleted
}

function throwAndUnwindWorkloop(
  root: FiberRootNode,
  unitOfWork: FiberNode,
  thrownValue: any,
  lane: Lane
) {
  // reset globals
  resetHooksOnUnwind()
  // retrigger update after the request returns data
  throwException(root, thrownValue, lane)
  // unwind
  unwindUnitOfWork(unitOfWork)
}

function unwindUnitOfWork(unitOfWork: FiberNode) {
  let inCompleteWork: FiberNode | null = unitOfWork

  do {
    const next = unwindWork(inCompleteWork)
    if (next !== null) {
      workInProgress = next
      return
    }

    const returnFiber = inCompleteWork.return as FiberNode
    if (returnFiber !== null) {
      returnFiber.deletions = null
    }
    inCompleteWork = returnFiber
  } while (inCompleteWork !== null)

  //  can't find <Suspense>
  workInProgress = null
  wipRootExitStatus = RootDidNotComplete
}

function handleThrow(root: FiberRootNode, thrownValue: any) {
  // TODO Error boundary

  if (thrownValue === SuspenseException) {
    thrownValue = getSuspenseThenable()
    workInProgressSuspendedReason = SuspensedOnData
  }

  workInProgressThrownValue = thrownValue
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork
  if (finishedWork === null) {
    return null
  }

  if (__DEV__) {
    console.log('commit stage start', finishedWork)
  }
  const lane = root.finishedLane

  if (lane === NoLane && __DEV__) {
    console.error('commit stage: finishedLanes should not be NoLane')
  }

  // reset
  root.finishedWork = null
  root.finishedLane = NoLane

  markRootFinished(root, lane)

  if (
    (finishedWork.flags & PassiveMask) != NoFlags ||
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) {
    // call useEffect callback
    if (!rootDoesHasPassiveEffect) {
      rootDoesHasPassiveEffect = true

      // macro task scheduling
      scheduleCallback(NormalPriority, () => {
        flushPassiveEffect(root.pendingPassiveEffects)
        return
      })
    }
  }

  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags

  if (subtreeHasEffect || rootHasEffect) {
    // 1. beforeMutation
    // 2. mutation
    commitMutationEffects(finishedWork, root)

    // swap current tree and wip tree
    root.current = finishedWork

    // 3. layout
    commitLayoutEffects(finishedWork, root)
  } else {
    root.current = finishedWork
  }

  rootDoesHasPassiveEffect = false
  console.log('commit stage end, rescheduling')
  ensureRootIsScheduled(root)
}

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane
  root.finishedWork = null
  workInProgress = createWorkInProgress(root.current, {})
  wipRootRenderLane = lane
  wipRootExitStatus = RootInProgress
  workInProgressSuspendedReason = NotSuspended
  workInProgressThrownValue = null
}

function flushPassiveEffect(pendingPassiveEffects: PendingPassiveEffects) {
  let didFlushPassiveEffect = false
  // trigger all unmount effects
  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffect = true
    // useEffect unmount
    commitHookEffectListUnmount(Passive, effect)
  })
  pendingPassiveEffects.unmount = []

  // trigger all cleanup function of last update
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true
    commitHookEffectListDestroy(Passive | HookHasEffect, effect)
  })

  // * all destroy callback should be called before any create callback
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true
    commitHookEffectListCreate(Passive | HookHasEffect, effect)
  })
  pendingPassiveEffects.update = []
  // flush all sync callback created during passive effect callback invocation
  flushSyncCallbacks()

  return didFlushPassiveEffect
}

function workloopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress)
  }
}

function workloopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress)
  }
}

function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, wipRootRenderLane)
  fiber.memoizedProps = fiber.pendingProps

  if (next === null) {
    completeUnitOfWork(fiber)
  } else {
    workInProgress = next
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber

  do {
    completeWork(node)

    if (node.sibling !== null) {
      workInProgress = node.sibling
      return
    } else {
      node = node.return
      workInProgress = node
    }
  } while (node !== null)
}
