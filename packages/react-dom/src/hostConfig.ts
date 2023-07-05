export type Container = Element
export type Instance = Element

export function createInstance(type: string, props: any): Instance {
  // TODO: handle props
  const element = document.createElement(type)
  return element
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
