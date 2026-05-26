"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  title: string;
};

type State = {
  hasError: boolean;
};

export class ChartErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Chart render failed for ${this.props.title}`, error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-amber-300 bg-amber-50 px-6 text-center text-sm text-amber-900">
          הגרף &quot;{this.props.title}&quot; לא נטען בדפדפן הזה.
        </div>
      );
    }
    return this.props.children;
  }
}
