'use client'

import React, { useState } from 'react'
import type { Member } from '@/lib/types'
import { Home, TreePine, Users, Image as ImageIcon, Calendar, Settings as SettingsIcon, X } from 'lucide-react'
import NetworkPanel from '@/components/NetworkPanel'
import EventsPanel from '@/components/EventsPanel'

interface SidebarProps {
  bgOpacity: number
  onOpacityChange: (val: number) => void
  members: Member[]
  treeId: string
  activeTab: string | null
  onTabChange: (tab: string | null) => void
  onInviteMember: (member: Member) => void
}

export default function Sidebar({ bgOpacity, onOpacityChange, members, treeId, activeTab, onTabChange, onInviteMember }: SidebarProps) {

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
      
      <style>{`
        @keyframes matrixPulse {
          0% { opacity: 0.4; text-shadow: 0 0 2px rgba(0, 255, 65, 0.4); }
          50% { opacity: 1; text-shadow: 0 0 8px rgba(0, 255, 65, 0.8); }
          100% { opacity: 0.4; text-shadow: 0 0 2px rgba(0, 255, 65, 0.4); }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '15px' }}>
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
          overflowY: 'auto',
          flex: 1
        }}>
          {menuItems.map((item) => (
            <div
              key={item.label}
              onClick={() => onTabChange(item.label)}
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

        {/* SECURE SYSTEM LEGEND (Below container, no border, single line) */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '8px',
          padding: '0 5px',
          marginTop: '5px'
        }}>
          <div style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            backgroundColor: '#00FF41',
            animation: 'matrixPulse 2s infinite'
          }} />
          <span style={{
            color: '#00FF41',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            animation: 'matrixPulse 2s infinite'
          }}>
            SECURE SYSTEM
          </span>
        </div>
      </div>

      {/* 2. Floating Content Panel (COLOR: #FAEFBC) */}
      {activeTab && activeTab !== 'My Tree' && activeTab !== 'Home' && activeTab !== 'Photo Albums' && activeTab !== 'Network' && activeTab !== 'Events' && (
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
            <button onClick={() => onTabChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={24} color="#2C1810" style={{ opacity: 0.7 }} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px' }}>

             {/* 🖼️ PHOTO ALBUMS */}
             {activeTab === 'Photo Albums' && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                 {albums.map(album => (
                    <div key={album.id} style={{ cursor: 'pointer' }}>
                       <div style={{ 
                         width: '100%', height: '150px', 
                         backgroundImage: `url(${album.image})`,
                         backgroundSize: 'cover', backgroundPosition: 'center',
                         borderRadius: '18px',
                         border: '1.5px solid #2C1810', 
                         boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                       }} />
                       <p style={{ fontSize: '15px', fontWeight: '900', color: '#2C1810', marginTop: '12px', marginBottom: '4px' }}>
                         {album.title}
                       </p>
                       <p style={{ fontSize: '12px', color: '#2C1810', fontWeight: '800', opacity: 0.8 }}>{album.type}</p>
                    </div>
                 ))}
               </div>
             )}

             {/* 📅 EVENTS — rendered outside in dedicated panel */}

             {/* 🔗 NETWORK — intentionally empty here, rendered outside the panel below */}

             {/* ⚙️ SETTINGS */}
             {activeTab === 'Settings' && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                 {/* Section: Identity */}
                 <div>
                   <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2C1810', opacity: 0.6, marginBottom: '15px' }}>
                     Tree Identity
                   </h4>
                   <div style={{ backgroundColor: 'rgba(255,255,255,0.4)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(44,24,16,0.05)' }}>
                     <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '900', color: '#2C1810' }}>Display Name</p>
                     <input 
                       type="text" 
                       defaultValue="AppleTree Family" 
                       style={{ 
                         width: '100%', background: 'white', border: '1.5px solid rgba(44,24,16,0.2)', 
                         borderRadius: '10px', padding: '10px', fontSize: '14px', color: '#2C1810', fontWeight: '700',
                         outline: 'none'
                       }} 
                     />
                   </div>
                 </div>

                 {/* Section: Privacy */}
                 <div>
                   <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2C1810', opacity: 0.6, marginBottom: '15px' }}>
                     Privacy & Security
                   </h4>
                   <div style={{ backgroundColor: 'rgba(255,255,255,0.4)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(44,24,16,0.05)' }}>
                     <select style={{ 
                       width: '100%', background: 'white', border: '1.5px solid rgba(44,24,16,0.2)', 
                       borderRadius: '10px', padding: '10px', fontSize: '14px', color: '#2C1810', fontWeight: '700',
                       outline: 'none'
                     }}>
                       <option>🔒 Private (Only Me)</option>
                       <option>👥 Family Only (Collaborators)</option>
                       <option>🌐 Public Legacy (Visible to All)</option>
                     </select>
                   </div>
                 </div>

                 {/* Section: Appearance */}
                 <div>
                   <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2C1810', opacity: 0.6, marginBottom: '15px' }}>
                     Visual Experience
                   </h4>
                   <div style={{ backgroundColor: 'rgba(255,255,255,0.4)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(44,24,16,0.05)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#2C1810' }}>Background Opacity</span>
                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#2C1810', opacity: 0.5 }}>{Math.round(bgOpacity * 100)}%</span>
                     </div>
                     <input 
                        type="range" min="0" max="100" 
                        value={bgOpacity * 100} 
                        onChange={(e) => onOpacityChange(parseInt(e.target.value) / 100)}
                        style={{ width: '100%', accentColor: '#2C1810' }} 
                     />
                   </div>
                 </div>

                 {/* Save Button */}
                 <button 
                   onClick={() => onTabChange(null)}
                   style={{
                     width: '100%', padding: '15px', backgroundColor: '#2C1810', color: '#FAEFBC',
                     borderRadius: '15px', border: 'none', fontSize: '14px', fontWeight: '950',
                     textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                     boxShadow: '0 10px 20px rgba(44,24,16,0.2)', marginTop: '10px'
                   }}
                 >
                   Save Configuration
                 </button>
               </div>
             )}
          </div>
        </div>
      )}

      {/* 📅 EVENTS — Dedicated panel */}
      {activeTab === 'Events' && (
        <div style={{
          width: '320px',
          backgroundColor: '#FAEFBC',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          padding: '25px 28px 28px',
          border: '2px solid #2C1810',
          animation: 'slideIn 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 200px)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px', alignItems: 'center' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '950', color: '#2C1810', fontFamily: 'Playfair Display, serif', margin: 0 }}>
              Calendario Familiar
            </h3>
            <button onClick={() => onTabChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={22} color="#2C1810" style={{ opacity: 0.7 }} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <EventsPanel members={members} treeId={treeId} />
          </div>
        </div>
      )}

      {/* 🔗 NETWORK — Dedicated wide panel */}
      {activeTab === 'Network' && (
        <div style={{
          width: '320px',
          backgroundColor: '#FAEFBC',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          padding: '25px 28px 28px',
          border: '2px solid #2C1810',
          animation: 'slideIn 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 200px)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px', alignItems: 'center' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '950', color: '#2C1810', fontFamily: 'Playfair Display, serif', margin: 0 }}>
              Red Familiar
            </h3>
            <button onClick={() => onTabChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={22} color="#2C1810" style={{ opacity: 0.7 }} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <NetworkPanel members={members} onInviteMember={onInviteMember} />
          </div>
        </div>
      )}
    </div>
  )
}

// ESTILOS DE ESTADÍSTICAS
const statCardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(44,24,16,0.05)',
  padding: '15px',
  borderRadius: '16px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  border: '1px solid rgba(44,24,16,0.1)'
}

const statValueStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '900',
  color: '#2C1810'
}

const statLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: '900',
  textTransform: 'uppercase',
  color: '#2C1810',
  opacity: 0.6,
  letterSpacing: '0.05em'
}
