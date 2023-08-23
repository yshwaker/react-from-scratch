import { Container } from 'hostConfig'
import {
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority,
  unstable_runWithPriority,
} from 'scheduler'
import { Props } from 'shared/ReactTypes'

const validEventTypeList = ['click']
export const elementPropsKey = '__reactProps'
export interface DOMElement extends Element {
  [elementPropsKey]: Props
}

type EventCallback = (e: Event) => void

interface Paths {
  capture: EventCallback[]
  bubble: EventCallback[]
}

interface SyntheticEvent extends Event {
  // since we simulated the capture and bubble phase, we need also create some built-in method of our own version
  __stopPropagation: boolean
}

// store the props of react element onto the attr of corresponding dom element
export function updateFiberProps(node: DOMElement, props: Props) {
  node[elementPropsKey] = props
}

// handle all the events on the container
export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn('unsupported event type')
    return
  }

  if (__DEV__) {
    console.log('init event')
  }

  container.addEventListener(eventType, (e) => {
    dispatchEvent(container, eventType, e)
  })
}

function createSyntheticEvent(e: Event) {
  const syntheticEvent = e as SyntheticEvent
  syntheticEvent.__stopPropagation = false
  const originStopPropagation = e.stopPropagation

  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true
    if (originStopPropagation) {
      originStopPropagation()
    }
  }

  return syntheticEvent
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target

  if (targetElement === null) {
    console.warn(`event doesn't exist`)
    return
  }
  // collect all event callbacks through the capture/bubble path
  const { bubble, capture } = collectPaths(
    targetElement as DOMElement,
    container,
    eventType
  )

  // create synthetic events
  const se = createSyntheticEvent(e)
  // traverse collected capture event callbacks
  triggerEventFlow(capture, se)
  // traverse collected bubble event callbacks
  if (!se.__stopPropagation) {
    triggerEventFlow(bubble, se)
  }
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i]
    // triage callback width different priority based on event type
    unstable_runWithPriority(eventTypeToSchedulerPriority(se.type), () => {
      callback.call(null, se)
    })
    if (se.__stopPropagation) {
      break
    }
  }
}

function getEventCallbackNameFromEventType(
  eventType: string
): string[] | undefined {
  return {
    // [captureEventName, bubbleEventName]
    click: ['onClickCapture', 'onClick'],
  }[eventType]
}

function collectPaths(
  targetElement: DOMElement,
  container: Container,
  eventType: string
) {
  const paths: Paths = {
    capture: [],
    bubble: [],
  }

  while (targetElement && targetElement !== container) {
    const elementProps = targetElement[elementPropsKey]
    if (elementProps) {
      const callbackNameList = getEventCallbackNameFromEventType(eventType)
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName]
          if (eventCallback) {
            if (i === 0) {
              // capture phase: from container to target, so we need to reverse the order
              paths.capture.unshift(eventCallback)
            } else {
              paths.bubble.push(eventCallback)
            }
          }
        })
      }
    }

    targetElement = targetElement.parentNode as DOMElement
  }

  return paths
}

function eventTypeToSchedulerPriority(eventType: string) {
  switch (eventType) {
    case 'click':
    case 'keydown':
    case 'keyup':
      return unstable_ImmediatePriority
    case 'scroll':
      return unstable_UserBlockingPriority
    default:
      return unstable_NormalPriority
  }
}
