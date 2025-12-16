import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server,
  Network,
  LayoutDashboard,
  HardDrive,
  Container,
  Database,
  Layers,
  Globe,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Users as UsersIcon,
  Settings, // THÊM DÒNG NÀY
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Định nghĩa menu items với cấu trúc cha/con
 */
interface MenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface MenuGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Infrastructure",
    icon: Server,
    items: [
      { label: "Hosts", path: "/admin/infrastructure/servers", icon: Server },
      { label: "Cluster Assign Hosts", path: "/admin/infrastructure/clusters", icon: Network },
      { label: "Cluster Setup", path: "/admin/infrastructure/cluster-setup", icon: Settings }, // THÊM DÒNG NÀY
    ],
  },
  {
    label: "Kubernetes Cluster",
    icon: LayoutDashboard,
    items: [
      { label: "Overview", path: "/admin/cluster/overview", icon: LayoutDashboard },
      { label: "Nodes", path: "/admin/cluster/nodes", icon: HardDrive },
      { label: "Namespace", path: "/admin/cluster/namespaces", icon: FolderOpen },
    ],
  },
  {
    label: "Workloads",
    icon: Container,
    items: [
      { label: "Deployments", path: "/admin/workloads/deployments", icon: Layers },
      { label: "Pods", path: "/admin/workloads/pods", icon: Container },
      { label: "Statefulset", path: "/admin/workloads/statefulsets", icon: Database },
    ],
  },
  {
    label: "Service Discovery",
    icon: Globe,
    items: [
      { label: "Services", path: "/admin/services", icon: Globe },
      { label: "Ingress", path: "/admin/ingress", icon: Layers },
    ],
  },
  {
    label: "Storage",
    icon: Database,
    items: [
      { label: "PVC", path: "/admin/storage/pvc", icon: FolderOpen },
      { label: "PV", path: "/admin/storage/pv", icon: HardDrive },
    ],
  },
  {
    label: "User Services",
    icon: UsersIcon,
    items: [
      { label: "Services", path: "/admin/users", icon: UsersIcon },
      { label: "Replica Requests", path: "/admin/users/replica-requests", icon: UsersIcon },
      { label: "Accounts", path: "/admin/accounts", icon: UsersIcon },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * Component Sidebar với menu điều hướng có menu cha/con
 */
export function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    const currentPath = location.pathname;
    const group = menuGroups.find((g) =>
      g.items.some((item) => item.path === currentPath)
    );
    return group ? group.label : null;
  });

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroup((prev) => (prev === groupLabel ? null : groupLabel));
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.aside
      className={cn(
        "bg-card border-r border-border h-screen flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
      initial={false}
      animate={{ width: isCollapsed ? 64 : 256 }}
    >
      {/* Header với logo và nút toggle */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-foreground flex-1 text-center">CICT-Hosting</h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className={isCollapsed ? "mx-auto" : ""}
        >
          {isCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </Button>
      </div>

      {/* Menu items */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroup === group.label;
          const hasActiveItem = group.items.some((item) => isActive(item.path));
          const GroupIcon = group.icon;

          return (
            <div key={group.label} className="mb-2">
              {/* Menu group header */}
              <button
                onClick={() => {
                  if (isCollapsed) {
                    // Khi collapsed, click vào sẽ mở sidebar
                    onToggleCollapse();
                    // Mở group này khi sidebar mở
                    setExpandedGroup(group.label);
                  } else {
                    // Khi mở rộng, click vào sẽ toggle group
                    toggleGroup(group.label);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
                  hasActiveItem && "text-foreground bg-accent/50",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? group.label : undefined}
              >
                <GroupIcon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </>
                )}
              </button>

              {/* Menu items - chỉ hiển thị khi sidebar mở rộng và group được mở */}
              <AnimatePresence>
                {(!isCollapsed && isExpanded) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {group.items.map((item) => {
                      const active = isActive(item.path);

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                            "hover:bg-accent",
                            active
                              ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span className="flex-1 ml-6">{item.label}</span>
                          {item.badge && (
                            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </motion.aside>
  );
}

