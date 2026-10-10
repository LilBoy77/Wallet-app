import { SHARED_APP_NAME } from '@wallet-app/shared';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-6 font-bold text-xl">
          W
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          {SHARED_APP_NAME} — scaffold
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Phase 1: Project bootstrap, environment, and tooling successfully initialized.
        </p>
        <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-500 font-mono">
          Dev Server &amp; Monorepo Wiring Active
        </div>
      </div>
    </div>
  );
}
