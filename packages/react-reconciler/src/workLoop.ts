import { beginWork } from './beginWork'
import { commitMutationEffect } from './commitWork'
import { completeWork } from './completeWork'
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber'
import { MutationMask, NoFlags } from './fiberFlags'
import { HostRoot } from './workTags'

let workInProgress: FiberNode | null = null

export function scheduleUpdateOnFiber(fiber: FiberNode) {
  const root = markUpdateFromFiberToRoot(fiber)

  renderRoot(root)
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

function renderRoot(root: FiberRootNode) {
  // initialize
  prepareFreshStack(root)

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
  root.finishedWork = null

  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation
    // mutation
    commitMutationEffect(finishedWork)

    // swap current tree and wip tree
    root.current = finishedWork

    // layout
  }
  // else {
  // }
}

function prepareFreshStack(root: FiberRootNode) {
  workInProgress = createWorkInProgress(root.current, {})
}

function workloop() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress)
  }
}

function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber)
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
