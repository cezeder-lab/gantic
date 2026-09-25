import { useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { getElectronAPI } from '../../lib/electronBridge';
import { importLocalProjects, joinWorkspace, leaveWorkspace } from '../../lib/sync/engine';

const sectionTitle = 'mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500';
const input =
  'w-full rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2.5 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300';
const button =
  'rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50';

export function WorkspaceSettings() {
  const workspace = useGanticStore((s) => s.workspace);
  const workspaceName = useGanticStore((s) => s.workspaceName);
  const syncMessage = useGanticStore((s) => s.syncMessage);
  const displayName = useGanticStore((s) => s.displayName);
  const setDisplayName = useGanticStore((s) => s.setDisplayName);
  const projects = useGanticStore((s) => s.projects);
  const localSnapshot = useGanticStore((s) => s.localSnapshot);
  const unsent = useGanticStore((s) => s.unsentSyncLines.length);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const api = getElectronAPI();
  if (!api) return null;

  const importable = localSnapshot
    ? localSnapshot.projects.filter((p) => !projects.some((wp) => wp.id === p.id)).length
    : 0;

  async function handleJoin() {
    if (!api) return;
    setError(null);
    const folder = await api.wsChoose();
    if (!folder) return;
    setBusy(true);
    try {
      const err = await joinWorkspace(folder, displayName, email);
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (unsent > 0 && !confirm(`${unsent} change(s) haven't reached the shared folder yet and will be lost. Leave anyway?`)) return;
    if (unsent === 0 && !confirm('Leave the team workspace? Your own local projects will come back; the team projects stay in the shared folder.')) return;
    await leaveWorkspace();
  }

  async function handleImport() {
    setBusy(true);
    try {
      setImported(await importLocalProjects());
    } finally {
      setBusy(false);
    }
  }

  const emailValid = /^[^\s@]+@[^\s@]+$/.test(email.trim());

  return (
    <section className="mb-6">
      <h3 className={sectionTitle}>Team workspace</h3>
      {!workspace ? (
        <>
          <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
            Share projects live with your team through any folder everyone can reach (a synced SharePoint/Teams
            folder, a network drive…). Every change is logged with who made it.
          </p>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className={input} />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email (your ID)"
              className={input}
            />
          </div>
          <button onClick={handleJoin} disabled={busy || !displayName.trim() || !emailValid} className={button}>
            {busy ? 'Connecting…' : 'Choose shared folder & join…'}
          </button>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Picking an empty folder creates a new workspace; picking one a teammate already uses joins it. Your own
            projects on this computer are kept aside and come back if you leave.
          </p>
        </>
      ) : (
        <>
          <p className="mb-1 text-sm text-gray-700 dark:text-gray-200">
            {workspaceName ?? 'Team workspace'} — signed in as <strong>{workspace.userName}</strong>{' '}
            <span className="text-gray-400 dark:text-gray-500">({workspace.userId})</span>
          </p>
          <p
            className="mb-2 truncate rounded-md border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300"
            title={workspace.folder}
          >
            {workspace.folder}
          </p>
          {syncMessage && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{syncMessage}</p>}
          <div className="flex flex-wrap gap-2">
            {importable > 0 && (
              <button onClick={handleImport} disabled={busy} className={button}>
                Copy my {importable} local project{importable > 1 ? 's' : ''} into the workspace
              </button>
            )}
            <button onClick={handleLeave} className={button}>
              Leave workspace
            </button>
          </div>
          {imported !== null && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              {imported} project{imported === 1 ? '' : 's'} added — you're their admin.
            </p>
          )}
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
