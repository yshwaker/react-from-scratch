import {
  Container,
  appendInitialChild,
  createInstance,
  createTextInstance,
} from 'hostConfig'
import { updateFiberProps } from 'react-dom/src/syntheticEvents'
import { FiberNode } from './fiber'
import { NoFlags, Update } from './fiberFlags'
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from './workTags'

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update
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
        updateFiberProps(wip.stateNode, newProps)
      } else {
        // mount
        // 1. build DOM node
        const instance = createInstance(wip.type, newProps)
        // 2. append DOM element to the DOM tree
        appendAllChildren(instance, wip)
        wip.stateNode = instance
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
      bubbleProperties(wip)
      return null
    case FunctionComponent:
      bubbleProperties(wip)
      return null
    default:
      if (__DEV__) {
        console.warn('unknown fiber tag for completework', wip)
      }
      break
  }
}

function appendAllChildren(parent: Container, wip: FiberNode) {
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
