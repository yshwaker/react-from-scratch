import { Container } from 'hostConfig' // the path is specified in tsconfig, because each host env has its own implementation
import { Key, Props, React$Element, Ref } from 'shared/ReactTypes'
import { Flags, NoFlags } from './fiberFlags'
import { FunctionComponent, HostComponent, WorkTag } from './workTags'

export class FiberNode {
  tag: WorkTag
  key: Key

  stateNode: any // Dom element or component instance

  // for Function Component <App />, type: App
  // for Host Component <div>, type: 'div'
  type: any
  ref: Ref

  /* point to parent, child, sibling fiber */
  return: FiberNode | null
  child: FiberNode | null
  sibling: FiberNode | null
  index: number // the order of the fiber among the its siblings

  pendingProps: Props
  memoizedProps: Props | null // updated props after current work unit completes
  // FunctionComponent: pointer to a linked list of hooks used inside the component
  // HostRoot: updated react element
  memoizedState: any
  alternate: FiberNode | null // corresponding fiber node between current tree and wip tree
  flags: Flags // the mark for future operation(side effects) like dom append, update or deletion...
  subtreeFlags: Flags // flags bubbled up from the descendents
  updateQueue: unknown

  /**
   *
   * @param tag
   * @param pendingProps the props that need change
   * @param key
   */
  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag
    this.key = key
    this.stateNode = null
    this.type = null

    // props of fiber as a node in the fiber tree
    this.return = null
    this.child = null
    this.sibling = null
    this.index = 0

    this.ref = null

    // props of fiber as a unit of work
    this.pendingProps = pendingProps
    this.memoizedProps = null
    this.memoizedState = null
    this.updateQueue = null

    this.alternate = null

    // side effects
    this.flags = NoFlags
    this.subtreeFlags = NoFlags
  }
}

/*
      ┌───────────────┐
      │ FiberRootNode │
      └───┬──────▲────┘
          │      │
 current  │      │ stateNode
          │      │
      ┌───▼──────┴────┐
      │ hostRootFiber │
      └────┬────▲─────┘
           │    │
     child │    │ return
        ┌──▼────┴──┐
        │  <App/>  │
        └──────────┘
*/
export class FiberRootNode {
  // the root element it attatches to, can be a root dom node in browser env.
  container: Container
  current: FiberNode // hostRootFiber
  finishedWork: FiberNode | null // hostRootFiber after update

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container
    this.current = hostRootFiber
    hostRootFiber.stateNode = this
    this.finishedWork = null
  }
}

export function createWorkInProgress(
  current: FiberNode,
  pendingProps: Props
): FiberNode {
  let wip = current.alternate

  if (wip === null) {
    // mount
    wip = new FiberNode(current.tag, pendingProps, current.key)
    wip.stateNode = current.stateNode
    wip.alternate = current
    current.alternate = wip
  } else {
    // update
    wip.pendingProps = pendingProps
    wip.flags = NoFlags // clear flags from last update
    wip.subtreeFlags = NoFlags
  }

  wip.type = current.type
  wip.updateQueue = current.updateQueue
  wip.child = current.child
  wip.memoizedProps = current.memoizedProps
  wip.memoizedState = current.memoizedState

  return wip
}

export function createFiberFromElement(element: React$Element) {
  const { type, props, key } = element
  let fiberTag: WorkTag = FunctionComponent

  if (typeof type === 'string') {
    // e.g. type of <div> is 'div'
    fiberTag = HostComponent
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('undefined type of react element', element)
  }

  const fiber = new FiberNode(fiberTag, props, key)
  fiber.type = type

  return fiber
}
