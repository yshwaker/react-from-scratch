import {
  CallbackNode,
  unstable_IdlePriority as IdlePriority,
  // sync tasks
  unstable_ImmediatePriority as ImmediatePriority,
  unstable_LowPriority as LowPriority,
  unstable_NormalPriority as NormalPriority,
  unstable_UserBlockingPriority as UserBlockingPriority,
  unstable_cancelCallback as cancelCallback,
  unstable_getFirstCallbackNode as getFirstCallbackNode,
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield as shouldYield,
} from 'scheduler'
import './style.css'

const root = document.querySelector('#root')

type Priority =
  | typeof IdlePriority
  | typeof LowPriority
  | typeof NormalPriority
  | typeof UserBlockingPriority
  | typeof ImmediatePriority

interface Work {
  count: number
  priority: Priority
}

const workList: Work[] = []
let prevPriority: Priority = IdlePriority
let currCallback: CallbackNode | null = null

;[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
  (priority) => {
    const btn = document.createElement('button')
    root?.append(btn)
    btn.textContent = [
      '',
      'ImmediatePriority',
      'UserBlockingPriority',
      'NormalPriority',
      'LowPriority',
    ][priority]

    btn.onclick = () => {
      workList.unshift({
        count: 100,
        priority: priority as Priority,
      })
      schedule()
    }
  }
)

function schedule() {
  const cbNode = getFirstCallbackNode()
  const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0]

  // 策略逻辑
  if (!curWork) {
    currCallback = null
    cbNode && cancelCallback(cbNode)
    return
  }

  const { priority: currPriority } = curWork

  if (currPriority === prevPriority) {
    return
  }

  // higher priority
  cbNode && cancelCallback(cbNode)
  currCallback = scheduleCallback(currPriority, perform.bind(null, curWork))
}

function perform(work: Work, didTimeout?: boolean) {
  /**
   * 1. sync task => ImmediatePriority
   * 2. hungry task => didTimeout
   * 3. time slice => shouldYield
   */
  const needSync = work.priority === ImmediatePriority || didTimeout
  while ((needSync || !shouldYield()) && work.count) {
    work.count--
    insertSpan(work.priority + '')
  }

  // interrupted or finished
  prevPriority = work.priority
  if (!work.count) {
    const workIndex = workList.indexOf(work)
    workList.splice(workIndex, 1)
    prevPriority = IdlePriority
  }

  const prevCallback = currCallback
  schedule()
  const newCallback = currCallback

  // no higher priority existed
  if (newCallback && prevCallback === newCallback) {
    // if the work returns a function, schedule will continue scheduling this function
    return perform.bind(null, work)
  }
}

function insertSpan(content) {
  const span = document.createElement('span')
  span.textContent = content
  span.className = `pri-${content}`
  busy(10000000)
  root?.appendChild(span)
}

function busy(len: number) {
  let res = 0
  while (len--) {
    res++
  }
}
