import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TaskModal from './components/TaskModal';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import KanbanBoard from './pages/KanbanBoard';
import Backlog from './pages/Backlog';
import AiHub from './pages/AiHub';
import Settings from './pages/Settings';
import api from './api';
import { applyTheme, getCachedTheme } from './utils/theme';
import { resolveGroupingColors, DEFAULT_GROUPING_COLORS } from './utils/groupingColors';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [views, setViews] = useState([]);
  const [groupingColors, setGroupingColors] = useState(DEFAULT_GROUPING_COLORS);
  const [theme, setTheme] = useState(() => getCachedTheme() || 'dark');
  const loadedSettingsRef = useRef({});
  
  // Dynamic active view states
  const [activeViewData, setActiveViewData] = useState(null);
  const [activeViewResult, setActiveViewResult] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [planningSyncEnabled, setPlanningSyncEnabled] = useState(false);
  const [showCreateViewModal, setShowCreateViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewLayout, setNewViewLayout] = useState('board');

  // Modal Editing State
  const [activeEditTask, setActiveEditTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Calendar orchestration (Feature 2 — local week fetch, not App.tasks)
  const [dailyTasksVersion, setDailyTasksVersion] = useState(0);
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(null);
  const incrementDailyTasksVersion = () => setDailyTasksVersion((v) => v + 1);

  const refreshData = async () => {
    try {
      setIsLoading(true);
      // Fetch dynamic views list
      const fetchedViews = await api.views.list();
      setViews(fetchedViews);
      
      // Fetch projects
      const fetchedProjects = await api.projects.list();
      setProjects(fetchedProjects);

      if (currentView === 'dashboard' || currentView === 'ai-hub' || currentView === 'settings') {
        const fetchedTasks = await api.tasks.list();
        setTasks(fetchedTasks);
      } else if (currentView === 'calendar') {
        // Calendar fetches daily tasks locally — only views/projects needed here
      } else {
        // Dynamic view execution (+ tasks for Settings grouping list / drag-drop fallback)
        const viewMeta = await api.views.get(currentView);
        const execResult = await api.views.execute(currentView);
        setActiveViewData(viewMeta);
        setActiveViewResult(execResult);
        const fetchedTasks = await api.tasks.list();
        setTasks(fetchedTasks);
      }
    } catch (e) {
      console.error("Failed to load workspace data", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentView]);

  useEffect(() => {
    async function loadAndReconcileTheme() {
      try {
        const settings = await api.settings.get();
        loadedSettingsRef.current = settings;
        const apiTheme = settings.theme === 'light' ? 'light' : 'dark';
        const cached = getCachedTheme();
        const effective = cached || apiTheme;
        const resolved = applyTheme(effective);
        setTheme(resolved);
        if (cached && cached !== apiTheme) {
          const reconciled = applyTheme(apiTheme);
          setTheme(reconciled);
        }
      } catch (e) {
        console.error('Failed to load settings for theme reconcile', e);
      }
    }
    loadAndReconcileTheme();
  }, []);

  const handleThemeChange = useCallback(async (mode) => {
    const resolved = applyTheme(mode);
    setTheme(resolved);
    try {
      await api.settings.update({ theme: resolved });
      loadedSettingsRef.current = { ...loadedSettingsRef.current, theme: resolved };
    } catch (e) {
      console.error('Failed to auto-save theme', e);
    }
  }, []);

  useEffect(() => {
    async function loadGroupingColors() {
      try {
        const settings = await api.settings.get();
        setGroupingColors(resolveGroupingColors(settings.task_grouping_colors));
        setPlanningSyncEnabled(settings.planning_sync_enabled === 'true');
      } catch (e) {
        console.error('Failed to load grouping colors', e);
      }
    }
    loadGroupingColors();
  }, []);

  const handleSyncPlanning = async () => {
    setIsSyncing(true);
    try {
      const res = await api.settings.syncPlanning();
      alert(
        `Weekly Plan Synced Successfully!\n\n` +
        `• File Parsed: ${res.file_parsed}\n` +
        `• Mode: ${res.parser_mode.toUpperCase()}\n` +
        `• Tasks Created: ${res.tasks_created}\n` +
        `• Tasks Updated: ${res.tasks_updated}\n` +
        `• Total Parsed: ${res.total_parsed}`
      );
      await refreshData();
    } catch (e) {
      console.error("Failed to sync weekly planning:", e);
      alert(`Failed to sync weekly planning: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditTask = (task) => {
    setActiveEditTask(task);
    setIsModalOpen(true);
  };

  const handleCreateTask = (defaults = {}) => {
    setActiveEditTask({
      name: '',
      description: '',
      status: 'backlog',
      category: defaults.category || 'business',
      project_id: '',
      owner: 'Alice',
      task_grouping: 'General',
      estimated_duration: 60,
      current_duration: 0,
      ...defaults
    });
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskData) => {
    try {
      if (taskData.id) {
        await api.tasks.update(taskData.id, taskData);
      } else {
        await api.tasks.create(taskData);
      }
      setIsModalOpen(false);
      setActiveEditTask(null);
      refreshData();
    } catch (e) {
      console.error("Error saving task:", e);
      alert("Failed to save task details.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.tasks.delete(taskId);
      setIsModalOpen(false);
      setActiveEditTask(null);
      refreshData();
    } catch (e) {
      console.error("Error deleting task:", e);
      alert("Failed to delete task.");
    }
  };

  const handleNavigateToCalendar = (date) => {
    setCalendarAnchorDate(date);
    setCurrentView('calendar');
    setIsModalOpen(false);
    setActiveEditTask(null);
  };

  // View settings actions
  const handleUpdateViewConfig = async (newConfig) => {
    try {
      await api.views.updateConfig(currentView, newConfig);
      refreshData();
    } catch (e) {
      console.error("Error updating view settings:", e);
    }
  };

  const handleDeleteView = async () => {
    if (confirm("Are you sure you want to delete this custom view?")) {
      try {
        await api.views.delete(currentView);
        setCurrentView('dashboard');
      } catch (e) {
        console.error("Error deleting view:", e);
      }
    }
  };

  const handleCreateViewSubmit = async (e) => {
    e.preventDefault();
    if (!newViewName.trim()) return;

    try {
      const res = await api.views.create({
        name: newViewName,
        layout_type: newViewLayout
      });
      setNewViewName('');
      setShowCreateViewModal(false);
      setCurrentView(res.id);
    } catch (e) {
      console.error("Error creating custom view:", e);
      alert("Failed to create custom view.");
    }
  };

  const renderActiveView = () => {
    // Calendar uses local loading — render before global isLoading gate
    if (currentView === 'calendar') {
      return (
        <Calendar
          projects={projects}
          groupingColors={groupingColors}
          calendarAnchorDate={calendarAnchorDate}
          dailyTasksVersion={dailyTasksVersion}
          onDailyTasksChange={incrementDailyTasksVersion}
          onEditTask={handleEditTask}
          onViewChange={setCurrentView}
        />
      );
    }

    if (isLoading) {
      return (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div className="spinner" />
        </div>
      );
    }

    // Static Views
    if (currentView === 'dashboard') {
      return (
        <Dashboard 
          tasks={tasks} 
          projects={projects} 
          onRefresh={refreshData} 
          onEditTask={handleEditTask}
        />
      );
    } else if (currentView === 'ai-hub') {
      return <AiHub onRefresh={refreshData} />;
    } else if (currentView === 'settings') {
      return (
        <Settings
          tasks={tasks}
          groupingColors={groupingColors}
          onGroupingColorsChange={setGroupingColors}
          theme={theme}
          onThemeChange={handleThemeChange}
          onRefresh={refreshData}
        />
      );
    }

    // Dynamic views render
    if (!activeViewData) return <div>Failed to load view settings.</div>;

    if (activeViewData.layout_type === 'board') {
      return (
        <KanbanBoard 
          tasks={tasks}
          projects={projects}
          groupingColors={groupingColors}
          onRefresh={refreshData}
          onEditTask={handleEditTask}
          onCreateTask={handleCreateTask}
          activeView={activeViewData}
          properties={activeViewData.properties}
          viewResult={activeViewResult}
          onUpdateConfig={handleUpdateViewConfig}
          onDeleteView={handleDeleteView}
        />
      );
    } else {
      // Table & list layouts
      return (
        <Backlog 
          tasks={tasks}
          projects={projects}
          onRefresh={refreshData}
          onEditTask={handleEditTask}
          onCreateTask={handleCreateTask}
          activeView={activeViewData}
          properties={activeViewData.properties}
          viewResult={activeViewResult}
          onUpdateConfig={handleUpdateViewConfig}
          onDeleteView={handleDeleteView}
        />
      );
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Sidebar Navigation */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={(viewId) => {
          if (viewId === 'create-view-modal') {
            setShowCreateViewModal(true);
          } else {
            setCurrentView(viewId);
          }
        }} 
        onSyncPlanning={handleSyncPlanning}
        isSyncing={isSyncing}
        planningSyncEnabled={planningSyncEnabled}
        onRefresh={refreshData}
        isRefreshing={isLoading}
        views={views}
      />

      {/* Main View Container */}
      <main style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
        {renderActiveView()}
      </main>

      {/* View Creation Modal */}
      {showCreateViewModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'var(--modal-overlay)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            width: '400px', background: 'var(--modal-surface)', border: '1px solid var(--glass-border)',
            borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-glow)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Create Custom View</h3>
            
            <form onSubmit={handleCreateViewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>View Name</label>
                <input 
                  type="text" 
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="e.g. Dev Tasks Table..."
                  required
                  style={{
                    width: '100%', padding: '10px 12px', backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Layout Type</label>
                <select
                  value={newViewLayout}
                  onChange={(e) => setNewViewLayout(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
                  }}
                >
                  <option value="board">Kanban Board</option>
                  <option value="table">Table List</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowCreateViewModal(false)}
                  style={{
                    padding: '8px 16px', backgroundColor: 'var(--nav-active-bg)',
                    border: 'none', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{
                    padding: '8px 16px', backgroundColor: 'var(--accent-cyan)',
                    border: 'none', borderRadius: '6px', color: 'var(--bg-primary)', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Create View
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shared Task Modal */}
      {isModalOpen && (
        <TaskModal
          task={activeEditTask}
          projects={projects}
          onClose={() => {
            setIsModalOpen(false);
            setActiveEditTask(null);
          }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onNavigateToCalendar={handleNavigateToCalendar}
          onDailyTasksChange={incrementDailyTasksVersion}
        />
      )}
    </div>
  );
}
