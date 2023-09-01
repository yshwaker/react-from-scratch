import {
  Container,
  Instance,
  appendInitialChild,
  createInstance,
  createTextInstance,
} from 'hostConfig'
import { FiberNode } from './fiber'
import { popProvider } from './fiberContext'
import { NoFlags, Ref, Update, Visibility } from './fiberFlags'
import { popSuspenseHandler } from './suspenseContext'
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

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update
}

function markRef(fiber: FiberNode) {
  fiber.flags |= Ref
}

export function completeWork(wip: FiberNode) {
  const newProps = wip.pendingProps
  const current = wip.alternate

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // update
        // props changes?  yes: mark with update flags
        // TODO: compare props, save need-to-update props in update queue = [key1, value1, key2, value2, ...]
        markUpdate(wip)
        if (current.ref !== wip.ref) {
          markRef(wip)
        }
      } else {
        // mount
        // 1. build DOM node
        const instance = createInstance(wip.type, newProps)
        // 2. append DOM element to the DOM tree
        appendAllChildren(instance, wip)
        wip.stateNode = instance
        // 3. mark ref
        if (wip.ref !== null) {
          markRef(wip)
        }
      }
      bubbleProperties(wip)
      return null
    case HostText:
      if (current !== null && wip.stateNode) {
        // update
        const oldText = current.memoizedProps.content
        const newText = newProps.content
        if (oldText !== newText) {
          markUpdate(wip)
        }
      } else {
        // mount
        // 1. build DOM node
        const instance = createTextInstance(newProps.content)
        wip.stateNode = instance
      }
      bubbleProperties(wip)
      return null
    case HostRoot:
    case FunctionComponent:
    case Fragment:
    case OffscreenComponent:
      bubbleProperties(wip)
      return null
    case ContextProvider:
      const context = wip.type._context
      popProvider(context)
      bubbleProperties(wip)
      return null
    case SuspenseComponent:
      popSuspenseHandler()
      // we check the visibility of offscreenFiber here instead of in OffscreenComponent
      // because Suspense may return fallback node such that offscreenFiber doesn't trigger completeWork
      const offscreenFiber = wip.child as FiberNode
      const isHidden = offscreenFiber.pendingProps.mode === 'hidden'
      const currentOffscreenFiber = offscreenFiber.alternate
      if (currentOffscreenFiber !== null) {
        // update
        const wasHidden = currentOffscreenFiber.pendingProps.mode === 'hidden'
        if (isHidden !== wasHidden) {
          offscreenFiber.flags |= Visibility
          bubbleProperties(offscreenFiber)
        }
      } else if (isHidden) {
        // mount & hidden
        offscreenFiber.flags |= Visibility
        bubbleProperties(offscreenFiber)
      }

      bubbleProperties(wip)
      return null
    default:
      if (__DEV__) {
        console.warn('unknown fiber tag for completework', wip)
      }
      break
  }
}

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
  let node = wip.child

  while (node !== null) {
    // append the root host node of each child under the wip to parent
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node?.stateNode)
    } else if (node.child !== null) {
      // traverse down
      node.child.return = node
      node = node.child
      continue
    }

    if (node === wip) {
      return
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return
      }
      // traverse up
      node = node?.return
    }

    // traverse the siblings
    node.sibling.return = node.return
    node = node.sibling
  }
}

// carry all flags of its children with the node
function bubbleProperties(wip: FiberNode) {
  let subtreeFlags = NoFlags
  let child = wip.child

  while (child !== null) {
    subtreeFlags |= child.subtreeFlags
    subtreeFlags |= child.flags

    child.return = wip
    child = child.sibling
  }

  wip.subtreeFlags |= subtreeFlags
}
