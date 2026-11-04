import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  tabName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class TabErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[TabErrorBoundary] Erreur interceptée dans l'onglet :", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center my-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 mb-3 border border-amber-500/30">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-100">
            Une micro-coupure est survenue lors de l'affichage de cette section
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            Le reste du Cockpit demeure 100% opérationnel. Vous pouvez réinitialiser l'affichage de cet onglet ci-dessous.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-200 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Réafficher cette section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
