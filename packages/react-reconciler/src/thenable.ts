import {
  FulfilledThenable,
  PendingThenable,
  RejectedThenable,
  Thenable,
} from 'shared/ReactTypes'

export const SuspenseException = new Error(
  'this is an actual error, but a part of suspense implementation, if you caught it, please throw it'
)

let suspendedThenable: Thenable<any> | null = null

export function getSuspenseThenable(): Thenable<any> {
  if (suspendedThenable === null) {
    throw new Error('unintended result: suspendedThenable should exists')
  }

  const thenable = suspendedThenable
  suspendedThenable = null
  return thenable
}

function noop() {}

export function trackUsedThenable<T>(thenable: Thenable<T>) {
  switch (thenable.status) {
    case 'fulfilled':
      return thenable.value
    case 'rejected':
      throw thenable.reason
    default:
      if (typeof thenable.status === 'string') {
        thenable.then(noop, noop)
      } else {
        // untracked => pending
        const pending = thenable as unknown as PendingThenable<T, void, any>
        pending.status = 'pending'
        pending.then(
          (val) => {
            if (pending.status === 'pending') {
              //@ts-ignore
              const fulfilled: FulfilledThenable<T, void, any> = pending
              fulfilled.status = 'fulfilled'
              fulfilled.value = val
            }
          },
          (err) => {
            if (pending.status === 'pending') {
              //@ts-ignore
              const rejected: RejectedThenable<T, void, any> = pending
              rejected.status = 'rejected'
              rejected.reason = err
            }
          }
        )
      }
  }

  suspendedThenable = thenable

  // break current process
  throw SuspenseException
}
