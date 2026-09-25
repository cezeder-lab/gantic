import { useEffect, useState } from 'react';
import { useGanticStore } from '../store/useGanticStore';

const LATE_NIGHT = [
  'You should probably go to sleep xD',
  'The Gantt chart will still be here tomorrow 🌙',
  'Burning the midnight oil{who}?',
  'Even deadlines sleep at night 😴',
  'Night owl mode: activated 🦉',
];

const EVENING_EXTRA = [
  'Still working{who}? 👀',
  "Don't forget dinner{who} 🍝",
  'Wrapping up soon{who}?',
  'Overtime again{who}? ⏰',
  'The planning never sleeps… but you should 🛋️',
];

// Same message for the whole hour, so it doesn't flicker on every re-render.
function pick(list: string[], now: Date): string {
  const hourIndex = Math.floor(now.getTime() / 3_600_000);
  return list[hourIndex % list.length];
}

function greetingFor(now: Date, name: string): string {
  const first = name.trim().split(/\s+/)[0];
  const who = first ? `, ${first}` : '';
  const h = now.getHours();
  let text: string;
  if (h < 6) text = pick(LATE_NIGHT, now);
  else if (h < 7) text = 'Early bird{who}? ☕';
  else if (h < 12) text = 'Good morning{who}';
  else if (h < 18) text = 'Good afternoon{who}';
  else if (h < 19) text = 'Good evening{who}';
  else if (h < 21) text = pick(EVENING_EXTRA, now);
  else text = 'Good evening{who} 🌙';
  return text.replace('{who}', who);
}

export function Greeting() {
  const workspaceName = useGanticStore((s) => s.workspace?.userName);
  const displayName = useGanticStore((s) => s.displayName);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="truncate px-4 py-2 text-xs text-gray-400 dark:text-gray-500" title={now.toLocaleTimeString()}>
      {greetingFor(now, workspaceName || displayName)}
    </p>
  );
}
