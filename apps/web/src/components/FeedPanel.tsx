'use client'

import React, { useEffect, useState } from 'react'
import { X, Calendar, Heart, Trash2, Plus, MessageCircle, Edit3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FeedActivity } from '@/lib/types'
import AddStoryModal from './AddStoryModal'

export default function FeedPanel() {
  const [stories, setStories] = useState<FeedActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingStory, setEditingStory] = useState<any>(null)
  const [reactions, setReactions] = useState<Record<string, Record<string, boolean>>>({})
  const [showComments, setShowComments] = useState<Record<string, boolean>>({})
  const [commentText, setCommentText] = useState<Record<string, string>>({})
  const [storyComments, setStoryComments] = useState<Record<string, any[]>>({})
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({})

  // THE MASTER TREE ID
  const TREE_ID = '00000000-0000-0000-0000-000000000001'

  const fetchReactions = async () => {
    try {
      const { data } = await supabase.from('story_reactions').select('*')
      const counts: Record<string, Record<string, number>> = {}
      data?.forEach(r => {
        if (!counts[r.story_id]) counts[r.story_id] = {}
        counts[r.story_id][r.reaction_type] = r.count
      })
      setReactionCounts(counts)
    } catch (err) {
      console.error('Error fetching reactions:', err)
    }
  }

  const fetchStories = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('tree_id', TREE_ID)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const mapped: FeedActivity[] = (data || []).map((a: any) => ({
        id: a.id,
        treeId: a.tree_id,
        activityType: a.type,
        title: a.title,
        description: a.description,
        imageUrl: a.image_url,
        metadata: a.metadata || {},
        privacy: a.privacy,
        createdAt: a.created_at
      }))

      setStories(mapped)
      fetchReactions()
    } catch (err) {
      console.error('Error fetching stories:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStories()
  }, [])

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta historia para siempre?')) return
    try {
      const { error } = await supabase.from('activities').delete().eq('id', id)
      if (error) throw error
      fetchStories()
    } catch (err) {
      alert('Error al eliminar')
    }
  }

  const toggleReaction = async (storyId: string, type: string) => {
    const isAdding = !reactions[storyId]?.[type]
    
    // 1. Optimistic Update
    setReactions(prev => {
      const storyR = prev[storyId] || {}
      return { ...prev, [storyId]: { ...storyR, [type]: isAdding } }
    })
    
    const currentCount = reactionCounts[storyId]?.[type] || 0
    const newCount = isAdding ? currentCount + 1 : Math.max(0, currentCount - 1)

    setReactionCounts(prev => ({
      ...prev,
      [storyId]: { ...(prev[storyId] || {}), [type]: newCount }
    }))

    // 2. Persist to story_reactions table
    try {
      await supabase
        .from('story_reactions')
        .upsert({ story_id: storyId, reaction_type: type, count: newCount }, { onConflict: 'story_id, reaction_type' })
    } catch (err) {
      console.error('Error persisting reaction:', err)
    }
  }

  const fetchComments = async (storyId: string) => {
    try {
      const { data } = await supabase
        .from('story_comments')
        .select('*')
        .eq('story_id', storyId)
        .order('created_at', { ascending: true })
      setStoryComments(prev => ({ ...prev, [storyId]: data || [] }))
    } catch (err) {
      console.error('Error fetching comments:', err)
    }
  }

  const handleAddComment = async (storyId: string) => {
    const text = commentText[storyId] || ''
    if (!text.trim() || text.length > 200) return

    try {
      const { error } = await supabase
        .from('story_comments')
        .insert({ story_id: storyId, content: text.trim(), author_name: 'Familiar' })
      
      if (error) throw error
      
      setCommentText(prev => ({ ...prev, [storyId]: '' }))
      fetchComments(storyId)
    } catch (err) {
      console.error('Error adding comment:', err)
    }
  }

  const toggleComments = (storyId: string) => {
    const isOpen = !showComments[storyId]
    setShowComments(prev => ({ ...prev, [storyId]: isOpen }))
    if (isOpen) fetchComments(storyId)
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h3 style={titleStyle}>Family Stories</h3>
          <p style={subtitleStyle}>Compartiendo nuestro legado</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={addButtonStyle}>
          <Plus size={20} />
        </button>
      </div>

      {/* Stories List */}
      <div style={scrollAreaStyle}>
        {loading ? (
          <p style={statusTextStyle}>Cargando historias...</p>
        ) : stories.length === 0 ? (
          <div style={emptyStateStyle}>
             <p>Aún no hay historias.</p>
             <button onClick={() => setShowAddModal(true)} style={emptyButtonStyle}>¡Crea la primera!</button>
          </div>
        ) : (
          stories.map(story => (
            <div key={story.id} style={{...cardStyle, overflow: 'visible', marginBottom: '10px'}}>
              {story.imageUrl && (
                <div style={{...imageContainerStyle, height: '140px', borderRadius: '20px 20px 0 0', backgroundImage: `url(${story.imageUrl})`}}>
                  <div style={badgeStyle}>{story.metadata?.year || 'Recuerdo'}</div>
                </div>
              )}
              
              <div style={{...cardBodyStyle, backgroundColor: '#FFF', borderRadius: story.imageUrl ? '0 0 20px 20px' : '20px', borderTop: '1px solid rgba(0,0,0,0.05)'}}>
                <div style={cardHeaderStyle}>
                  <h4 style={cardTitleStyle}>{story.title || 'Historia Familiar'}</h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setEditingStory({
                        id: story.id,
                        title: (story.title || '').split(' (')[0],
                        year: (story.title || '').match(/\((.*?)\)/)?.[1] || '',
                        description: story.description,
                        imageUrl: story.imageUrl
                      })} 
                      style={editBtnStyle}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete(story.id)} style={deleteBtnStyle}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <p style={{...cardDescStyle, fontSize: '14px', margin: 0}}>{story.description || 'Compartiendo un momento especial...'}</p>
                </div>
                
                <div style={{...cardFooterStyle, borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px'}}>
                  <div style={reactionGroupStyle}>
                    {/* Multi-Reacciones */}
                    <button onClick={() => toggleReaction(story.id, 'heart')} style={{...actionBtnStyle, gap: '4px'}}>
                      <Heart size={18} fill={reactions[story.id]?.heart ? '#FF4B2B' : 'none'} color={reactions[story.id]?.heart ? '#FF4B2B' : '#2C1810'} />
                      <span style={{fontSize: '12px', fontWeight: '900'}}>{reactionCounts[story.id]?.heart || 0}</span>
                    </button>
                    <button onClick={() => toggleReaction(story.id, 'laugh')} style={{...actionBtnStyle, gap: '4px', opacity: reactions[story.id]?.laugh ? 1 : 0.4}}>
                      <span style={{fontSize: '18px'}}>😂</span>
                      <span style={{fontSize: '12px', fontWeight: '900'}}>{reactionCounts[story.id]?.laugh || 0}</span>
                    </button>
                    <button onClick={() => toggleReaction(story.id, 'wow')} style={{...actionBtnStyle, gap: '4px', opacity: reactions[story.id]?.wow ? 1 : 0.4}}>
                      <span style={{fontSize: '18px'}}>😮</span>
                      <span style={{fontSize: '12px', fontWeight: '900'}}>{reactionCounts[story.id]?.wow || 0}</span>
                    </button>
                    <button onClick={() => toggleComments(story.id)} style={{...actionBtnStyle, opacity: showComments[story.id] ? 1 : 0.4}}>
                      <MessageCircle size={18} />
                      {storyComments[story.id]?.length > 0 && <span style={{fontSize: '11px', fontWeight: 'bold'}}>{storyComments[story.id].length}</span>}
                    </button>
                  </div>
                  <span style={dateTextStyle}>{new Date(story.createdAt).toLocaleDateString()}</span>
                </div>

                {/* SECCIÓN DE COMENTARIOS */}
                {showComments[story.id] && (
                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                      {storyComments[story.id]?.map((c: any) => (
                        <div key={c.id} style={{ backgroundColor: 'rgba(0,0,0,0.03)', padding: '8px 12px', borderRadius: '12px', fontSize: '12px' }}>
                          <span style={{ fontWeight: 'bold', display: 'block', fontSize: '10px', opacity: 0.5 }}>{c.author_name}</span>
                          {c.content}
                        </div>
                      ))}
                    </div>

                    <div style={{ position: 'relative' }}>
                      <textarea 
                        value={commentText[story.id] || ''}
                        onChange={(e) => {
                          const text = e.target.value
                          if (text.length <= 200) {
                            setCommentText(prev => ({ ...prev, [story.id]: text }))
                          }
                        }}
                        placeholder="Escribe un comentario..."
                        style={{ 
                          width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', 
                          fontSize: '12px', resize: 'none', minHeight: '60px', backgroundColor: '#FFF'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                        <span style={{ fontSize: '10px', opacity: (commentText[story.id]?.length || 0) > 180 ? 1 : 0.4, color: (commentText[story.id]?.length || 0) >= 200 ? 'red' : 'inherit' }}>
                          {(commentText[story.id]?.length || 0)}/200
                        </span>
                        <button 
                          onClick={() => handleAddComment(story.id)}
                          disabled={!(commentText[story.id]?.trim())}
                          style={{ 
                            padding: '4px 12px', backgroundColor: '#2C1810', color: '#FAEFBC', border: 'none', 
                            borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                            opacity: (commentText[story.id]?.trim()) ? 1 : 0.5
                          }}
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL */}
      {(showAddModal || editingStory) && (
        <AddStoryModal 
          treeId={TREE_ID} 
          initialData={editingStory}
          onClose={() => {
            setShowAddModal(false)
            setEditingStory(null)
          }} 
          onSave={fetchStories} 
        />
      )}
    </div>
  )
}

// STYLES
const panelStyle: React.CSSProperties = {
  position: 'fixed', right: '20px', top: '160px', bottom: '40px', width: '300px',
  backgroundColor: '#FAEFBC', borderRadius: '32px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
  display: 'flex', flexDirection: 'column', zIndex: 1000, border: '2px solid #2C1810', overflow: 'hidden'
}

const headerStyle: React.CSSProperties = { 
  padding: '20px 25px', borderBottom: '1px solid rgba(44,24,16,0.1)', 
  display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
}
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'serif', fontSize: '20px', color: '#2C1810', fontWeight: '950' }
const subtitleStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: '11px', color: '#2C1810', opacity: 0.6, fontWeight: '700' }

const addButtonStyle: React.CSSProperties = {
  width: '38px', height: '38px', borderRadius: '12px', backgroundColor: '#2C1810', color: '#FAEFBC',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none',
  boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition: 'all 0.2s ease'
}

const scrollAreaStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }
const statusTextStyle: React.CSSProperties = { textAlign: 'center', fontSize: '13px', opacity: 0.6, marginTop: '20px' }
const emptyStateStyle: React.CSSProperties = { textAlign: 'center', padding: '40px 20px', opacity: 0.7 }
const emptyButtonStyle: React.CSSProperties = { background: 'none', border: '1px solid #2C1810', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', marginTop: '10px' }

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(44,24,16,0.1)',
  boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
}

const imageContainerStyle: React.CSSProperties = {
  width: '100%', height: '160px', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative'
}

const badgeStyle: React.CSSProperties = {
  position: 'absolute', top: '12px', left: '12px', padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.9)',
  borderRadius: '10px', fontSize: '10px', fontWeight: '900', color: '#2C1810', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
}

const cardBodyStyle: React.CSSProperties = { padding: '16px' }
const cardHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }
const cardTitleStyle: React.CSSProperties = { margin: 0, fontSize: '16px', fontWeight: '900', color: '#2C1810', flex: 1 }
const deleteBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#FF4444', opacity: 0.4, padding: '2px' }
const editBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#2C1810', opacity: 0.4, padding: '2px' }

const cardDescStyle: React.CSSProperties = { fontSize: '13px', color: '#2C1810', opacity: 0.85, lineHeight: '1.4', margin: '0 0 16px 0', fontWeight: '600' }

const cardFooterStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }
const reactionGroupStyle: React.CSSProperties = { display: 'flex', gap: '15px' }
const actionBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2C1810', opacity: 0.8 }
const dateTextStyle: React.CSSProperties = { fontSize: '10px', opacity: 0.5, fontWeight: '700' }
