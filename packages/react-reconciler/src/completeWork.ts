import {
  appendInitialChild,
  createInstance,
  createTextInstance,
} from 'hostConfig'
import { FiberNode } from './fiber'
import { NoFlags } from './fiberFlags'
import { HostComponent, HostRoot, HostText } from './workTags'

export function completeWork(wip: FiberNode) {
  const newProps = wip.pendingProps
  const current = wip.alternate

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // update
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

    default:
      if (__DEV__) {
        console.warn('unknown fiber tag for completework', wip)
      }
      break
  }
}

function appendAllChildren(parent: FiberNode, wip: FiberNode) {
  let node = wip.child

  while (node !== null) {
    // append all dom node inside wip to parent
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
