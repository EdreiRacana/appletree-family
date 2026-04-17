'use client'

import { useState } from 'react'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import TreeCanvas from '@/components/tree/TreeCanvas'
import FeedPanel from '@/components/FeedPanel'
import { DEMO_MEMBERS, DEMO_RELATIONSHIPS } from '@/lib/demoData'

export default function HomePage() {
  const [activeNav, setActiveNav] = useState('tree')

  return (
    <div className="app-shell">
      <Topbar />
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />
      <main className="tree-canvas-area">
        <TreeCanvas members={DEMO_MEMBERS} relationships={DEMO_RELATIONSHIPS} />
      </main>
      <FeedPanel />
    </div>
  )
}
