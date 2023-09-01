import { FiberNode } from './fiber'

const suspenseHandlerContext: FiberNode[] = []

export function getSuspenseHandler() {
  return suspenseHandlerContext[suspenseHandlerContext.length - 1]
}

export function pushSuspenseHandler(handler: FiberNode) {
  suspenseHandlerContext.push(handler)
}

export function popSuspenseHandler() {
  suspenseHandlerContext.pop()
}
