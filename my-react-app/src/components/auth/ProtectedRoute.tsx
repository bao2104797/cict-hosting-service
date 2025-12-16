import { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

interface ProtectedRouteProps {
  children: ReactNode
}

/**
 * Component bảo vệ route - chỉ cho phép truy cập khi đã đăng nhập
 * Kiểm tra username trong localStorage để đảm bảo user đã đăng nhập
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()

  // Hiển thị loading khi đang check
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Kiểm tra username trong localStorage - đây là nguồn truth chính
  // Nếu không có username trong localStorage thì chắc chắn chưa đăng nhập
  const username = localStorage.getItem("username")
  if (!username) {
    return <Navigate to="/login" replace />
  }

  // Nếu có username trong localStorage thì cho phép truy cập
  // (isAuthenticated có thể chưa được set do race condition, nhưng localStorage là reliable)
  return <>{children}</>
}

