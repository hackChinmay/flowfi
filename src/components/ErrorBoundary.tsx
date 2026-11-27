import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/errorHandler";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError(error, {
      componentStack: errorInfo.componentStack?.slice(0, 300),
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="glass-card rounded-3xl p-6 max-w-sm w-full text-center space-y-4 border border-border shadow-2xl animate-fade-in-up">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                An unexpected interface error occurred. Your financial records and account balances remain secure.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={this.handleReset}
                className="w-full h-10 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold gap-2"
              >
                <RefreshCw size={14} />
                Try Again
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={this.handleReload}
                  className="flex-1 h-9 rounded-xl text-xs font-medium"
                >
                  Reload Page
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex-1 h-9 rounded-xl text-xs font-medium gap-1"
                >
                  <Home size={13} />
                  Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
