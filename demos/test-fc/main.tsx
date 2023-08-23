import React, { useState } from 'react'
import reactDom from 'react-dom'

function App() {
  const [num, update] = useState(100)
  return (
    <ul onClick={() => update(50)}>
      {[...Array(num)].map((_, i) => {
        return <Child key={i}>{i}</Child>
      })}
    </ul>
  )
}

function Child({ children }) {
  const now = performance.now()
  while (performance.now() - now < 4) {}
  return <li>{children}</li>
}

const root = reactDom.createRoot(document.querySelector('#root'))
root.render(<App />)
