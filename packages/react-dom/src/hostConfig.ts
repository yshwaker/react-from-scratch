import { FiberNode } from 'react-reconciler/src/fiber'
import { HostText } from 'react-reconciler/src/workTags'
import { Props } from 'shared/ReactTypes'
import { DOMElement, updateFiberProps } from './syntheticEvents'

export type Container = Element
export type Instance = Element
export type textInstance = Text

export function createInstance(type: string, props: Props): Instance {
  // TODO: handle props
  const element = document.createElement(type) as unknown
  updateFiberProps(element as DOMElement, props)
  return element as DOMElement
}

export function appendInitialChild(
  parent: Instance | Container,
  child: Instance
) {
  parent.appendChild(child)
}

export function createTextInstance(content: string) {
  return document.createTextNode(content)
}

export const appendChildToContainer = appendInitialChild

export function insertChildToContainer(
  container: Container,
  child: Instance,
  before: Instance
) {
  container.insertBefore(child, before)
}

export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content
      return commitTextUpdate(fiber.stateNode, text)
    // case HostComponent:
    // TODO: update dom props
    default:
      if (__DEV__) {
        console.warn('unsupported fiber type for update')
      }
      break
  }
}

function commitTextUpdate(textInstance: textInstance, content: string) {
  textInstance.textContent = content
}

export function removeChild(
  child: Instance | textInstance,
  container: Container
) {
  container.removeChild(child)
}

export const scheduleMicroTask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
    ? (callback: (...args: any) => void) => Promise.resolve().then(callback)
    : setTimeout
