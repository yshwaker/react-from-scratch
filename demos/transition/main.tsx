import { useState, useTransition } from 'react'
import ReactDOM from 'react-dom'
import AboutTab from './AboutTab'
import ContactTab from './ContactTab'
import PostsTab from './PostsTab'
import TabButton from './TabButton'

import './style.css'

export default function TabContainer() {
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState('about')

  function selectTab(nextTab) {
    startTransition(() => {
      setTab(nextTab)
    })
  }

  return (
    <>
      <TabButton isActive={tab === 'about'} onClick={() => selectTab('about')}>
        About
      </TabButton>
      <TabButton isActive={tab === 'posts'} onClick={() => selectTab('posts')}>
        Posts (slow)
      </TabButton>
      <TabButton
        isActive={tab === 'contact'}
        onClick={() => selectTab('contact')}
      >
        Contact
      </TabButton>
      <hr />
      {tab === 'about' && <AboutTab />}
      {tab === 'posts' && <PostsTab />}
      {tab === 'contact' && <ContactTab />}
    </>
  )
}

const root = ReactDOM.createRoot(document.querySelector('#root'))

root.render(<TabContainer />)
