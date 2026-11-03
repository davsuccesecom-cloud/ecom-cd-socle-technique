import React, { Component, type ErrorInfo, type ReactNode } from "react";
import WariTrackLogo from "./WariTrackLogo";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[WariTrack ErrorBoundary] Uncaught runtime exception:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Storage clear error:", e);
    }
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#07090F] px-4 py-8 text-white select-none">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0E131F]/90 p-6 shadow-2xl backdrop-blur-xl text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <WariTrackLogo size="md" variant="full" roundedBadge subtitle="LOGISTICS OS" />
            </div>

            {/* Status indicator */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-300 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              Synchronisation interrompue
            </div>

            <h1 className="text-lg font-bold text-slate-100 mb-2">
              Micro-coupure ou actualisation requise
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Une coupure temporaire de connexion réseau ou une mise à jour d'application a interrompu l'affichage. Vos données sont préservées en toute sécurité.
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] transition"
              >
                <svg className="w-4 h-4 animate-spin-reverse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Recharger le Cockpit
              </button>

              <button
                type="button"
                onClick={this.handleHardReset}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                Réinitialiser la session
              </button>
            </div>

            {/* Technical details in folded details */}
            {this.state.error && (
              <details className="mt-5 text-left text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
                <summary className="cursor-pointer hover:text-slate-400 select-none">
                  Détails techniques (incident de rendu)
                </summary>
                <div className="mt-2 rounded-lg bg-black/40 p-2.5 font-mono text-[10px] text-rose-300 break-words whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {this.state.error.toString()}
                  {"\n"}
                  {this.state.errorInfo?.componentStack}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
