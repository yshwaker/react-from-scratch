import { Container } from 'hostConfig'
import { React$Element } from 'shared/ReactTypes'
import { FiberNode, FiberRootNode } from './fiber'
import { requestUpdateLanes } from './fiberLanes'
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
} from './updateQueue'
import { scheduleUpdateOnFiber } from './workLoop'
import { HostRoot } from './workTags'

// createRoot()
export function createContainer(container: Container) {
  // the whole fiber tree is empty before mount
  const hostRootFiber = new FiberNode(HostRoot, {}, null)
  const root = new FiberRootNode(container, hostRootFiber)
  hostRootFiber.updateQueue = createUpdateQueue()

  return root
}

// createRoot(rootElement).render(<App />)
export function updateContainer(
  element: React$Element | null,
  root: FiberRootNode
) {
  const hostRootFiber = root.current

  const lane = requestUpdateLanes()
  const update = createUpdate<React$Element | null>(element, lane)
  enqueueUpdate(
    hostRootFiber.updateQueue as UpdateQueue<React$Element | null>,
    update
  )

  // reconcile on the fiber tree
  scheduleUpdateOnFiber(hostRootFiber, lane)

  return element
}
