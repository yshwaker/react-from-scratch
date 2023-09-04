import ReactCurrentBatchConfig from 'react/src/currentBatchConfig'
import {
  unstable_IdlePriority,
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority,
  unstable_getCurrentPriorityLevel,
} from 'scheduler'
import { FiberRootNode } from './fiber'

export type Lane = number
export type Lanes = number

export const SyncLane = 0b00001
export const InputContinuousLane = 0b00010 // drag event
export const DefaultLane = 0b00100
export const IdleLane = 0b01000
export const TransitionLane = 0b10000

export const NoLane = 0b00000
export const NoLanes = 0b00000

export function mergeLanes(laneA: Lane, laneB: Lane): Lane {
  return laneA | laneB
}

export function requestUpdateLanes() {
  const isTransition = ReactCurrentBatchConfig.transition !== null

  if (isTransition) {
    return TransitionLane
  }

  const currentSchedulerPriority = unstable_getCurrentPriorityLevel()
  const lane = schedulerPriorityToLane(currentSchedulerPriority)

  return lane
}

// right side bits have higher priority
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes
}

export function isSubsetOfLanes(set: Lanes, subset: Lane) {
  return (set & subset) === subset
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane
  root.suspendedLanes = NoLanes
  root.pingedLanes = NoLanes
}

export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriorityLane(lanes)
  if (lane === SyncLane) {
    return unstable_ImmediatePriority
  }
  if (lane === InputContinuousLane) {
    return unstable_UserBlockingPriority
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority
  }
  return unstable_IdlePriority
}

export function schedulerPriorityToLane(schedulerPriority: number) {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinuousLane
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane
  }
  // ?
  return NoLane
}

export function markRootSuspended(root: FiberRootNode, suspendedLane: Lane) {
  root.suspendedLanes = mergeLanes(root.suspendedLanes, suspendedLane)
  root.pingedLanes &= ~suspendedLane
}

export function markRootPinged(root: FiberRootNode, pingedLane: Lane) {
  // lane will always be suspended before pinged. thus, pingedLane is a subset of suspendedLane
  root.pingedLanes |= root.suspendedLanes & pingedLane
}

export function getNextLane(root: FiberRootNode): Lane {
  const pendingLanes = root.pendingLanes
  const suspendedLanes = root.suspendedLanes

  if (pendingLanes === NoLanes) {
    return NoLane
  }

  let nextLane = NoLane

  const unblockedLanes = pendingLanes & ~suspendedLanes
  if (unblockedLanes !== NoLanes) {
    nextLane = getHighestPriorityLane(unblockedLanes)
  } else {
    // all pendingLanes are suspended
    const pingedLanes = pendingLanes & root.pingedLanes
    if (pingedLanes !== NoLanes) {
      nextLane = getHighestPriorityLane(pingedLanes)
    }
  }

  return nextLane
}

export function includeSomeLanes(set: Lanes, subset: Lane | Lanes): boolean {
  return (set & subset) !== NoLanes
}

export function removeLanes(set: Lanes, subset: Lane | Lanes): Lanes {
  return set & ~subset
}
