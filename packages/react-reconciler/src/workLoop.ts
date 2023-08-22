import { scheduleMicroTask } from 'hostConfig'
import {
  unstable_NormalPriority as NormalPriority,
  unstable_scheduleCallback as scheduleCallback,
} from 'scheduler'
import { beginWork } from './beginWork'
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitMutationEffect,
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
  markRootFinished,
  mergeLanes,
} from './fiberLanes'
import { HookHasEffect, Passive } from './hookEffectTags'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { HostRoot } from './workTags'
let workInProgress: FiberNode | null = null
let wipRootRenderLane: Lane = NoLane
let rootDoesHasPassiveEffect = false

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateFromFiberToRoot(fiber)
  markRootUpdated(root, lane)
  ensureRootIsScheduled(root)
}

function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes)
  if (updateLane === NoLane) {
    return
  }
  if (updateLane === SyncLane) {
    // sync priority, use micro task
    if (__DEV__) {
      console.log('micro task scheduling, priority:', updateLane)
    }
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
    scheduleMicroTask(flushSyncCallbacks)
  } else {
    // use macro task
  }
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

function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  const nextLane = getHighestPriorityLane(root.pendingLanes)
  // ensure `performSyncWorkOnRoot` run only once for sync lane
  if (nextLane !== lane) {
    // lower priority(no sync priority)
    // or no lane
    ensureRootIsScheduled(root)
    return
  }

  if (__DEV__) {
    console.warn('render stage started')
  }
  // initialize
  prepareFreshStack(root, lane)

  do {
    try {
      workloop()
      break
    } catch (e) {
      if (__DEV__) {
        console.error('error in workloop')
      }
      workInProgress = null
    }
  } while (true)

  // finished work is whole wip tree
  const finishedWork = root.current.alternate
  root.finishedWork = finishedWork
  root.finishedLane = lane
  wipRootRenderLane = NoLane

  commitRoot(root)
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
    // beforeMutation
    // mutation
    commitMutationEffect(finishedWork, root)

    // swap current tree and wip tree
    root.current = finishedWork

    // layout
  } else {
    root.current = finishedWork
  }

  rootDoesHasPassiveEffect = false
  ensureRootIsScheduled(root)
}

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  workInProgress = createWorkInProgress(root.current, {})
  wipRootRenderLane = lane
}

function flushPassiveEffect(pendingPassiveEffects: PendingPassiveEffects) {
  // trigger all unmount effects
  pendingPassiveEffects.unmount.forEach((effect) => {
    // useEffect unmount
    commitHookEffectListUnmount(Passive, effect)
  })
  pendingPassiveEffects.unmount = []

  // trigger all cleanup function of last update
  pendingPassiveEffects.update.forEach((effect) => {
    commitHookEffectListDestroy(Passive | HookHasEffect, effect)
  })

  // * all destroy callback should be called before any create callback
  pendingPassiveEffects.update.forEach((effect) => {
    commitHookEffectListCreate(Passive | HookHasEffect, effect)
  })
  pendingPassiveEffects.update = []
  // flush all sync callback created during passive effect callback invocation
  flushSyncCallbacks()
}

function workloop() {
  while (workInProgress !== null) {
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
