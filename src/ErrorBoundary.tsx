import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200 max-w-lg w-full">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Algo salió mal</h2>
            <p className="text-zinc-600 mb-4">Ha ocurrido un error inesperado en la aplicación.</p>
            <pre className="bg-zinc-100 p-4 rounded-xl text-sm text-zinc-800 overflow-auto max-h-64">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-zinc-900 text-white py-2 rounded-xl hover:bg-zinc-800 transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
