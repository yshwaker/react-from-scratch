import { Action } from 'shared/ReactTypes'

export interface Update<State> {
  action: Action<State>
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null
  }
}

export function createUpdate<State>(action: Action<State>): Update<State> {
  return {
    action,
  }
}

export function createUpdateQueue<State>(): UpdateQueue<State> {
  return {
    // shared between current tree and wip tree
    shared: {
      pending: null,
    },
  }
}

export function enqueueUpdate<State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) {
  updateQueue.shared.pending = update
}

export function processUpdateQueue<State>(
  baseState: State,
  pendingUpdate: Update<State> | null
): { memoizedState: State } {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
  }

  if (pendingUpdate !== null) {
    const action = pendingUpdate.action
    if (action instanceof Function) {
      // action: (prevState: State) => State
      result.memoizedState = action(baseState)
    } else {
      // action: State
      result.memoizedState = action
    }
  }

  return result
}
