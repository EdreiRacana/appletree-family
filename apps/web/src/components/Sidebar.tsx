'use client'

import React, { useState } from 'react'
import type { Member } from '@/lib/types'
import { Home, TreePine, Users, Image as ImageIcon, Calendar, Settings as SettingsIcon, X, PieChart, Info, Star } from 'lucide-react'

interface SidebarProps {
  bgOpacity: number
  onOpacityChange: (val: number) => void
  members: Member[]
}

export default function Sidebar({ bgOpacity, onOpacityChange, members }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<string | null>('Home')

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
             {/* 🏠 HOME - Family Dashboard */}
             {activeTab === 'Home' && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 {/* Greeting */}
                 <div style={{ backgroundColor: '#2C1810', padding: '20px', borderRadius: '20px', color: '#FAEFBC', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                   <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Dashboard</p>
                   <h4 style={{ margin: '5px 0 0', fontSize: '20px', fontFamily: 'serif' }}>Estado del Árbol</h4>
                 </div>

                 {/* Statistics Cards */}
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                   <div style={statCardStyle}>
                     <span style={statValueStyle}>{members.length}</span>
                     <span style={statLabelStyle}>Integrantes</span>
                   </div>
                   <div style={statCardStyle}>
                     <span style={statValueStyle}>
                       {(() => {
                         const gens = members.map(m => m.generation || 0)
                         return gens.length > 0 ? Math.max(...gens) - Math.min(...gens) + 1 : 0
                       })()}
                     </span>
                     <span style={statLabelStyle}>Generaciones</span>
                   </div>
                 </div>

                 {/* Gender Split */}
                 <div style={{ ...statCardStyle, width: '100%', textAlign: 'left' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                     <span style={statLabelStyle}>Distribución de Género</span>
                     <PieChart size={14} opacity={0.5} />
                   </div>
                   <div style={{ height: '10px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                     {(() => {
                       const men = members.filter(m => m.gender === 'male').length
                       const women = members.filter(m => m.gender === 'female').length
                       const total = men + women || 1
                       return (
                         <>
                           <div style={{ width: `${(men/total)*100}%`, backgroundColor: '#4A90E2' }} />
                           <div style={{ width: `${(women/total)*100}%`, backgroundColor: '#E24A90' }} />
                         </>
                       )
                     })()}
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', fontWeight: '900' }}>
                     <span style={{ color: '#4A90E2' }}>Hombres: {members.filter(m => m.gender === 'male').length}</span>
                     <span style={{ color: '#E24A90' }}>Mujeres: {members.filter(m => m.gender === 'female').length}</span>
                   </div>
                 </div>

                 {/* Tree Quality / Health */}
                 <div style={{ ...statCardStyle, width: '100%', backgroundColor: 'rgba(212, 130, 42, 0.1)' }}>
                   <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                     <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: '#D4822A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                       <Star size={24} />
                     </div>
                     <div>
                       <span style={statLabelStyle}>Completitud del Legado</span>
                       <span style={{ display: 'block', fontSize: '18px', fontWeight: '900', color: '#2C1810' }}>
                         {Math.round((members.filter(m => m.biography).length / (members.length || 1)) * 100)}%
                       </span>
                     </div>
                   </div>
                 </div>

                 <p style={{ fontSize: '11px', color: '#2C1810', opacity: 0.5, fontStyle: 'italic', textAlign: 'center' }}>
                   "Una familia sin historias es como un árbol sin raíces."
                 </p>
               </div>
             )}

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

             {/* 📅 EVENTS */}
             {activeTab === 'Events' && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                 {[
                   { date: 'Oct 24', name: 'Grandma Maria', type: 'Birthday' },
                   { date: 'Nov 12', name: 'Perez Family', type: 'Anniversary' }
                 ].map((event, i) => (
                   <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0', borderBottom: '1px solid rgba(44,24,16,0.1)' }}>
                     <div style={{ backgroundColor: '#2C1810', color: '#FAEFBC', padding: '8px', borderRadius: '8px', minWidth: '50px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '10px', fontWeight: '900' }}>{event.date.split(' ')[0]}</p>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '900' }}>{event.date.split(' ')[1]}</p>
                     </div>
                     <div>
                       <p style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: '#2C1810' }}>{event.name}</p>
                       <p style={{ margin: 0, fontSize: '11px', color: '#2C1810', opacity: 0.6 }}>{event.type}</p>
                     </div>
                   </div>
                 ))}
               </div>
             )}

             {/* 🔗 NETWORK */}
             {activeTab === 'Network' && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 <input 
                   type="text" 
                   placeholder="Search family name..." 
                   style={{
                     width: '100%', padding: '12px 15px', borderRadius: '12px',
                     border: '1.5px solid rgba(44,24,16,0.2)', backgroundColor: 'rgba(44,24,16,0.03)',
                     color: '#2C1810', fontSize: '13px', fontWeight: '700', outline: 'none'
                   }}
                 />
                 <div>
                   <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2C1810', opacity: 0.6, marginBottom: '15px' }}>
                     Tree Collaborators
                   </h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                     {[
                       { name: 'Elena Racana', role: 'Editor', status: 'Online', avatar: 'https://i.pravatar.cc/150?u=elena' },
                       { name: 'Carlos Perez', role: 'Viewer', status: 'Away', avatar: 'https://i.pravatar.cc/150?u=carlos' }
                     ].map((user, i) => (
                       <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '14px', border: '1px solid rgba(44,24,16,0.05)' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                           <div style={{ width: '35px', height: '35px', borderRadius: '50%', border: '2px solid #2C1810', overflow: 'hidden' }}>
                             <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                           </div>
                           <div>
                             <p style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#2C1810' }}>{user.name}</p>
                             <p style={{ margin: 0, fontSize: '10px', color: '#2C1810', opacity: 0.6 }}>{user.role}</p>
                           </div>
                         </div>
                         <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: user.status === 'Online' ? '#4CAF50' : '#FFC107' }} />
                       </div>
                     ))}
                   </div>
                 </div>
                 <div style={{ padding: '15px', backgroundColor: '#2C1810', borderRadius: '15px', color: '#FAEFBC' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800' }}>Uncle Roberto wants to connect his tree.</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button style={{ flex: 1, padding: '6px', borderRadius: '8px', backgroundColor: '#FAEFBC', color: '#2C1810', border: 'none', fontSize: '11px', fontWeight: '950', cursor: 'pointer' }}>Accept</button>
                    </div>
                 </div>
               </div>
             )}

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
                   onClick={() => setActiveTab(null)}
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
