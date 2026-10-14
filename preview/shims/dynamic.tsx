// Stand-in for next/dynamic in the single-file preview: the same lazy component, with React's own tools.
import { lazy, Suspense, type ComponentType } from "react";

export default function dynamic<P extends object>(load: () => Promise<ComponentType<P> | { default: ComponentType<P> }>, options?: { loading?: () => React.ReactNode; ssr?: boolean }) {
  const Lazy = lazy(() => load().then((m) => ({ default: ("default" in m ? m.default : m) as ComponentType<P> })));
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={options?.loading?.() ?? null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
