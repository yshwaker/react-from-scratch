import { useState } from "react"
import ReactDOM from "react-dom/client"

function App() {
  const [num] = useState(100)
  return (
    <div>
      <div>{num}</div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <App />
)
