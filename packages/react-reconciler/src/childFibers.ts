import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import { Props, React$Element } from 'shared/ReactTypes'
import {
  FiberNode,
  createFiberFromElement,
  createWorkInProgress,
} from './fiber'
import { ChildDeletion, Placement } from './fiberFlags'
import { HostText } from './workTags'

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

  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: React$Element
  ) {
    const key = element.key
    if (currentFiber !== null) {
      //update
      if (currentFiber.key === key) {
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // same type
            const existing = useFiber(currentFiber, element.props)
            existing.return = returnFiber
            return existing
          }
          // delete old fiber
          deleteChild(returnFiber, currentFiber)
        } else {
          if (__DEV__) {
            console.warn('unsupported element type', element)
          }
        }
      } else {
        // delete old fiber
        deleteChild(returnFiber, currentFiber)
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
    if (currentFiber !== null) {
      // update
      if (currentFiber.tag === HostText) {
        const existing = useFiber(currentFiber, { content })
        existing.return = returnFiber
        return existing
      }

      // non HostText => HostText, delete current node
      deleteChild(returnFiber, currentFiber)
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
        default:
          if (__DEV__) {
            console.warn('unsupported type for reconciliation', newChild)
          }
      }
    }

    // TODO dealing with children consisting of multiple react elements

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
      deleteChild(returnFiber, currentFiber)
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
