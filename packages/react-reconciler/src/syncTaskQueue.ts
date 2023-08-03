let syncQueue: ((...args: any) => void)[] | null = null
let isFlushingSyncQueue = false

export function scheduleSyncCallback(callback: (...args: any) => void) {
  if (syncQueue === null) {
    syncQueue = [callback]
  } else {
    syncQueue.push(callback)
  }
}

// invoke all the sync callbacks
export function flushSyncCallbacks() {
  // flushSyncCallbacks should be called only once
  if (!isFlushingSyncQueue && syncQueue) {
    isFlushingSyncQueue = true
    try {
      syncQueue.forEach((callback) => callback())
    } catch (e) {
      if (__DEV__) {
        console.error('flushSyncCallbacks():', e)
      }
    } finally {
      isFlushingSyncQueue = false
    }
  }
}
