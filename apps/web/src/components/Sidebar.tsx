'use client'

import React, { useState } from 'react'
import { Home, TreePine, Users, Image as ImageIcon, Calendar, Settings as SettingsIcon, X } from 'lucide-react'

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<string | null>('My Tree')

  const menuItems = [
    { icon: <Home size={34} />, label: 'Home' },
    { icon: <TreePine size={34} />, label: 'My Tree' },
    { icon: <Users size={34} />, label: 'Network' },
    { icon: <ImageIcon size={34} />, label: 'Photo Albums' },
    { icon: <Calendar size={34} />, label: 'Events' },
    { icon: <SettingsIcon size={34} />, label: 'Settings' }
  ]

  const albums = [
    { id: 1, title: "Grandpa's 80th", type: 'Immediate Family Only', image: '/assets/grandpa_80.png' },
    { id: 2, title: "Summer of 65", type: 'Shared with Connections', image: '/assets/summer.png' },
    { id: 3, title: "Ancestral Wedding", type: 'Public Family Record', image: '/assets/wedding.png' }
  ]

  return (
    <div style={{ position: 'fixed', top: '140px', left: '40px', display: 'flex', gap: '25px', zIndex: 1000, height: 'calc(100vh - 200px)' }}>
      
      {/* 1. Icon Rail (COLOR: #FAEFBC) */}
      <nav style={{
        width: '110px',
        backgroundColor: '#FAEFBC', 
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        padding: '30px 0',
        border: '2px solid #2C1810',
        overflowY: 'auto'
      }}>
        {menuItems.map((item) => (
          <div
            key={item.label}
            onClick={() => setActiveTab(item.label)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '22px 0',
              cursor: 'pointer',
              backgroundColor: activeTab === item.label ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
              transition: 'all 0.3s ease',
              borderLeft: activeTab === item.label ? '5px solid #2C1810' : 'none'
            }}
          >
            <div style={{ color: '#2C1810', opacity: activeTab === item.label ? 1 : 0.7, marginBottom: '8px' }}>
              {item.icon}
            </div>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: '950', 
              color: '#2C1810',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </nav>

      {/* 2. Floating Content Panel (COLOR: #FAEFBC) */}
      {activeTab && activeTab !== 'My Tree' && (
        <div style={{
          width: '320px',
          backgroundColor: '#FAEFBC',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          padding: '35px',
          border: '2px solid #2C1810',
          animation: 'slideIn 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', alignItems: 'center' }}>
            <h3 style={{ fontSize: '22px', fontWeight: '950', color: '#2C1810', fontFamily: 'Playfair Display, serif', margin: 0 }}>{activeTab}</h3>
            <button onClick={() => setActiveTab(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={24} color="#2C1810" style={{ opacity: 0.7 }} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px' }}>
             {albums.map(album => (
                <div key={album.id} style={{ cursor: 'pointer' }}>
                   <div style={{ 
                     width: '100%', height: '150px', 
                     backgroundImage: `url(${album.image})`,
                     backgroundSize: 'cover', backgroundPosition: 'center',
                     borderRadius: '18px',
                     border: '1.5px solid #2C1810', 
                     boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                     transition: 'transform 0.2s ease'
                   }} />
                   <p style={{ fontSize: '15px', fontWeight: '900', color: '#2C1810', marginTop: '12px', marginBottom: '4px' }}>
                     {album.title}
                   </p>
                   <p style={{ fontSize: '12px', color: '#2C1810', fontWeight: '800', opacity: 0.8 }}>{album.type}</p>
                </div>
             ))}
          </div>
        </div>
      )}
    </div>
  )
}
