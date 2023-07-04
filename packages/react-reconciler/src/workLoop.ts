import { beginWork } from './beginWork'
import { completeWork } from './completeWork'
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber'
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
      console.error('error in workloop')
      workInProgress = null
    }
  } while (true)
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
