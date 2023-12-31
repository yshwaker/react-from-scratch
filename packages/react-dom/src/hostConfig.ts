import { FiberNode } from 'react-reconciler/src/fiber'
import { HostComponent, HostText } from 'react-reconciler/src/workTags'
import { Props } from 'shared/ReactTypes'
import { DOMElement, updateFiberProps } from './syntheticEvents'

export type Container = Element
export type Instance = Element
export type TextInstance = Text

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
  if (__DEV__) {
    console.log('executing commitUpdate', fiber)
  }
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content
      return commitTextUpdate(fiber.stateNode, text)
    case HostComponent:
      return updateFiberProps(fiber.stateNode, fiber.memoizedProps)
    default:
      if (__DEV__) {
        console.warn('unsupported fiber type for update')
      }
      break
  }
}

function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.textContent = content
}

export function removeChild(
  child: Instance | TextInstance,
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

export function hideInstance(instance: Instance) {
  const style = (instance as HTMLElement).style
  style.setProperty('display', 'none', 'important')
}

export function unhideInstance(instance: Instance) {
  const style = (instance as HTMLElement).style
  style.display = ''
}

export function hideTextInstance(textInstance: TextInstance) {
  textInstance.nodeValue = ''
}

export function unhideTextInstance(textInstance: TextInstance, text: string) {
  textInstance.nodeValue = text
}
