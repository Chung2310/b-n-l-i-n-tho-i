import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { pathToTab, tabToPath } from "../seo/seo-config";
import type { TabType } from "../types";
import { DEFAULT_APP_TAB } from "./route-config";
import { isTabHidden } from "../config/modules";

/** Tab bị ẩn (kể cả khi gõ URL trực tiếp) → đưa về tab mặc định */
function resolveTabFromPath(pathname: string): TabType {
  const tab = pathToTab(pathname) || DEFAULT_APP_TAB;
  return isTabHidden(tab) ? DEFAULT_APP_TAB : tab;
}

function resolveInitialTab() {
  const tab = resolveTabFromPath(window.location.pathname);
  console.log(`[useTabRouter] resolveInitialTab: pathname="${window.location.pathname}", resolvedTab="${tab}"`);
  return tab;
}

export function useTabRouter(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [routerState, setRouterState] = useState(() => ({
    activeTab: resolveInitialTab(),
    enabled,
    pathname: window.location.pathname,
  }));
  const activeTab = enabled && (!routerState.enabled || routerState.pathname !== window.location.pathname)
    ? resolveTabFromPath(window.location.pathname)
    : routerState.activeTab;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const wasEnabled = useRef(false);

  const setActiveTab = useCallback((action: SetStateAction<TabType>) => {
    const nextTab = typeof action === "function" ? action(activeTabRef.current) : action;
    activeTabRef.current = nextTab;
    setRouterState({ activeTab: nextTab, enabled, pathname: window.location.pathname });
  }, [enabled]);

  console.log(`[useTabRouter] Render: activeTab="${activeTab}", enabled=${enabled}, pathname="${window.location.pathname}"`);

  useEffect(() => {
    if (!enabled) return;

    const handlePopState = () => {
      const tab = resolveTabFromPath(window.location.pathname);
      console.log(`[useTabRouter] handlePopState: pathname="${window.location.pathname}", resolvedTab="${tab}"`);
      activeTabRef.current = tab;
      setRouterState({ activeTab: tab, enabled: true, pathname: window.location.pathname });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enabled]);

  useEffect(() => {
    const justEnabled = enabled && !wasEnabled.current;
    wasEnabled.current = enabled;
    if (!enabled) return;
    // On re-entry from a standalone route, let the URL-to-tab effect finish first.
    if (justEnabled && activeTab !== resolveTabFromPath(window.location.pathname)) return;

    const nextPath = tabToPath(activeTab);
    console.log(`[useTabRouter] Sync Path Effect: activeTab="${activeTab}", currentPath="${window.location.pathname}", nextPath="${nextPath}"`);
    if (window.location.pathname !== nextPath) {
      console.log(`[useTabRouter] Pushing state to nextPath="${nextPath}"`);
      window.history.pushState(null, "", nextPath);
      window.dispatchEvent(new Event("popstate"));
    }
  }, [activeTab, enabled]);

  return {
    activeTab,
    setActiveTab,
  };
}
