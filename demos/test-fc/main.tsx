import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  const [num, setNum] = useState(100)
  return <div onClickCapture={() => setNum(num + 1)}>{num}</div>
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
)
