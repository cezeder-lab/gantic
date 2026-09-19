import { useRef } from 'react';
import { ProjectSidebar } from './components/Sidebar/ProjectSidebar';
import { Toolbar } from './components/Toolbar';
import { TaskTable } from './components/TaskTable/TaskTable';
import { GanttChart } from './components/Gantt/GanttChart';
import { useGanticStore } from './store/useGanticStore';
import { computeGanttRange } from './lib/ganttRange';
import { dayWidth, diffDays, todayISO } from './lib/dates';

function App() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const scrollLeftRef = useRef(0);

  const activeProjectId = useGanticStore((s) => s.activeProjectId);
  const tasks = useGanticStore((s) => s.tasks);
  const zoom = useGanticStore((s) => s.zoom);

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-800">
      <ProjectSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar onScrollToday={scrollToToday} />
        {activeProjectId ? (
          <div className="flex min-h-0 flex-1">
            <TaskTable ref={leftRef} onScroll={handleLeftScroll} />
            <GanttChart ref={rightRef} onScroll={handleRightScroll} scrollLeftRef={scrollLeftRef} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            Sélectionnez ou créez un projet pour commencer.
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
