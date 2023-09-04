import { Dispatch } from 'react/src/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import { Lane, NoLane, isSubsetOfLanes, mergeLanes } from './fiberLanes'
import { FiberNode } from './fiber'

export interface Update<State> {
  action: Action<State>
  lane: Lane
  next: Update<any> | null
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null
  }
  dispatch: Dispatch<State> | null
}

export function createUpdate<State>(
  action: Action<State>,
  lane: Lane
): Update<State> {
  return {
    action,
    lane,
    next: null,
  }
}

export function createUpdateQueue<State>(): UpdateQueue<State> {
  return {
    // shared between current tree and wip tree
    shared: {
      pending: null,
    },
    dispatch: null,
  }
}

export function enqueueUpdate<State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>,
  fiber: FiberNode,
  lane: Lane
) {
  const pending = updateQueue.shared.pending
  // updateQueue is a circular linked list
  if (pending === null) {
    update.next = update
  } else {
    update.next = pending.next
    pending.next = update
  }

  // store the last update in the list
  // it's convenient to access the first update in the list by pending.next
  updateQueue.shared.pending = update

  fiber.lanes = mergeLanes(fiber.lanes, lane)
  const alternate = fiber.alternate

  if (alternate !== null) {
    // also update the current node, helpful if we need to reset the tree
    alternate.lanes = mergeLanes(alternate.lanes, lane)
  }
}

// process all the updates in the queue
export function processUpdateQueue<State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane,
  onSkipUpdate?: <State>(update: Update<State>) => void
): { memoizedState: State; baseState: State; baseQueue: Update<State> | null } {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null,
  }

  if (pendingUpdate !== null) {
    // first update on the linked list
    const first = pendingUpdate.next
    let pending = pendingUpdate.next as Update<any>

    let newBaseState = baseState
    let newBaseQueueFirst: Update<State> | null = null
    let newBaseQueueLast: Update<State> | null = null
    let newState = baseState // store the value after each update

    do {
      const updateLane = pending.lane
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // skipped update, priority isn't high enough
        const clone = createUpdate(pending.action, pending.lane)
        onSkipUpdate?.(clone)

        if (newBaseQueueFirst === null) {
          // first skipped update
          newBaseQueueFirst = clone
          newBaseQueueLast = clone
          newBaseState = newState
        } else {
          ;(newBaseQueueLast as Update<State>).next = clone
          newBaseQueueLast = clone
        }
      } else {
        if (newBaseQueueLast !== null) {
          const clone = createUpdate(pending.action, NoLane)
          ;(newBaseQueueLast as Update<State>).next = clone
          newBaseQueueLast = clone
        }
        const action = pendingUpdate.action
        if (action instanceof Function) {
          // action: (prevState: State) => State
          newState = action(baseState)
        } else {
          // action: State
          newState = action
        }
      }
      pending = pending.next as Update<any>
    } while (pending !== first)

    if (newBaseQueueLast === null) {
      // no updates are skipped
      newBaseState = newState
    } else {
      newBaseQueueLast.next = newBaseQueueFirst
    }
    result.memoizedState = newState
    result.baseState = newBaseState
    result.baseQueue = newBaseQueueLast
  }

  return result
}
