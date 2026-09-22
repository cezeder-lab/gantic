import { useGanticStore } from '../store/useGanticStore';
import { getElectronAPI } from '../lib/electronBridge';

export function UpdateBanner() {
  const updateStatus = useGanticStore((s) => s.updateStatus);
  const setUpdateStatus = useGanticStore((s) => s.setUpdateStatus);

  if (!updateStatus || updateStatus.status !== 'downloaded') return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900 dark:bg-gray-700 px-4 py-2 text-sm text-white shadow-xl">
        <span>
          Update {updateStatus.version ? `v${updateStatus.version} ` : ''}downloaded — restart to install
        </span>
        <button
          onClick={() => getElectronAPI()?.quitAndInstallUpdate()}
          className="font-semibold text-[#8fb0ff] hover:text-white"
        >
          Restart now
        </button>
        <button
          onClick={() => setUpdateStatus(null)}
          className="text-gray-400 dark:text-gray-500 hover:text-white"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
