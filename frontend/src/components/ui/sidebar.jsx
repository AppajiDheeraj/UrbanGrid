import {
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [state, setState] = useState("expanded");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    const handleChange = () => setIsMobile(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleSidebar = () => {
    setState((prev) => (prev === "expanded" ? "collapsed" : "expanded"));
  };

  const value = useMemo(
    () => ({ state, toggleSidebar, isMobile }),
    [state, isMobile]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    return { state: "expanded", toggleSidebar: () => {}, isMobile: false };
  }
  return context;
}

function Slot({ children, className, ...props }) {
  if (!isValidElement(children)) return null;
  return cloneElement(children, {
    ...props,
    className: cn(children.props.className, className),
  });
}

export const Sidebar = forwardRef(({ className, ...props }, ref) => {
  const { state } = useSidebar();
  return (
    <aside
      ref={ref}
      className={cn(
        "relative flex flex-col overflow-visible border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        state === "collapsed" ? "w-20" : "w-72",
        className
      )}
      {...props}
    />
  );
});
Sidebar.displayName = "Sidebar";

export function SidebarHeader({ className, ...props }) {
  return <div className={cn("px-4 py-4", className)} {...props} />;
}

export function SidebarContent({ className, ...props }) {
  return <div className={cn("flex-1 overflow-y-auto", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }) {
  return <div className={cn("relative overflow-visible px-4 py-4", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }) {
  return <div className={cn("px-2", className)} {...props} />;
}

export function SidebarGroupContent({ className, ...props }) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }) {
  return <div className={cn("", className)} {...props} />;
}

export const SidebarMenuButton = forwardRef(
  ({ className, asChild = false, isActive = false, ...props }, ref) => {
    const classes = cn(
      "flex items-center gap-2 rounded-md px-3 text-sm text-sidebar-foreground transition hover:text-sidebar-foreground",
      isActive && "bg-white/10",
      className
    );

    if (asChild && props.children) {
      return <Slot className={classes} {...props} />;
    }

    return <button ref={ref} className={classes} {...props} />;
  }
);

SidebarMenuButton.displayName = "SidebarMenuButton";
