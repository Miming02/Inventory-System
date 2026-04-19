import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-6">
          <div className="max-w-md rounded-xl border border-error/30 bg-surface p-6 shadow-lg">
            <h1 className="text-lg font-bold text-error mb-2">Something went wrong</h1>
            <p className="text-sm text-on-surface-variant mb-4">
              The application hit an unexpected error. You can reload the page or return to the
              dashboard.
            </p>
            {this.state.error?.message ? (
              <pre className="text-xs bg-surface-variant/30 p-3 rounded-lg overflow-auto mb-4 whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            ) : null}
            <button
              type="button"
              className="rounded-lg bg-primary text-on-primary px-4 py-2 text-sm font-semibold"
              onClick={() => window.location.assign("/")}
            >
              Go to home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
