/** Own landing listeners and observers across route changes and StrictMode. */
export function createLandingLifetime() {
  const cleanups: Array<() => void> = [];
  let disposed = false;
  return {
    get disposed() { return disposed; },
    add(cleanup: () => void) { cleanups.push(cleanup); },
    on(target: EventTarget, type: string, listener: EventListener, options?: boolean | AddEventListenerOptions) {
      target.addEventListener(type, listener, options);
      cleanups.push(() => target.removeEventListener(type, listener, options));
    },
    observe<T extends { disconnect(): void }>(observer: T): T {
      cleanups.push(() => observer.disconnect());
      return observer;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cleanup of cleanups.reverse()) cleanup();
      cleanups.length = 0;
    },
  };
}
