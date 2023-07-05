import ReactDOM from "react-dom"

function App() {
  return (
    <div>
      <span>Hello world</span>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <App />
)
