// @ts-ignore
import { createRoot } from 'react-dom'
import { React$Element } from 'shared/ReactTypes'

export function renderIntoDocument(element: React$Element) {
  const div = document.createElement('div')
  return createRoot(div).render(element)
}
