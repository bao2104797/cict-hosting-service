import { useLocation, Link } from "react-router-dom";
import { Moon, Sun, LogOut, User } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Component Header với breadcrumb, user info, dark mode toggle
 */
export function Header() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true" || 
           document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  }, [darkMode]);

  // Tạo breadcrumb từ pathname - sử dụng useMemo để đảm bảo tính lại khi pathname thay đổi
  const breadcrumbs = useMemo(() => {
    const paths = location.pathname.split("/").filter(Boolean);
    const result = [{ label: "Home", path: "/admin/overview" }];

    if (paths.length > 1 && paths[0] === "admin") {
      const pathMap: Record<string, string> = {
        overview: "Overview",
        infrastructure: "Infrastructure",
        servers: "Hosts",
        clusters: "Cluster Assign Hosts",
        cluster: "Kubernetes Cluster",
        nodes: "Nodes",
        namespaces: "Namespaces",
        workloads: "Workloads",
        deployments: "Deployments",
        pods: "Pods",
        statefulsets: "Statefulsets",
        services: "Services",
        ingress: "Ingress",
        storage: "Storage",
        pvc: "PVC",
        pv: "PV",
        users: "User Services",
        "replica-requests": "Replica Requests",
        accounts: "Accounts",
      };

      let currentPath = "/admin";
      for (let i = 1; i < paths.length; i++) {
        currentPath += `/${paths[i]}`;
        const label = pathMap[paths[i]] || paths[i];
        result.push({ label, path: currentPath });
      }

      // Đặc biệt: Khi ở trang /admin/users, thêm "Services" vào cuối
      if (location.pathname === "/admin/users") {
        result.push({ label: "Services", path: "/admin/users" });
      }

      // Đặc biệt: Khi ở trang /admin/accounts, thêm "User Services" vào trước "Accounts"
      if (location.pathname === "/admin/accounts") {
        // Tìm và thêm "User Services" vào trước "Accounts"
        const accountIndex = result.findIndex(crumb => crumb.path === "/admin/accounts");
        if (accountIndex !== -1) {
          result.splice(accountIndex, 0, { label: "User Services", path: "/admin/users" });
        }
      }

      // Đặc biệt: Khi ở trang /admin/services hoặc /admin/ingress, thêm "Service Discovery" vào trước
      if (location.pathname === "/admin/services" || location.pathname === "/admin/ingress") {
        const serviceIndex = result.findIndex(crumb => 
          crumb.path === "/admin/services" || crumb.path === "/admin/ingress"
        );
        if (serviceIndex !== -1) {
          result.splice(serviceIndex, 0, { label: "Service Discovery", path: "/admin/services" });
        }
      }
    }

    return result;
  }, [location.pathname]);

  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, index) => (
          <div key={`${crumb.path}-${index}`} className="flex items-center gap-2">
            {index > 0 && <span>/</span>}
            <Link
              to={crumb.path}
              className={cn(
                "hover:text-foreground transition-colors",
                index === breadcrumbs.length - 1 && "text-foreground font-medium"
              )}
            >
              {crumb.label}
            </Link>
          </div>
        ))}
      </nav>

      {/* Right side: Dark mode toggle, User menu */}
      <div className="flex items-center gap-4">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? "Bật sáng" : "Bật tối"}
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* User menu */}
        <DropdownMenu
          trigger={
            <Button variant="ghost" className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <span className="hidden sm:inline">{user?.fullname || user?.username || "Admin"}</span>
            </Button>
          }
          align="right"
          usePortal
        >
          <DropdownMenuItem>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{user?.fullname || "Admin"}</span>
              <span className="text-xs text-muted-foreground">
                {user?.username || "admin"} • {user?.role || "ADMIN"}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </header>
  );
}

