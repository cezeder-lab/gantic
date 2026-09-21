import { useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { ProjectSidebar } from './components/Sidebar/ProjectSidebar';
import { Toolbar } from './components/Toolbar';
import { TaskTable } from './components/TaskTable/TaskTable';
import { GanttChart } from './components/Gantt/GanttChart';
import { BulkActionBar } from './components/TaskTable/BulkActionBar';
import { TaskDetailPanel } from './components/TaskDetail/TaskDetailPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { DashboardView } from './components/Dashboard/DashboardView';
import { useGanticStore } from './store/useGanticStore';
import { computeGanttRange } from './lib/ganttRange';
import { dayWidth, diffDays, todayISO } from './lib/dates';
import type { ZoomLevel } from './types';

function App() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const exportRootRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const scrollLeftRef = useRef(0);

  const activeProjectId = useGanticStore((s) => s.activeProjectId);
  const viewMode = useGanticStore((s) => s.viewMode);
  const tasks = useGanticStore((s) => s.tasks);
  const zoom = useGanticStore((s) => s.zoom);
  const project = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const undo = useGanticStore((s) => s.undo);
  const redo = useGanticStore((s) => s.redo);
  const setFitToScreen = useGanticStore((s) => s.setFitToScreen);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod || e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;

      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

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
                <GanttChart ref={rightRef} onScroll={handleRightScroll} scrollLeftRef={scrollLeftRef} />
                <BulkActionBar />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-gray-400">
                Select or create a project to get started.
              </div>
            )}
          </>
        )}
      </div>
      <TaskDetailPanel />
      <SettingsPanel />
    </div>
  );
}

export default App;
