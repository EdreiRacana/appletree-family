'use client'

import React from 'react'
import { Member } from '@/lib/types'
import { Users, TreePine, Star, PieChart, TrendingUp, Calendar, MapPin, Award } from 'lucide-react'

interface HomeDashboardProps {
  members: Member[]
}

export default function HomeDashboard({ members }: HomeDashboardProps) {
  const totalMembers = members.length
  const generations = members.length > 0 ? Math.max(...members.map(m => m.generation || 0)) - Math.min(...members.map(m => m.generation || 0)) + 1 : 0
  const males = members.filter(m => m.gender === 'male').length
  const females = members.filter(m => m.gender === 'female').length
  const completeness = Math.round((members.filter(m => m.biography).length / (totalMembers || 1)) * 100)
  const babies = members.filter(m => m.is_baby).length
  
  // Stats by generation
  const genCounts = members.reduce((acc, m) => {
    const gen = m.generation || 0
    acc[gen] = (acc[gen] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: '40px',
      overflowY: 'auto',
      backgroundColor: 'rgba(27, 46, 27, 0.8)',
      backdropFilter: 'blur(10px)',
      color: '#FAEFBC',
      display: 'flex',
      flexDirection: 'column',
      gap: '30px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '42px', fontFamily: 'serif', margin: 0, color: '#F2D241' }}>Panel de Control Familiar</h2>
          <p style={{ opacity: 0.7, fontSize: '18px', margin: '5px 0 0' }}>Estadísticas en tiempo real del legado AppleTree</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', opacity: 0.5, textTransform: 'uppercase' }}>Actualizado hace un momento</span>
        </div>
      </div>

      {/* Hero Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <StatCard 
          icon={<Users size={28} />} 
          label="Censo Total" 
          value={totalMembers} 
          subValue={`${babies} menores`}
          color="#F2D241"
        />
        <StatCard 
          icon={<TreePine size={28} />} 
          label="Profundidad" 
          value={generations} 
          subValue="Generaciones"
          color="#4CAF50"
        />
        <StatCard 
          icon={<PieChart size={28} />} 
          label="Géneros" 
          value={`${males}:${females}`} 
          subValue="Hombres vs Mujeres"
          color="#4A90E2"
        />
        <StatCard 
          icon={<Award size={28} />} 
          label="Completitud" 
          value={`${completeness}%`} 
          subValue="Historias redactadas"
          color="#FF9800"
        />
      </div>

      {/* Middle Section: Charts and Lists */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', flex: 1 }}>
        
        {/* Generational Distribution */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <TrendingUp size={20} />
            <h3 style={{ margin: 0 }}>Distribución Generacional</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '15px', height: '200px', padding: '20px 0' }}>
            {Object.keys(genCounts).sort().map((gen) => (
              <div key={gen} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '100%', 
                  height: `${(genCounts[Number(gen)] / (totalMembers || 1)) * 100}%`, 
                  backgroundColor: '#F2D241', 
                  borderRadius: '8px 8px 0 0',
                  minHeight: '20px',
                  transition: 'height 1s ease-out'
                }} />
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Gen {gen}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Milestones */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <Star size={20} />
            <h3 style={{ margin: 0 }}>Hitos Recientes</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <MilestoneItem date="Hoy" text="Se agregó a Mateo Pérez" />
            <MilestoneItem date="Ayer" text="Nueva biografía de Santos López" />
            <MilestoneItem date="24 Oct" text="Cumpleaños de Elena Racana" />
          </div>
        </div>
      </div>

      {/* Footer Quote */}
      <div style={{ 
        textAlign: 'center', 
        padding: '40px', 
        borderTop: '1px solid rgba(250, 239, 188, 0.1)',
        fontStyle: 'italic',
        opacity: 0.6
      }}>
        "El pasado es la base del futuro. Cultivamos hoy para que otros cosechen mañana."
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, subValue, color }: any) {
  return (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      padding: '25px',
      borderRadius: '24px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      transition: 'transform 0.2s ease',
      cursor: 'default'
    }}>
      <div style={{ color, marginBottom: '5px' }}>{icon}</div>
      <span style={{ fontSize: '14px', fontWeight: 'bold', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '36px', fontWeight: '900', color: '#FFF' }}>{value}</span>
      <span style={{ fontSize: '13px', opacity: 0.5 }}>{subValue}</span>
    </div>
  )
}

function MilestoneItem({ date, text }: any) {
  return (
    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
      <div style={{ fontSize: '11px', fontWeight: '900', color: '#F2D241', width: '45px' }}>{date}</div>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(250, 239, 188, 0.3)' }} />
      <div style={{ fontSize: '14px', opacity: 0.8 }}>{text}</div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  padding: '30px',
  borderRadius: '28px',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px'
}

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: '18px',
  fontFamily: 'serif',
  opacity: 0.9,
  color: '#F2D241'
}
