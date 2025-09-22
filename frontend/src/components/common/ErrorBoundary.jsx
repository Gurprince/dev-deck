import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI ErrorBoundary:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-6">
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm opacity-80 mb-4">{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button onClick={this.handleRetry} className="px-4 py-2 rounded bg-indigo-600 text-white">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;


