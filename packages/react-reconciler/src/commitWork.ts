import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertChildToContainer,
  removeChild,
} from 'hostConfig'
import { FiberNode, FiberRootNode } from './fiber'
import {
  ChildDeletion,
  MutationMask,
  NoFlags,
  Placement,
  Update,
} from './fiberFlags'
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from './workTags'

let nextEffect: FiberNode | null

// find all effects recursively
export function commitMutationEffect(finishedWork: FiberNode) {
  nextEffect = finishedWork

  while (nextEffect !== null) {
    // DFS: dive
    const child: FiberNode | null = nextEffect.child

    if (
      (nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
      child !== null
    ) {
      nextEffect = child
    } else {
      // no effects in the children or this is a leaf node
      // so stop traversing down and commit the effect on current node
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect)
        const sibling: FiberNode | null = nextEffect.sibling
        if (sibling !== null) {
          nextEffect = sibling
          break up
        }

        nextEffect = nextEffect.return
      }
    }
  }
}

function commitMutationEffectsOnFiber(finishedWork: FiberNode) {
  const flags = finishedWork.flags

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork)
    finishedWork.flags &= ~Placement
  }

  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork)
    finishedWork.flags &= ~Update
  }

  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions
    if (deletions !== null) {
      deletions.forEach((childToDelete) => {
        commitDeletion(childToDelete)
      })
    }
    finishedWork.flags &= ~ChildDeletion
  }
}

// delete whole subtree
function commitDeletion(childToDelete: FiberNode) {
  let rootHostNode: FiberNode | null = null

  // traverse the tree recursively
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        if (rootHostNode === null) {
          rootHostNode = unmountFiber
        }
        // TODO: unbind ref
        return
      case HostText:
        if (rootHostNode === null) {
          rootHostNode = unmountFiber
        }
        return
      case FunctionComponent:
        // TODO: useEffect unmount callback, unbind ref
        return
      default:
        if (__DEV__) {
          console.warn('unmount: unhandled fiber type', unmountFiber)
        }
    }
  })

  // remove rootHostNode from dom tree
  if (rootHostNode !== null) {
    const hostParent = getHostParent(childToDelete)
    if (hostParent !== null) {
      removeChild((rootHostNode as FiberNode).stateNode, hostParent)
    }
  }
  childToDelete.return = null
  childToDelete.child = null
}

function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root
  while (true) {
    onCommitUnmount(node)

    if (node.child !== null) {
      node.child.return = node
      node = node.child
      continue
    }
    if (node === root) {
      return
    }

    while (node.sibling == null) {
      if (node.return === null || node.return === root) {
        return
      }
      node = node.return
    }
    node.sibling.return = node.return
    node = node.sibling
  }
}

function commitPlacement(finishedWork: FiberNode) {
  if (__DEV__) {
    console.log('executing commitPlacement', finishedWork)
  }

  // parent DOM
  const hostParent = getHostParent(finishedWork)

  // host sibling
  const sibling = getHostSibling(finishedWork)

  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling)
  }
}

function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber

  findSibling: while (true) {
    while (node.sibling === null) {
      const parent = node.return

      if (parent === null || [HostText, HostComponent].includes(parent.tag)) {
        // if we hit the parent that is host node, that means
        // parent dom --- sibling
        //   |
        //  node
        // parent's sibling can't be target fiber's sibing
        return null
      }
      // <A> --- <div>
      //  |
      // <B>
      node = parent
    }
    node.sibling.return = node
    node = node.sibling

    while (![HostText, HostComponent].includes(node.tag)) {
      // go down
      if ((node.flags & Placement) !== NoFlags) {
        // we can insert new fiber before a node that is also moving or inserted
        continue findSibling
      }
      if (node.child === null) {
        continue findSibling
      } else {
        // <A> -- <B>
        //         |
        //       <div>
        node.child.return = node
        node = node.child
      }
    }

    if ((node.tag & Placement) === NoFlags) {
      // found Host Component/Text w/o Placement
      return node.stateNode
    }
  }
}

// traverse up, find the first host element
function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return

  while (parent) {
    const parentTag = parent.tag

    if (parentTag === HostComponent) {
      return parent.stateNode as Container
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container
    }
    parent = parent.return
  }

  if (__DEV__) {
    console.error('host parent not found')
  }

  return null
}

// traverse down, find the roots of all host nodes, and append them to host parent
function insertOrAppendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(hostParent, finishedWork.stateNode, before)
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode)
    }

    return
  }

  const child = finishedWork.child
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent)
    let sibling = child.sibling

    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent)
      sibling = sibling.sibling
    }
  }
}
