import { FiberNode } from 'react-reconciler/src/fiber'
import { HostText } from 'react-reconciler/src/workTags'
import { Props } from 'shared/ReactTypes'

export interface Container {
  rootID: number
  children: (Instance | TextInstance)[]
}
export interface Instance {
  id: number
  type: string
  children: (Instance | TextInstance)[]
  parent: number
  props: Props
}
export interface TextInstance {
  text: string
  id: number
  parent: number
}

let instanceCounter = 0

export function createInstance(type: string, props: Props): Instance {
  const instance = {
    id: instanceCounter++,
    type: type,
    children: [],
    parent: -1,
    props,
  }

  return instance
}

export function appendInitialChild(
  parent: Instance | Container,
  child: Instance
) {
  const prevParentID = child.parent
  const parentID = 'rootID' in parent ? parent.rootID : parent.id

  if (prevParentID !== -1 && prevParentID !== parentID) {
    throw new Error('duplicate child node insertion')
  }
  child.parent = parentID
  parent.children.push(child)
}

export function createTextInstance(content: string) {
  const instance = {
    text: content,
    id: instanceCounter++,
    parent: -1,
  }

  return instance
}

export const appendChildToContainer = (parent: Container, child: Instance) => {
  const prevParentID = child.parent

  if (prevParentID !== -1 && prevParentID !== parent.rootID) {
    throw new Error('duplicate child node insertion')
  }
  child.parent = parent.rootID
  parent.children.push(child)
}

export function insertChildToContainer(
  container: Container,
  child: Instance,
  before: Instance
) {
  const beforeIndex = container.children.indexOf(before)
  if (beforeIndex === -1) {
    throw new Error("beforeIndex: before node doesn't exist")
  }
  const index = container.children.indexOf(child)
  if (index !== -1) {
    container.children.splice(index, 1)
  }
  container.children.splice(beforeIndex, 0, child)
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

function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.text = content
}

export function removeChild(
  child: Instance | TextInstance,
  container: Container
) {
  const index = container.children.indexOf(child)
  if (index === -1) {
    throw new Error("removeChild: child doesn't exist")
  }
  container.children.splice(index, 1)
}

export const scheduleMicroTask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
    ? (callback: (...args: any) => void) => Promise.resolve().then(callback)
    : setTimeout
