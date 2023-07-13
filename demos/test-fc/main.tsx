import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  const [num, setNum] = useState(100)

  const arr =
    num % 2
      ? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
      : [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>]

  return (
    <ul>
      <>
        <li>1</li>
        <li>2</li>
      </>
      <li>3</li>
      <li>4</li>
    </ul>
  )
  return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
)
