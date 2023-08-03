import { Dispatch } from 'react/src/currentDispatcher'
import { Action } from 'shared/ReactTypes'
import { Lane } from './fiberLanes'

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
  update: Update<State>
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
}

// process all the updates in the queue
export function processUpdateQueue<State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): { memoizedState: State } {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
  }

  if (pendingUpdate !== null) {
    // first update on the linked list
    const first = pendingUpdate.next
    let pending = pendingUpdate.next as Update<any>
    do {
      const updateLane = pending.lane
      if (updateLane === renderLane) {
        const action = pendingUpdate.action
        if (action instanceof Function) {
          // action: (prevState: State) => State
          baseState = action(baseState)
        } else {
          // action: State
          baseState = action
        }
      } else {
        if (__DEV__) {
          console.error('renderLane is not consistent with the update lane')
        }
      }
      pending = pending.next as Update<any>
    } while (pending !== first)
  }

  result.memoizedState = baseState

  return result
}
