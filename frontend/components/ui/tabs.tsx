import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
  idBase: string;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

/** Keep tab values safe for use in DOM ids (values are app-defined strings). */
function toIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function Tabs({
  value,
  onValueChange,
  defaultValue,
  className,
  children,
  ...props
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [tabValue, setTabValue] = React.useState(defaultValue ?? "");
  const current = value !== undefined ? value : tabValue;
  const change = onValueChange ?? setTabValue;
  const idBase = React.useId();

  return (
    <TabsContext.Provider value={{ value: current, onValueChange: change, idBase }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex h-10 min-h-11 lg:min-h-10 items-center justify-center rounded-md bg-surface-subtle p-1 text-text-muted",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  className,
  children,
  onKeyDown,
  ...props
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(TabsContext);
  const isSelected = ctx?.value === value;
  const tabId = ctx ? `${ctx.idBase}-tab-${toIdPart(value)}` : undefined;
  const panelId = ctx ? `${ctx.idBase}-panel-${toIdPart(value)}` : undefined;

  /** WAI-ARIA APG Tabs, automatic activation: ArrowLeft/Right wrap among enabled
   *  tabs, Home/End jump to first/last. Selection follows focus. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !ctx) return;
    const tablist = event.currentTarget.closest('[role="tablist"]');
    if (!tablist) return;
    const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')).filter(
      (tab) => !tab.disabled
    );
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex === -1 || tabs.length === 0) return;

    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else nextIndex = tabs.length - 1;

    const nextTab = tabs[nextIndex];
    if (!nextTab || nextIndex === currentIndex) return;
    event.preventDefault();
    nextTab.focus();
    const nextValue = nextTab.dataset.value;
    if (nextValue !== undefined) ctx.onValueChange(nextValue);
  }

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      data-value={value}
      aria-selected={isSelected}
      // Inactive panels are unmounted, so only point aria-controls at an existing panel.
      aria-controls={isSelected ? panelId : undefined}
      tabIndex={isSelected ? 0 : -1}
      onKeyDown={handleKeyDown}
      onClick={() => ctx?.onValueChange(value)}
      className={cn(
        "inline-flex min-h-11 lg:min-h-9 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        isSelected
          ? "bg-surface text-text-primary shadow-xs"
          : "text-text-secondary hover:text-text-primary",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(TabsContext);
  if (ctx?.value !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${ctx.idBase}-panel-${toIdPart(value)}`}
      aria-labelledby={`${ctx.idBase}-tab-${toIdPart(value)}`}
      tabIndex={0}
      className={cn(
        "mt-2 ring-offset-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
