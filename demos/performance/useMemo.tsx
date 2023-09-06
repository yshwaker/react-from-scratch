import { useState, useContext, createContext, useMemo } from 'react'

// 1：App提取 bailout四要素
// 2：ExpensiveSubtree用memo包裹
// 3: useMemo
export default function App() {
  const [num, update] = useState(0)
  console.log('App render ', num)

  // the props of ExpensiveSubtree doesn't change here(same reference: {}), since we memoized it
  const Cpn = useMemo(() => <ExpensiveSubtree />, [])

  return (
    <div onClick={() => update(num + 100)}>
      <p>num is: {num}</p>
      {Cpn}
    </div>
  )
}

function ExpensiveSubtree() {
  console.log('ExpensiveSubtree render')
  return <p>i am child</p>
}
