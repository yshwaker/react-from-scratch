import { React$Element } from 'shared/ReactTypes'
import { mountChildFibers, reconcileChildFibers } from './childFibers'
import { FiberNode } from './fiber'
import { renderWithHooks } from './fiberHooks'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from './workTags'

// reconcile the children, return the child if possible
export function beginWork(wip: FiberNode) {
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip)
    case HostComponent:
      return updateHostComponent(wip)
    case HostText:
      // leaf node, no more children to update
      return null
    case FunctionComponent:
      return updateFunctionComponent(wip)
    default:
      if (__DEV__) {
        console.error('fiber tag is not supported in beginwork')
      }
      break
  }

  return null
}

function updateHostRoot(wip: FiberNode) {
  const baseState = wip.memoizedState
  const updateQueue = wip.updateQueue as UpdateQueue<React$Element>
  const pending = updateQueue.shared.pending
  updateQueue.shared.pending = null

  const { memoizedState } = processUpdateQueue(baseState, pending)

  wip.memoizedState = memoizedState

  const nextChildren = wip.memoizedState
  reconcileChildren(wip, nextChildren)

  return wip.child
}

function updateHostComponent(wip: FiberNode) {
  // host components don't have updateQueue
  // it can only create child node from the `children` prop
  const { children: nextChildren } = wip.pendingProps
  reconcileChildren(wip, nextChildren)

  return wip.child
}

function updateFunctionComponent(wip: FiberNode) {
  const nextChildren = renderWithHooks(wip)
  // nextChildren should be the return value of function component
  reconcileChildren(wip, nextChildren)

  return wip.child
}

// <A>
//   <B/>
// </A>
// when working on A, we compare the current fiber node of B and the latest react element of B
// then create wip fiber node of B with flags
function reconcileChildren(wip: FiberNode, children?: React$Element) {
  const current = wip.alternate

  if (current === null) {
    // if this a new component, it doesn't have its corresponding `current` fiber node.
    // in this case, we won't track side effect(PLACEMENT) for each of its descendents.
    // instead, we add them all to the `child`, and let them get rendered in one pass, which
    // will reduce the times of rendering.
    wip.child = mountChildFibers(wip, null, children)
  } else {
    wip.child = reconcileChildFibers(wip, current.child, children)
  }
}
