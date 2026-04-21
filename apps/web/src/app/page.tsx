'use client'

import React from 'react'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import FeedPanel from '@/components/FeedPanel'
import TreeCanvas from '@/components/tree/TreeCanvas'
import { DEMO_MEMBERS, DEMO_RELATIONSHIPS } from '@/lib/demoData'

export default function AppleTreeDashboard() {
  return (
    <main style={{ 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden',
      // RESTORED TO PROFESSIONAL DARK GREEN
      backgroundColor: '#1B2E1B', 
      position: 'relative' 
    }}>
      {/* 1. Global Navigation Bar */}
      <Topbar />

      {/* 2. Main Workspace Layout */}
      <div style={{ 
        display: 'flex', 
        width: '100%', 
        height: 'calc(100vh - 110px)', 
        marginTop: '110px',
        position: 'relative'
      }}>
        {/* Genealogy Tree Layer (Interactive Canvas) */}
        <TreeCanvas 
          members={DEMO_MEMBERS} 
          relationships={DEMO_RELATIONSHIPS} 
        />

        {/* Sidebar Navigation Rail & Floating Panels (Left Overlay) */}
        <Sidebar />

        {/* Dynamic Social Feed / Events (Right Overlay) */}
        <FeedPanel />
      </div>

      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          background-color: #1B2E1B;
          overflow: hidden;
        }
        @keyframes slideIn {
          from { transform: translateX(-30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .topbar-btn {
          transition: all 0.2s ease;
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
        }
        .topbar-btn:hover {
          background-color: rgba(255,255,255,0.2) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </main>
  )
}
