import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { ProjectSidebar } from './components/Sidebar/ProjectSidebar';
import { Toolbar } from './components/Toolbar';
import { TaskTable } from './components/TaskTable/TaskTable';
import { GanttChart } from './components/Gantt/GanttChart';
import { ResizeHandle } from './components/ResizeHandle';
import { BulkActionBar } from './components/TaskTable/BulkActionBar';
import { TaskDetailPanel } from './components/TaskDetail/TaskDetailPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { DashboardView } from './components/Dashboard/DashboardView';
import { Toast } from './components/Toast';
import { HelpPanel } from './components/HelpPanel';
import { GlobalSearch } from './components/GlobalSearch';
import { NotesPanel } from './components/NotesPanel';
import { useGanticStore } from './store/useGanticStore';
import { computeGanttRange } from './lib/ganttRange';
import { dayWidth, diffDays, todayISO } from './lib/dates';
import { pushBackup } from './lib/backup';
import { notify } from './lib/notifications';
import type { ZoomLevel } from './types';

const BACKUP_INTERVAL_MS = 15 * 60 * 1000;
const NOTIFICATION_CHECK_MS = 5 * 60 * 1000;

function App() {
  // The store's storage adapter reads asynchronously (a real file, via IPC,
  // when running in Electron) instead of synchronous localStorage, so the
  // very first render can briefly precede hydration — gate rendering on it
  // to avoid ever flashing the seeded demo project before real data loads.
  // Hydration starts the instant the store module is imported, independently
  // of this component's lifecycle, so it can finish before this effect even
  // subscribes — re-check on mount rather than trusting the render-time read.
  const [hydrated, setHydrated] = useState(() => useGanticStore.persist.hasHydrated());
  useEffect(() => {
    const unsubscribe = useGanticStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useGanticStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const exportRootRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const scrollLeftRef = useRef(0);

  const activeProjectId = useGanticStore((s) => s.activeProjectId);
  const viewMode = useGanticStore((s) => s.viewMode);
  const tasks = useGanticStore((s) => s.tasks);
  const projects = useGanticStore((s) => s.projects);
  const zoom = useGanticStore((s) => s.zoom);
  const project = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const undo = useGanticStore((s) => s.undo);
  const redo = useGanticStore((s) => s.redo);
  const setFitToScreen = useGanticStore((s) => s.setFitToScreen);
  const selectedTaskIds = useGanticStore((s) => s.selectedTaskIds);
  const selectedTaskId = useGanticStore((s) => s.selectedTaskId);
  const duplicateTask = useGanticStore((s) => s.duplicateTask);
  const bulkDeleteTasks = useGanticStore((s) => s.bulkDeleteTasks);
  const deleteTask = useGanticStore((s) => s.deleteTask);
  const clearSelection = useGanticStore((s) => s.clearSelection);
  const globalSearchOpen = useGanticStore((s) => s.globalSearchOpen);
  const setGlobalSearchOpen = useGanticStore((s) => s.setGlobalSearchOpen);
  const helpOpen = useGanticStore((s) => s.helpOpen);
  const setHelpOpen = useGanticStore((s) => s.setHelpOpen);
  const settingsOpen = useGanticStore((s) => s.settingsOpen);
  const setSettingsOpen = useGanticStore((s) => s.setSettingsOpen);
  const closeTaskDetails = useGanticStore((s) => s.closeTaskDetails);
  const notificationsEnabled = useGanticStore((s) => s.notificationsEnabled);
  const notesPanelOpen = useGanticStore((s) => s.notesPanelOpen);
  const setNotesPanelOpen = useGanticStore((s) => s.setNotesPanelOpen);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      const isMod = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape') {
        if (globalSearchOpen) setGlobalSearchOpen(false);
        else if (helpOpen) setHelpOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (notesPanelOpen) setNotesPanelOpen(false);
        else {
          closeTaskDetails();
          clearSelection();
        }
        return;
      }

      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }

      if (isTyping) return;

      if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (isMod && e.key.toLowerCase() === 'd') {
        if (selectedTaskId) {
          e.preventDefault();
          duplicateTask(selectedTaskId);
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const unlockedIds = selectedTaskIds.filter((id) => !tasks.find((t) => t.id === id)?.locked);
        if (unlockedIds.length === 0) return;
        e.preventDefault();
        if (unlockedIds.length > 1) bulkDeleteTasks(unlockedIds);
        else deleteTask(unlockedIds[0]);
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(!helpOpen);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    undo,
    redo,
    selectedTaskId,
    selectedTaskIds,
    tasks,
    duplicateTask,
    bulkDeleteTasks,
    deleteTask,
    clearSelection,
    closeTaskDetails,
    globalSearchOpen,
    setGlobalSearchOpen,
    helpOpen,
    setHelpOpen,
    settingsOpen,
    setSettingsOpen,
    notesPanelOpen,
    setNotesPanelOpen,
  ]);

  // Periodic local backup snapshot (desktop-friendly, works in-browser too).
  useEffect(() => {
    const tick = () => {
      const state = useGanticStore.getState();
      pushBackup(state.projects, state.tasks);
    };
    tick();
    const id = setInterval(tick, BACKUP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Native desktop notifications for tasks due today or already overdue.
  const notifiedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!notificationsEnabled) return;
    const check = () => {
      const today = todayISO();
      for (const t of tasks) {
        if (t.isMilestone === false && t.status === 'done') continue;
        if (notifiedRef.current.has(t.id)) continue;
        if (t.end <= today) {
          const project = projects.find((p) => p.id === t.projectId);
          notify(t.end < today ? 'Overdue task' : 'Due today', `${t.name} — ${project?.name ?? ''}`);
          notifiedRef.current.add(t.id);
        }
      }
    };
    check();
    const id = setInterval(check, NOTIFICATION_CHECK_MS);
    return () => clearInterval(id);
  }, [notificationsEnabled, tasks, projects]);

  const handleLeftScroll = (scrollTop: number) => {
    if (syncing.current) return;
    syncing.current = true;
    if (rightRef.current) rightRef.current.scrollTop = scrollTop;
    syncing.current = false;
  };

  const handleRightScroll = (scrollTop: number) => {
    if (syncing.current) return;
    syncing.current = true;
    if (leftRef.current) leftRef.current.scrollTop = scrollTop;
    syncing.current = false;
  };

  const scrollToToday = () => {
    const projectTasks = tasks.filter((t) => t.projectId === activeProjectId);
    const range = computeGanttRange(projectTasks, zoom);
    const pxPerDay = dayWidth(zoom);
    const todayX = diffDays(range.start, todayISO()) * pxPerDay;
    if (rightRef.current) {
      rightRef.current.scrollLeft = Math.max(0, todayX - rightRef.current.clientWidth / 2);
    }
  };

  const handleFitToScreen = () => {
    const projectTasks = tasks.filter((t) => t.projectId === activeProjectId);
    if (projectTasks.length === 0 || !rightRef.current) return;

    const minStart = projectTasks.reduce((m, t) => (t.start < m ? t.start : m), projectTasks[0].start);
    const maxEnd = projectTasks.reduce((m, t) => (t.end > m ? t.end : m), projectTasks[0].end);
    const spanDays = Math.max(1, diffDays(minStart, maxEnd));

    const bucket: ZoomLevel = spanDays <= 45 ? 'day' : spanDays <= 200 ? 'week' : 'month';
    const range = computeGanttRange(projectTasks, bucket);
    const availableWidth = Math.max(200, rightRef.current.clientWidth - 24);
    const pxPerDay = Math.min(60, Math.max(1.5, availableWidth / range.totalDays));

    setFitToScreen(bucket, pxPerDay);
  };

  const handleExportImage = async () => {
    if (!exportRootRef.current) return;
    const dataUrl = await toPng(exportRootRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${project?.name ?? 'gantic'}.png`;
    a.click();
  };

  if (!hydrated) {
    return <div className="flex h-screen w-screen items-center justify-center bg-white text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-800">
      <div className="print:hidden">
        <ProjectSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {viewMode === 'dashboard' ? (
          <DashboardView />
        ) : (
          <>
            <div className="print:hidden">
              <Toolbar
                onScrollToday={scrollToToday}
                onExportImage={handleExportImage}
                onFitToScreen={handleFitToScreen}
              />
            </div>
            {activeProjectId ? (
              <div id="print-root" ref={exportRootRef} className="relative flex min-h-0 flex-1">
                <TaskTable ref={leftRef} onScroll={handleLeftScroll} />
                <div className="flex h-full print:hidden">
                  <ResizeHandle />
                </div>
                <GanttChart ref={rightRef} onScroll={handleRightScroll} scrollLeftRef={scrollLeftRef} />
                <BulkActionBar />
              </div>
            ) : null}
            {activeProjectId && <NotesPanel />}
            {!activeProjectId && (
              <div className="flex flex-1 items-center justify-center text-gray-400">
                Select or create a project to get started.
              </div>
            )}
          </>
        )}
      </div>
      <TaskDetailPanel />
      <SettingsPanel />
      <HelpPanel />
      <GlobalSearch />
      <Toast />
    </div>
  );
}

export default App;
