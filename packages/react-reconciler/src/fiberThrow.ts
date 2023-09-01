import { Wakeable } from 'shared/ReactTypes'
import { FiberRootNode } from './fiber'
import { ShouldCapture } from './fiberFlags'
import { Lane, markRootPinged } from './fiberLanes'
import { getSuspenseHandler } from './suspenseContext'
import { ensureRootIsScheduled, markRootUpdated } from './workLoop'

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
  // Error boundary

  // thenable
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function'
  ) {
    const wakeable: Wakeable<any> = value

    const suspenseBoundary = getSuspenseHandler()

    if (suspenseBoundary) {
      suspenseBoundary.flags |= ShouldCapture
    }

    attachPingListener(root, wakeable, lane)
  }
}

function attachPingListener(
  root: FiberRootNode,
  wakeable: Wakeable<any>,
  lane: Lane
) {
  let pingCache = root.pingCache
  // lanes that trigger the update
  let threadIDs: Set<Lane> | undefined

  function ping() {
    console.warn('ping!')
    if (pingCache !== null) {
      pingCache.delete(wakeable)
    }
    markRootPinged(root, lane)
    // same as scheduleUpdateOnFiber
    markRootUpdated(root, lane)
    ensureRootIsScheduled(root)
  }

  if (pingCache === null) {
    threadIDs = new Set<Lane>()
    pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>()
    pingCache.set(wakeable, threadIDs)
  } else {
    threadIDs = pingCache.get(wakeable)
    if (threadIDs === undefined) {
      threadIDs = new Set<Lane>()
      pingCache.set(wakeable, threadIDs)
    }
  }

  if (!threadIDs.has(lane)) {
    threadIDs.add(lane)

    // only add then() once per lane
    wakeable.then(ping, ping)
  }
}
