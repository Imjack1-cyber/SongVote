'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { clientLogger } from '@/lib/clientLogger';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Send crash report to server
    clientLogger.error('React Error Boundary Caught Crash', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
    });
  }

  public handleReset = () => {
      this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
        if (this.props.fallback) return this.props.fallback;

        return (
            <div className="p-6 border border-red-200 bg-red-50 rounded-xl text-center text-red-800">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <h3 className="font-bold mb-1">Component Crashed</h3>
                <p className="text-xs opacity-70 mb-4">{this.state.error?.message || "Unknown error"}</p>
                <button 
                    onClick={this.handleReset}
                    className="px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition flex items-center gap-2 mx-auto"
                >
                    <RefreshCw className="w-4 h-4" /> Try Reloading
                </button>
            </div>
        );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;