import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import { Props, React$Element } from 'shared/ReactTypes'
import {
  FiberNode,
  createFiberFromElement,
  createWorkInProgress,
} from './fiber'
import { ChildDeletion, Placement } from './fiberFlags'
import { HostText } from './workTags'

type ExistingChildren = Map<string | number, FiberNode>

function ChildReconciler(shouldTrackEffects: boolean) {
  function deleteChild(returnFiber: FiberNode, childToDeletion: FiberNode) {
    if (!shouldTrackEffects) {
      return
    }
    const deletions = returnFiber.deletions
    if (deletions === null) {
      returnFiber.deletions = [childToDeletion]
      returnFiber.flags |= ChildDeletion
    } else {
      deletions.push(childToDeletion)
    }
  }

  function deleteRemainingChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null
  ) {
    if (!shouldTrackEffects) {
      return
    }
    let childToDelete = currentFirstChild
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete)
      childToDelete = childToDelete.sibling
    }
  }

  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: React$Element
  ) {
    const key = element.key
    while (currentFiber !== null) {
      //update
      if (currentFiber.key === key) {
        // same key
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // same type
            const existing = useFiber(currentFiber, element.props)
            existing.return = returnFiber
            deleteRemainingChildren(returnFiber, currentFiber.sibling)

            return existing
          }
          // same key, different type: delete all children
          deleteRemainingChildren(returnFiber, currentFiber)
          break
        } else {
          if (__DEV__) {
            console.warn('unsupported element type', element)
          }
          break
        }
      } else {
        // different key: delete current fiber
        deleteChild(returnFiber, currentFiber)
        currentFiber = currentFiber.sibling
      }
    }

    const fiber = createFiberFromElement(element)
    fiber.return = returnFiber

    return fiber
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    while (currentFiber !== null) {
      // update
      if (currentFiber.tag === HostText) {
        const existing = useFiber(currentFiber, { content })
        existing.return = returnFiber
        deleteRemainingChildren(returnFiber, currentFiber.sibling)
        return existing
      }

      // non HostText => HostText, delete current node
      deleteChild(returnFiber, currentFiber)
      currentFiber = currentFiber.sibling
    }

    const fiber = new FiberNode(HostText, { content }, null)
    fiber.return = returnFiber

    return fiber
  }

  function placeSingleChild(fiber: FiberNode) {
    if (shouldTrackEffects && fiber.alternate === null) {
      fiber.flags |= Placement
    }

    return fiber
  }

  function reconcileChildArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: any[]
  ) {
    // index of the last reusable fiber in the current children
    let lastPlacedIndex = 0
    // the last new fiber
    let lastNewFiber: FiberNode | null = null
    // the first new fiber
    let firstNewFiber: FiberNode | null = null

    // 1. store all existing children into a map for indexing
    const existingChildren: ExistingChildren = new Map()
    let current = currentFirstChild
    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index
      existingChildren.set(keyToUse, current)
      current = current.sibling
    }

    for (let i = 0; i < newChild.length; i++) {
      // 2. is child in newChild reuseable?
      const after = newChild[i]
      const newFiber = updateFromMap(returnFiber, existingChildren, i, after)
      if (newFiber === null) {
        // react element is null or false
        continue
      }

      newFiber.index = i
      newFiber.return = returnFiber

      if (lastNewFiber === null) {
        lastNewFiber = newFiber
        firstNewFiber = newFiber
      } else {
        lastNewFiber.sibling = newFiber
        lastNewFiber = newFiber
      }

      if (!shouldTrackEffects) {
        continue
      }

      // 3. is the new fiber moved or created
      const current = newFiber.alternate
      if (current !== null) {
        const oldIndex = current.index
        if (oldIndex < lastPlacedIndex) {
          // the a in a b c => b c a
          // moving
          newFiber.flags |= Placement
          continue
        } else {
          // not moving, the relative order doesn't change
          lastPlacedIndex = oldIndex
        }
      } else {
        // mount
        // insert
        newFiber.flags |= Placement
      }
    }
    // 4. delete remaining fibers in the map
    existingChildren.forEach((fiber) => deleteChild(returnFiber, fiber))

    return firstNewFiber
  }

  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index
    const before = existingChildren.get(keyToUse)

    if (typeof element === 'string' || typeof element === 'number') {
      // HostText
      if (before) {
        if (before.tag === HostText) {
          existingChildren.delete(keyToUse)
          return useFiber(before, { content: element + '' })
        }
      }
      return new FiberNode(HostText, { content: element + '' }, null)
    }
    if (typeof element === 'object' && element !== null) {
      // ReactElement
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (before) {
            if (before.type === element.type) {
              existingChildren.delete(keyToUse)
              return useFiber(before, element.props)
            }
          }
          return createFiberFromElement(element)
      }

      if (Array.isArray(element) && __DEV__) {
        // TODO: element is an array of elements
        console.log('child which is an array of elements is not supported yet')
      }
    }

    return null
  }

  return function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: React$Element
  ) {
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        // single react element
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          )
        // default:
        //   if (__DEV__) {
        //     console.warn('unsupported type for reconciliation', newChild)
        //   }
      }

      // dealing with multiple children, like ul > li*3
      if (Array.isArray(newChild)) {
        return reconcileChildArray(returnFiber, currentFiber, newChild)
      }
    }

    // HostText
    if (typeof newChild === 'number' || typeof newChild === 'string') {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      )
    }

    if (__DEV__) {
      console.warn('unsupported type for reconciliation', newChild)
    }
    // fallback: delete
    if (currentFiber !== null) {
      deleteRemainingChildren(returnFiber, currentFiber)
    }

    return null
  }
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps)
  clone.index = 0
  clone.sibling = null
  return clone
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)
