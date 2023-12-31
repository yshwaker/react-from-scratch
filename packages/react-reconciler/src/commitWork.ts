import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  hideInstance,
  hideTextInstance,
  insertChildToContainer,
  removeChild,
  unhideInstance,
  unhideTextInstance,
} from 'hostConfig'
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber'
import {
  ChildDeletion,
  Flags,
  LayoutMask,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Ref,
  Update,
  Visibility,
} from './fiberFlags'
import { Effect, FCUpdateQueue } from './fiberHooks'
import { HookHasEffect } from './hookEffectTags'
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
} from './workTags'

let nextEffect: FiberNode | null

// find all effects recursively
function commitEffects(
  phrase: 'mutation' | 'layout',
  mask: Flags,
  callback: (fiber: FiberNode, root: FiberRootNode) => void
) {
  return (finishedWork: FiberNode, root: FiberRootNode) => {
    nextEffect = finishedWork

    while (nextEffect !== null) {
      // DFS: dive
      const child: FiberNode | null = nextEffect.child

      if ((nextEffect.subtreeFlags & mask) !== NoFlags && child !== null) {
        nextEffect = child
      } else {
        // no effects in the children or this is a leaf node
        // so stop traversing down and commit the effect on current node
        up: while (nextEffect !== null) {
          callback(nextEffect, root)
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
}

function commitMutationEffectsOnFiber(
  finishedWork: FiberNode,
  root: FiberRootNode
) {
  const { flags, tag } = finishedWork

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
        commitDeletion(childToDelete, root)
      })
    }
    finishedWork.flags &= ~ChildDeletion
  }
  if ((flags & PassiveEffect) !== NoFlags) {
    commitPassiveEffect(finishedWork, root, 'update')
    finishedWork.flags &= ~PassiveEffect
  }

  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    safelyAttachRef(finishedWork)
    finishedWork.flags &= ~Ref
  }

  if ((flags & Visibility) !== NoFlags && tag === OffscreenComponent) {
    const isHidden = finishedWork.pendingProps.mode === 'hidden'
    hideOrUnhideAllChildren(finishedWork, isHidden)
    finishedWork.flags &= ~Visibility
  }
}

function hideOrUnhideAllChildren(finishedWork: FiberNode, isHidden: boolean) {
  findHostSubtreeRoot(finishedWork, (hostRoot) => {
    const instance = hostRoot.stateNode
    if (hostRoot.tag === HostComponent) {
      isHidden ? hideInstance(instance) : unhideInstance(instance)
    } else if (hostRoot.tag === HostText) {
      isHidden
        ? hideTextInstance(instance)
        : unhideTextInstance(instance, hostRoot.memoizedProps.content)
    }
  })
}

function findHostSubtreeRoot(
  finishedWork: FiberNode,
  callback: (hostSubtreeRoot: FiberNode) => void
) {
  let node = finishedWork
  let hostSubtreeRoot = null

  while (true) {
    if (node.tag === HostComponent) {
      if (hostSubtreeRoot === null) {
        hostSubtreeRoot = node
        callback(node)
      }
    } else if (node.tag === HostText) {
      if (hostSubtreeRoot === null) {
        callback(node)
      }
    } else if (
      node.tag === OffscreenComponent &&
      node.pendingProps.mode === 'hidden' &&
      node !== finishedWork
    ) {
      // nested Offscreen, skip. it will be handled by nested suspense
    } else if (node.child !== null) {
      node.child.return = node
      node = node.child
      continue
    }

    if (node === finishedWork) {
      return
    }

    while (node.sibling === null) {
      if (node.return === finishedWork || node.return === null) {
        return
      }

      if (node === hostSubtreeRoot) {
        // leaving the subtree
        hostSubtreeRoot = null
      }
      node = node.return
    }

    if (node === hostSubtreeRoot) {
      // leaving the subtree
      hostSubtreeRoot = null
    }

    node.sibling.return = node.return
    node = node.sibling
  }
}

function commitLayoutEffectsOnFiber(
  finishedWork: FiberNode,
  root: FiberRootNode
) {
  const { flags, tag } = finishedWork

  if (tag === HostComponent && (flags & Ref) !== NoFlags) {
    // attach new ref
    safelyAttachRef(finishedWork)
    finishedWork.flags &= ~Ref
  }
}

function safelyDetachRef(current: FiberNode) {
  const ref = current.ref
  if (ref !== null) {
    if (typeof ref === 'function') {
      ref(null)
    } else {
      ref.current = null
    }
  }
}

function safelyAttachRef(fiber: FiberNode) {
  const ref = fiber.ref
  if (ref !== null) {
    const instance = fiber.stateNode
    if (typeof ref === 'function') {
      ref(instance)
    } else {
      ref.current = instance
    }
  }
}

export const commitMutationEffects = commitEffects(
  'mutation',
  MutationMask | PassiveMask,
  commitMutationEffectsOnFiber
)

export const commitLayoutEffects = commitEffects(
  'layout',
  MutationMask | LayoutMask,
  commitLayoutEffectsOnFiber
)

function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffects
) {
  if (
    fiber.tag !== FunctionComponent ||
    (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return
  }
  if (__DEV__) {
    console.log('executing commitPassiveEffect', fiber)
  }

  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>
  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.error(
        'there should have been at least one effect when the PassiveEffect flag is on'
      )
    }
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect)
  }
}

function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect

  do {
    if ((effect.tag & flags) === flags) {
      callback(effect)
    }
    effect = effect.next as Effect
  } while (effect !== lastEffect.next)
}

// destroy callback triggered by unmount
export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy
    if (typeof destroy === 'function') {
      destroy()
    }
    effect.tag &= ~HookHasEffect
  })
}

// destroy callback triggered as last update's cleanup function
export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy
    if (typeof destroy === 'function') {
      destroy()
    }
  })
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create
    if (typeof create === 'function') {
      effect.destroy = create()
    }
  })
}

function recordHostChildrenToDelete(
  childToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // 1. find the first found host node
  const lastOne = childToDelete[childToDelete.length - 1]
  if (!lastOne) {
    childToDelete.push(unmountFiber)
  } else {
    // 2. every time we find a host node, check if it is the sibling of first-found host node
    let node = lastOne.sibling
    while (node !== null) {
      if (unmountFiber === node) {
        childToDelete.push(unmountFiber)
      }
      node = node.sibling
    }
  }
}

// delete whole subtree
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  // all roots of its subtrees
  // since the fiber can be a fragment, it can have multiple children to delete
  // <>
  //   <p>1</p>  <- delete
  //   <p>2</p>  <- delete
  // </>
  const rootChildrenToDelete: FiberNode[] = []

  if (__DEV__) {
    console.log('executing commitDeletion', childToDelete)
  }

  // traverse the tree recursively
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
        safelyDetachRef(unmountFiber)
        return
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)
        return
      case FunctionComponent:
        // TODO: unbind ref
        commitPassiveEffect(unmountFiber, root, 'unmount')
        return
      default:
        if (__DEV__) {
          console.warn('unmount: unhandled fiber type', unmountFiber)
        }
    }
  })

  // remove rootHostNode from dom tree
  if (rootChildrenToDelete.length > 0) {
    const hostParent = getHostParent(childToDelete)
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) =>
        removeChild(node.stateNode, hostParent)
      )
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

      if (parent === null || [HostRoot, HostComponent].includes(parent.tag)) {
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
    node.sibling.return = node.return
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

    if ((node.flags & Placement) === NoFlags) {
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
