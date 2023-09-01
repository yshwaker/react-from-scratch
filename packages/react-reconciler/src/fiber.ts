import { Container } from 'hostConfig' // the path is specified in tsconfig, because each host env has its own implementation
import { CallbackNode } from 'scheduler'
import { REACT_PROVIDER_TYPE, REACT_SUSPENSE_TYPE } from 'shared/ReactSymbols'
import { Key, Props, React$Element, Ref, Wakeable } from 'shared/ReactTypes'
import { Flags, NoFlags } from './fiberFlags'
import { Effect } from './fiberHooks'
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes'
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  OffscreenComponent,
  SuspenseComponent,
  WorkTag,
} from './workTags'

export interface OffscreenProps {
  mode: 'visible' | 'hidden'
  children: any
}

export class FiberNode {
  tag: WorkTag
  key: Key

  stateNode: any // Dom element or component instance

  // for Function Component <App />, type: App
  // for Host Component <div>, type: 'div'
  type: any
  ref: Ref | null
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
  // in FC, it points to an effect list(circular linked list) in the context of this FC
  updateQueue: unknown
  flags: Flags // the mark for future operation(side effects) like dom append, update or deletion...
  subtreeFlags: Flags // flags bubbled up from the descendents
  deletions: FiberNode[] | null // child fiber nodes to delete

  /**
   *
   * @param tag
   * @param pendingProps the props that need change
   * @param key
   */
  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag
    this.key = key ?? null
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
    this.deletions = null
  }
}

export interface PendingPassiveEffects {
  unmount: Effect[] // collect destroy callbacks
  update: Effect[] // collect create callbacks
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
  pendingLanes: Lanes // unprocessed lanes
  finishedLane: Lane // current lane processed
  pendingPassiveEffects: PendingPassiveEffects // the place to collect all pending passive effects

  callbackNode: CallbackNode | null // tmp place to store work for concurrent rendering
  callbackPriority: Lane

  pingCache: WeakMap<Wakeable<any>, Set<Lane>> | null

  // when update cause supsense, update lane is added into suspendedLanes
  // when wakeable pings, corresponding suspend lane is added into pingedLanes
  suspendedLanes: Lanes
  pingedLanes: Lanes

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container
    this.current = hostRootFiber
    hostRootFiber.stateNode = this
    this.finishedWork = null
    this.pendingLanes = NoLanes
    this.suspendedLanes = NoLanes
    this.pingedLanes = NoLanes
    this.finishedLane = NoLane
    this.pendingPassiveEffects = {
      unmount: [],
      update: [],
    }

    this.callbackNode = null
    this.callbackPriority = NoLane

    this.pingCache = null
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
    // reset
    wip.pendingProps = pendingProps
    wip.flags = NoFlags // clear flags from last update
    wip.subtreeFlags = NoFlags
    wip.deletions = null
  }

  wip.type = current.type
  wip.updateQueue = current.updateQueue
  wip.child = current.child

  wip.memoizedProps = current.memoizedProps
  wip.memoizedState = current.memoizedState
  wip.ref = current.ref

  return wip
}

export function createFiberFromElement(element: React$Element) {
  const { type, props, key, ref } = element
  let fiberTag: WorkTag = FunctionComponent

  if (typeof type === 'string') {
    // e.g. type of <div> is 'div'
    fiberTag = HostComponent
  } else if (
    typeof type === 'object' &&
    type.$$typeof === REACT_PROVIDER_TYPE
  ) {
    fiberTag = ContextProvider
  } else if (type === REACT_SUSPENSE_TYPE) {
    fiberTag = SuspenseComponent
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('undefined type of react element', element)
  }

  const fiber = new FiberNode(fiberTag, props, key)
  fiber.type = type
  fiber.ref = ref

  return fiber
}

// for fragment fiber node, its pending props is a child array
export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key)
  return fiber
}

export function createFiberFromOffscreen(
  pendingProps: OffscreenProps
): FiberNode {
  const fiber = new FiberNode(OffscreenComponent, pendingProps, null)
  return fiber
}
