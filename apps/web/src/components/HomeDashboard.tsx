'use client'

import React from 'react'
import { Member } from '@/lib/types'
import { Users, TreePine, Star, PieChart, TrendingUp, Award } from 'lucide-react'

interface HomeDashboardProps {
  members: Member[]
  onViewTree: () => void
}

export default function HomeDashboard({ members, onViewTree }: HomeDashboardProps) {
  const totalMembers = members.length
  const generations = members.length > 0 ? Math.max(...members.map(m => m.generation || 0)) - Math.min(...members.map(m => m.generation || 0)) + 1 : 0
  const males = members.filter(m => m.gender === 'male').length
  const females = members.filter(m => m.gender === 'female').length
  const completeness = Math.round((members.filter(m => m.biography).length / (totalMembers || 1)) * 100)
  
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
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      padding: '40px 0 40px 150px', // Shifted to the left, respecting sidebar rail
      pointerEvents: 'none' // Allow interaction with the tree behind if not on the panel
    }}>
      <div style={{
        width: '400px', // Smaller width
        backgroundColor: '#FAEFBC',
        borderRadius: '32px',
        border: '3px solid #2C1810',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '25px',
        maxHeight: 'calc(100vh - 250px)',
        overflowY: 'auto',
        pointerEvents: 'auto' // Re-enable pointer events for the panel itself
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', fontFamily: 'serif', margin: 0, color: '#2C1810', fontWeight: '950' }}>
            Resumen Familiar
          </h2>
          <p style={{ color: '#2C1810', opacity: 0.6, fontSize: '13px', fontWeight: '800', marginTop: '5px' }}>
            Legado AppleTree
          </p>
        </div>

        {/* Hero Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
          <StatCard 
            icon={<Users size={20} />} 
            label="Integrantes" 
            value={totalMembers} 
            color="#2C1810"
          />
          <StatCard 
            icon={<TreePine size={20} />} 
            label="Gens" 
            value={generations} 
            color="#2C1810"
          />
          <StatCard 
            icon={<PieChart size={20} />} 
            label="H/M" 
            value={`${males}/${females}`} 
            color="#2C1810"
          />
          <StatCard 
            icon={<Award size={20} />} 
            label="Bio" 
            value={`${completeness}%`} 
            color="#2C1810"
          />
        </div>

        {/* Charts Section */}
        <div style={{ 
          backgroundColor: 'rgba(44, 24, 16, 0.05)', 
          padding: '20px', 
          borderRadius: '20px',
          border: '1px solid rgba(44, 24, 16, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
            <TrendingUp size={16} color="#2C1810" />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: '#2C1810' }}>Densidad</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '80px' }}>
            {Object.keys(genCounts).sort().map((gen) => (
              <div key={gen} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <div style={{ 
                  width: '100%', 
                  height: `${(genCounts[Number(gen)] / (totalMembers || 1)) * 100}%`, 
                  backgroundColor: '#2C1810', 
                  borderRadius: '3px',
                  minHeight: '5px'
                }} />
                <span style={{ fontSize: '9px', fontWeight: '900', color: '#2C1810' }}>G{gen}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <button 
          onClick={onViewTree}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: '#2C1810',
            color: '#FAEFBC',
            borderRadius: '15px',
            border: 'none',
            fontSize: '14px',
            fontWeight: '950',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 8px 20px rgba(44, 24, 16, 0.2)'
          }}
        >
          <TreePine size={20} />
          Explorar Árbol
        </button>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: any) {
  return (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      padding: '12px',
      borderRadius: '16px',
      border: '1px solid rgba(44, 24, 16, 0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{ 
        width: '36px', 
        height: '36px', 
        borderRadius: '10px', 
        backgroundColor: '#2C1810', 
        color: '#FAEFBC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </div>
      <div>
        <span style={{ fontSize: '9px', fontWeight: '900', opacity: 0.5, textTransform: 'uppercase', display: 'block', color: '#2C1810' }}>{label}</span>
        <span style={{ fontSize: '18px', fontWeight: '950', color: '#2C1810' }}>{value}</span>
      </div>
    </div>
  )
}
