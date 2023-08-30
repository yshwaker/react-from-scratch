import { React$Element } from 'shared/ReactTypes'
import { mountChildFibers, reconcileChildFibers } from './childFibers'
import {
  FiberNode,
  OffscreenProps,
  createFiberFromFragment,
  createFiberFromOffscreen,
  createWorkInProgress,
} from './fiber'
import { pushProvider } from './fiberContext'
import { ChildDeletion, Placement, Ref } from './fiberFlags'
import { renderWithHooks } from './fiberHooks'
import { Lane } from './fiberLanes'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent,
} from './workTags'

// reconcile the children, return the child if possible
export function beginWork(wip: FiberNode, renderLane: Lane) {
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip, renderLane)
    case HostComponent:
      return updateHostComponent(wip)
    case HostText:
      // leaf node, no more children to update
      return null
    case FunctionComponent:
      return updateFunctionComponent(wip, renderLane)
    case Fragment:
      return updateFragment(wip)
    case ContextProvider:
      return updateContextProvider(wip)
    case SuspenseComponent:
      return updateSuspenseComponent(wip)
    case OffscreenComponent:
      return updateOffscreenComponent(wip)
    default:
      if (__DEV__) {
        console.error('fiber tag is not supported in beginwork')
      }
      break
  }

  return null
}

/*
                            ┌────────┐
                  ┌─────────┤Suspense│
                  │         └────────┘
                  │
                  │child
                  │
             ┌────▼────┐    sibling     ┌────────┐
             │Offscreen├────────────────►Fragment│
             └────┬────┘                └───┬────┘
       mode       │                         │
'visible'|'hidden'│                         │
                  │                         │
             ┌────▼───┐                 ┌───▼────┐
             │Children│                 │Fallback│
             └────────┘                 └────────┘
*/
function updateSuspenseComponent(wip: FiberNode) {
  const current = wip.alternate
  const nextProps = wip.pendingProps

  let showFallback = false
  let didSuspend = true
  if (didSuspend) {
    showFallback = true
  }

  const nextPrimaryChildren = nextProps.children
  const nextFallbackChildren = nextProps.fallback

  if (current === null) {
    // mount
    if (showFallback) {
      // suspense fallback
      return mountSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      )
    } else {
      // normal
      return mountSuspensePrimaryChildren(wip, nextPrimaryChildren)
    }
  } else {
    if (showFallback) {
      // suspense fallback
      return updateSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      )
    } else {
      // normal
      return updateSuspensePrimaryChildren(wip, nextPrimaryChildren)
    }
  }
}

function updateSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const current = wip.alternate as FiberNode
  const currentPrimaryChildFragment = current.child as FiberNode
  const currentFallbackChildFragment: FiberNode | null =
    currentPrimaryChildFragment.sibling

  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren,
  }

  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  )
  let fallbackChildFragment
  if (currentFallbackChildFragment !== null) {
    fallbackChildFragment = createWorkInProgress(
      currentFallbackChildFragment,
      fallbackChildren
    )
  } else {
    fallbackChildFragment = createFiberFromFragment(fallbackChildren, null)
    fallbackChildFragment.flags |= Placement
  }

  primaryChildFragment.return = wip
  fallbackChildFragment.return = wip
  primaryChildFragment.sibling = fallbackChildFragment
  wip.child = primaryChildFragment

  return fallbackChildFragment
}

function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const current = wip.alternate as FiberNode
  const currentPrimaryChildFragment = current.child as FiberNode
  const currentFallbackChildFragment: FiberNode | null =
    currentPrimaryChildFragment.sibling

  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren,
  }

  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  )

  primaryChildFragment.return = wip
  primaryChildFragment.sibling = null
  wip.child = primaryChildFragment

  if (currentFallbackChildFragment !== null) {
    const deletions = wip.deletions
    if (deletions === null) {
      wip.deletions = [currentFallbackChildFragment]
      wip.flags |= ChildDeletion
    } else {
      deletions.push(currentFallbackChildFragment)
    }
  }

  return primaryChildFragment
}

function mountSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren,
  }

  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps)
  const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null)

  // should mark here, since the fallback node can be flagged by `placeSingleChild`
  // fallback node needed to be mounted here so the shouldTrackEffects is false
  // and the parent node already exists
  fallbackChildFragment.flags |= Placement

  primaryChildFragment.return = wip
  fallbackChildFragment.return = wip
  primaryChildFragment.sibling = fallbackChildFragment
  wip.child = primaryChildFragment

  return fallbackChildFragment
}

function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren,
  }

  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps)

  primaryChildFragment.return = wip
  wip.child = primaryChildFragment

  return primaryChildFragment
}

function updateOffscreenComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps
  const nextChildren = nextProps.children

  reconcileChildren(wip, nextChildren)

  return wip.child
}

function updateContextProvider(wip: FiberNode) {
  const providerType = wip.type
  const context = providerType._context
  const nextProps = wip.pendingProps

  pushProvider(context, nextProps.value)

  const nextChildren = nextProps.children
  // nextChildren should be the return value of function component
  reconcileChildren(wip, nextChildren)

  return wip.child
}

function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps
  // nextChildren should be the return value of function component
  reconcileChildren(wip, nextChildren)

  return wip.child
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  const baseState = wip.memoizedState
  const updateQueue = wip.updateQueue as UpdateQueue<React$Element>
  const pending = updateQueue.shared.pending
  updateQueue.shared.pending = null

  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane)

  wip.memoizedState = memoizedState

  const nextChildren = wip.memoizedState
  reconcileChildren(wip, nextChildren)

  return wip.child
}

function updateHostComponent(wip: FiberNode) {
  // host components don't have updateQueue
  // it can only create child node from the `children` prop
  const { children: nextChildren } = wip.pendingProps
  markRef(wip.alternate, wip)
  reconcileChildren(wip, nextChildren)

  return wip.child
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
  const nextChildren = renderWithHooks(wip, renderLane)
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

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
  const ref = workInProgress.ref
  if (
    (current === null && ref !== null) ||
    (current !== null && current.ref !== ref)
  ) {
    workInProgress.flags |= Ref
  }
}
