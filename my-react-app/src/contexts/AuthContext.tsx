import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { login as loginAPI, LoginResponse } from "@/lib/auth-api"

interface User {
  fullname: string
  username: string
  role?: string
  tier?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // Load user từ localStorage khi mount
  useEffect(() => {
    const savedFullname = localStorage.getItem("fullname")
    const savedUsername = localStorage.getItem("username")
    const savedRole = localStorage.getItem("role")
    const savedTier = localStorage.getItem("tier")
    
    if (savedFullname && savedUsername) {
      setUser({
        fullname: savedFullname,
        username: savedUsername,
        role: savedRole || undefined,
        tier: savedTier || undefined,
      })
    }
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const response: LoginResponse = await loginAPI({ username, password })
      
      // Lưu thông tin user vào localStorage
      localStorage.setItem("fullname", response.fullname)
      localStorage.setItem("username", response.username)
      if (response.role) {
        localStorage.setItem("role", response.role)
      }
      if (response.tier) {
        localStorage.setItem("tier", response.tier)
      }
      
      // Cập nhật state
      setUser({
        fullname: response.fullname,
        username: response.username,
        role: response.role,
        tier: response.tier,
      })
      
      // Chuyển hướng theo role
      // Nếu là ADMIN thì chuyển đến admin dashboard, ngược lại chuyển đến projects
      if (response.role === "ADMIN") {
        navigate("/admin/overview")
      } else {
        navigate("/projects")
      }
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    // Xóa toàn bộ localStorage
    localStorage.clear()
    
    // Xóa state
    setUser(null)
    
    // Chuyển hướng đến trang login
    navigate("/login")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

