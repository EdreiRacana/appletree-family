'use client'

import { Search, Bell, Plus, UserPlus } from 'lucide-react'

export default function Topbar() {
  return (
    <header className="topbar">
      {/* Logo */}
      <a href="/" className="logo">
        <span className="logo-icon">🍎</span>
        <div>
          <div className="logo-text">AppleTree Family</div>
          <div className="logo-sub">Your Roots, Connected</div>
        </div>
      </a>

      {/* Search */}
      <div className="search-bar">
        <Search className="search-icon" />
        <input
          id="search-members"
          type="text"
          placeholder="Look up family members..."
        />
      </div>

      {/* Actions */}
      <div className="topbar-actions">
        <button id="btn-add-member" className="topbar-btn" title="Add Family Member">
          <Plus size={18} />
        </button>
        <button id="btn-invite" className="topbar-btn" title="Invite Family">
          <UserPlus size={18} />
        </button>
        <button id="btn-notifications" className="topbar-btn" title="Notifications">
          <Bell size={18} />
        </button>
        <img
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=Edrei&backgroundColor=b6e3f4"
          alt="My profile"
          className="avatar-sm"
          id="btn-profile"
        />
      </div>
    </header>
  )
}
