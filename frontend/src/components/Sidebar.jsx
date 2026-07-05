import React from 'react';
import { LayoutDashboard, CalendarDays, KanbanSquare, FolderKanban, BrainCircuit, Settings, RefreshCw, Plus, Keyboard } from 'lucide-react';

const KBD_STYLE = {
  fontSize: '10px',
  fontFamily: 'monospace',
  color: 'var(--text-muted)',
  background: 'var(--nav-active-bg)',
  borderRadius: '4px',
  padding: '2px 5px',
  marginLeft: 'auto',
  opacity: 0.7,
  border: '1px solid var(--glass-border)',
  lineHeight: 1,
};

export default function Sidebar({ currentView, onViewChange, onSyncPlanning, isSyncing, planningSyncEnabled = false, onRefresh, isRefreshing, views = [] }) {
  return (
    <aside 
      style={{
        width: '260px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--glass-border)',
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(20px)',
        padding: '24px 16px'
      }}
    >
      {/* Brand Logo */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '40px',
          paddingLeft: '8px'
        }}
      >
        <div 
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(190, 24, 242, 0.3)'
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#fff' }}>F</span>
        </div>
        <h1 
          style={{
            fontSize: '20px',
            fontWeight: '700',
            background: 'linear-gradient(90deg, #fff, var(--text-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em'
          }}
        >
          InTheFlow
        </h1>
      </div>

      {/* Navigation List */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
        <button
          onClick={() => onViewChange('dashboard')}
          className="interactive"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '10px 16px',
            border: 'none',
            borderRadius: '10px',
            backgroundColor: currentView === 'dashboard' ? 'var(--nav-active-bg)' : 'transparent',
            color: currentView === 'dashboard' ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            fontWeight: currentView === 'dashboard' ? '600' : '500',
            borderLeft: currentView === 'dashboard' ? '3px solid var(--accent-cyan)' : '3px solid transparent',
            outline: 'none'
          }}
        >
          <LayoutDashboard size={18} style={{ color: currentView === 'dashboard' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }} />
          Dashboard
          <span style={KBD_STYLE}>Alt+1</span>
        </button>

        <button
          onClick={() => onViewChange('ai-hub')}
          className="interactive"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '10px 16px',
            border: 'none',
            borderRadius: '10px',
            backgroundColor: currentView === 'ai-hub' ? 'var(--nav-active-bg)' : 'transparent',
            color: currentView === 'ai-hub' ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            fontWeight: currentView === 'ai-hub' ? '600' : '500',
            borderLeft: currentView === 'ai-hub' ? '3px solid var(--accent-cyan)' : '3px solid transparent',
            outline: 'none'
          }}
        >
          <BrainCircuit size={18} style={{ color: currentView === 'ai-hub' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }} />
          AI Flow Hub
          <span style={KBD_STYLE}>Alt+2</span>
        </button>

        <button
          onClick={() => onViewChange('calendar')}
          className="interactive"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '10px 16px',
            border: 'none',
            borderRadius: '10px',
            backgroundColor: currentView === 'calendar' ? 'var(--nav-active-bg)' : 'transparent',
            color: currentView === 'calendar' ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            fontWeight: currentView === 'calendar' ? '600' : '500',
            borderLeft: currentView === 'calendar' ? '3px solid var(--accent-cyan)' : '3px solid transparent',
            outline: 'none'
          }}
        >
          <CalendarDays size={18} style={{ color: currentView === 'calendar' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }} />
          Calendar
          <span style={KBD_STYLE}>Alt+3</span>
        </button>

        {/* Dynamic Views Section */}
        <div style={{ marginTop: '16px', marginBottom: '8px', padding: '0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>WORKSPACE VIEWS</span>
          <button 
            onClick={() => onViewChange('create-view-modal')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Create New View"
            className="interactive"
          >
            <Plus size={14} />
          </button>
        </div>

        {views.map((v) => {
          const isActive = currentView === v.id;
          const Icon = v.layout_type === 'board' ? KanbanSquare : FolderKanban;
          return (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className="interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                borderRadius: '10px',
                backgroundColor: isActive ? 'var(--nav-active-bg)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '500',
                borderLeft: isActive ? '3px solid var(--accent-cyan)' : '3px solid transparent',
                outline: 'none'
              }}
            >
              <Icon size={18} style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{v.name}</span>
            </button>
          );
        })}

        <div style={{ flex: 1 }}></div>

        <button
          onClick={() => onViewChange('settings')}
          className="interactive"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '10px 16px',
            border: 'none',
            borderRadius: '10px',
            backgroundColor: currentView === 'settings' ? 'var(--nav-active-bg)' : 'transparent',
            color: currentView === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            fontWeight: currentView === 'settings' ? '600' : '500',
            borderLeft: currentView === 'settings' ? '3px solid var(--accent-cyan)' : '3px solid transparent',
            outline: 'none'
          }}
        >
          <Settings size={18} style={{ color: currentView === 'settings' ? 'var(--accent-cyan)' : 'var(--text-secondary)' }} />
          Settings
          <span style={KBD_STYLE}>Alt+0</span>
        </button>
      </nav>

      {/* Manual Refresh Data */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="interactive"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          padding: '12px 16px',
          border: '1px solid var(--glass-border)',
          borderRadius: '10px',
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
          cursor: isRefreshing ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '8px',
          outline: 'none'
        }}
      >
        <RefreshCw size={18} style={{ animation: isRefreshing ? 'spin 1.5s linear infinite' : 'none' }} />
        {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
      </button>

      {/* Sync Planning — disabled when planning_sync_enabled=false (use weekly-planning-assistant CLI) */}
      {planningSyncEnabled && (
      <button
        onClick={onSyncPlanning}
        disabled={isSyncing}
        className="interactive"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          padding: '12px 16px',
          border: '1px solid var(--glass-border)',
          borderRadius: '10px',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          color: 'var(--accent-cyan)',
          cursor: isSyncing ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '16px',
          opacity: isSyncing ? 0.7 : 1,
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
      >
        <RefreshCw 
          size={18} 
          style={{ 
            animation: isSyncing ? 'spin 1.5s linear infinite' : 'none'
          }} 
        />
        {isSyncing ? 'Syncing...' : 'Sync Weekly Plan'}
      </button>
      )}

      {/* Footer Info */}
      <div 
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          textAlign: 'center',
          paddingTop: '16px',
          borderTop: '1px solid var(--glass-border)'
        }}
      >
        InTheFlow Workspace v1.0.0
      </div>
    </aside>
  );
}
