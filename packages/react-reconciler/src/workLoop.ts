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
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes,
} from './fiberLanes'
import { HookHasEffect, Passive } from './hookEffectTags'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { HostRoot } from './workTags'

let workInProgress: FiberNode | null = null
let wipRootRenderLane: Lane = NoLane
let rootDoesHasPassiveEffect = false

type RootExitStatus = 1 | 2
const RootIncomplete = 1
const RootCompleted = 2
// TODO error in execution = 3

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateFromFiberToRoot(fiber)
  markRootUpdated(root, lane)
  ensureRootIsScheduled(root)
}

function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes)
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

function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

// find the fiberRootNode from the node down the fiber tree
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber
  let parent = fiber.return

  while (parent !== null) {
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

  const lane = getHighestPriorityLane(root.pendingLanes)
  const currCallbackNode = root.callbackNode
  if (lane === NoLane) {
    return null
  }

  const needSync = lane === SyncLane || didTimeout
  const exitStatus = renderRoot(root, lane, !needSync)

  ensureRootIsScheduled(root)

  if (exitStatus === RootIncomplete) {
    if (root.callbackNode !== currCallbackNode) {
      // have a higher priority callback schedule
      return null
    } else {
      // continue scheduling this work
      return performConcurrentWorkOnRoot.bind(null, root)
    }
  }
  if (exitStatus === RootCompleted) {
    // finished work is whole wip tree
    const finishedWork = root.current.alternate
    root.finishedWork = finishedWork
    root.finishedLane = lane
    wipRootRenderLane = NoLane

    commitRoot(root)
  } else if (__DEV__) {
    console.error('not implemented yet')
  }
}

function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes)
  // ensure `performSyncWorkOnRoot` run only once for sync lane
  if (nextLane !== SyncLane) {
    // lower priority
    // or no lane
    ensureRootIsScheduled(root)
    return
  }

  const exitStatus = renderRoot(root, nextLane, false)

  if (exitStatus === RootCompleted) {
    // finished work is whole wip tree
    const finishedWork = root.current.alternate
    root.finishedWork = finishedWork
    root.finishedLane = nextLane
    wipRootRenderLane = NoLane

    commitRoot(root)
  } else if (__DEV__) {
    console.error('not implemented yet')
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
      shouldTimeSlice ? workloopConcurrent() : workloopSync()
      break
    } catch (e) {
      if (__DEV__) {
        console.error('error in workloop', e)
      }
      workInProgress = null
    }
  } while (true)

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
