'use client'

import React from 'react'
import { Search, Bell, User, Plus, Share2, Settings } from 'lucide-react'

interface TopbarProps {
  onAdd?: () => void
}

export default function Topbar({ onAdd }: TopbarProps) {
  return (
    <header style={{
      height: '140px',
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      backgroundColor: '#0F1A0F',
      backgroundImage: 'linear-gradient(to right, #0F1A0F 0%, #1B2E1B 50%, #254025 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 30px', // REDUCED LEFT/RIGHT PADDING TO MOVE LEFT
      zIndex: 2000,
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      borderBottom: '3px solid #D4AF37'
    }}>
      {/* 1. ICON-FIRST BRANDING - LEFT ALIGNED & SYMMETRICAL */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        <div style={{ 
          height: '70px',
          width: 'auto',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center'
        }}>
          <img 
            src="/assets/logo.png" 
            alt="AppleTree Family Logo" 
            style={{ 
              height: '100%', 
              width: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2px' }}>
          <h1 style={{ 
            fontSize: '18px', 
            fontWeight: '900', 
            background: 'linear-gradient(180deg, #E8DAB2 0%, #C5A059 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: 'Playfair Display, serif',
            margin: 0,
            letterSpacing: '0.04em',
            lineHeight: 1,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            textAlign: 'center',
            textTransform: 'uppercase'
          }}>
            AppleFamily Tree
          </h1>
          <span style={{ 
            fontSize: '9px', 
            color: '#E8DAB2', 
            fontFamily: 'Playfair Display, serif',
            fontStyle: 'italic',
            opacity: 0.8, 
            marginTop: '2px',
            lineHeight: '1',
            display: 'block',
            letterSpacing: '0.01em',
            textAlign: 'center',
            fontWeight: '400'
          }}>
            Cultivating Your Roots, Celebrating Your Legacy
          </span>
        </div>
      </div>

      {/* 2. Global Navigation */}
      <div style={{ 
        flex: 1, 
        maxWidth: '650px', 
        height: '58px',
        backgroundColor: 'rgba(232, 218, 183, 0.12)',
        backdropFilter: 'blur(20px)',
        borderRadius: '18px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 30px',
        border: '2px solid rgba(212, 175, 55, 0.25)',
        margin: '0 60px'
      }}>
        <Search size={22} color="#F5E6C8" style={{ opacity: 0.6 }} />
        <input 
          type="text" 
          placeholder="Look up family members..." 
          style={{
            background: 'none', border: 'none', outline: 'none', color: '#F5E6C8',
            fontSize: '17px', marginLeft: '20px', width: '100%', fontWeight: '700'
          }}
        />
        <Settings size={22} color="#F5E6C8" style={{ opacity: 0.6, cursor: 'pointer' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
        <button 
          className="topbar-btn" 
          onClick={onAdd}
          style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '15px' }}
        >
          <Plus size={30} color="#F5E6C8" />
        </button>
        <button className="topbar-btn" style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '15px' }}>
          <User size={30} color="#F5E6C8" />
        </button>
        <div style={{ position: 'relative' }}>
          <Bell size={32} color="#D4AF37" />
          <div style={{ 
            position: 'absolute', top: '-5px', right: '-5px', 
            width: '16px', height: '16px', background: '#FF4B2B', 
            borderRadius: '50%', color: 'white', fontSize: '10px', 
            fontWeight: '950', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>3</div>
        </div>
      </div>
    </header>
  )
}
