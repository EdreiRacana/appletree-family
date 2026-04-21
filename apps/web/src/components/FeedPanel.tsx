'use client'

import React from 'react'
import { X, Calendar, MapPin, Heart, Share2, Camera } from 'lucide-react'

export default function FeedPanel() {
  const events = [
    { 
      id: 1, 
      title: 'Boda de los Abuelos', 
      year: '1942', 
      desc: 'El inicio de nuestra gran historia en la catedral.',
      image: '/assets/wedding.png'
    },
    { 
      id: 2, 
      title: 'Verano en el Lago', 
      year: '1965', 
      desc: 'Recuerdos inolvidables de las vacaciones.',
      image: '/assets/summer.png'
    },
    { 
      id: 3, 
      title: '80 Aniversario', 
      year: '1945', 
      desc: 'Una celebración que reunió a tres generaciones.',
      image: '/assets/grandpa_80.png'
    }
  ]

  return (
    <div style={{
      position: 'fixed',
      right: '40px',
      top: '140px',
      bottom: '40px',
      width: '330px',
      // USER'S NEW PALE CREAM TONE
      backgroundColor: '#FAEFBC', 
      borderRadius: '24px',
      boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
      padding: '30px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      zIndex: 1000,
      border: '2px solid #2C1810',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ 
          fontSize: '24px', 
          fontWeight: '950', 
          color: '#2C1810', 
          fontFamily: 'Playfair Display, serif',
          margin: 0 
        }}>
          Chronicles
        </h3>
        <X size={22} color="#2C1810" style={{ cursor: 'pointer', opacity: 0.7 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {events.map(event => (
          <div key={event.id} style={{
            backgroundColor: 'rgba(255, 255, 255, 0.4)', // Very subtle highlight on cream
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1.5px solid rgba(0,0,0,0.06)',
            transition: 'transform 0.3s ease'
          }}>
            <div style={{
              width: '100%',
              height: '140px',
              backgroundImage: `url(${event.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderBottom: '2px solid #2C1810'
            }} />

            <div style={{ padding: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Calendar size={14} color="#2C1810" />
                <span style={{ fontSize: '12px', fontWeight: '900', color: '#2C1810' }}>{event.year}</span>
              </div>
              <h4 style={{ fontSize: '17px', fontWeight: '900', color: '#2C1810', margin: '0 0 8px 0' }}>{event.title}</h4>
              <p style={{ fontSize: '13px', color: '#2C1810', opacity: 0.9, margin: 0, lineHeight: '1.3', fontWeight: '600' }}>{event.desc}</p>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px', opacity: 0.7 }}>
                <MapPin size={14} color="#2C1810" />
                <Heart size={14} color="#2C1810" />
                <Camera size={14} color="#2C1810" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
