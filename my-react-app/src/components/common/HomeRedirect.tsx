import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Component redirect về trang phù hợp theo role của user
 * - ADMIN -> /admin/overview
 * - USER -> /projects
 * - Chưa đăng nhập -> /login
 */
export function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Kiểm tra role từ localStorage (đáng tin cậy hơn)
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");

  if (!username) {
    return <Navigate to="/login" replace />;
  }

  if (role === "ADMIN") {
    return <Navigate to="/admin/overview" replace />;
  }

  return <Navigate to="/projects" replace />;
}

