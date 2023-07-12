// ReactDOM.createRoot(root).render(<App />)

import {
  createContainer,
  updateContainer,
} from 'react-reconciler/src/fiberReconciler'
import { React$Element } from 'shared/ReactTypes'
import { Container } from './hostConfig'
import { initEvent } from './syntheticEvents'

export function createRoot(container: Container) {
  const root = createContainer(container)

  return {
    render(element: React$Element) {
      initEvent(container, 'click')
      return updateContainer(element, root)
    },
  }
}
