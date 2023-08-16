import React from 'react'
import reactNoopRenderer from 'react-noop-renderer'

function App() {
  return (
    <>
      <Child />
      <div>hello world</div>
    </>
  )
}

function Child() {
  return 'Child'
}

const root = reactNoopRenderer.createRoot()
root.render(<App />)

window.root = root
