import { Link, useLocation } from "react-router-dom"
import { Moon, Sun, FolderKanban, Plus, LogOut } from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CreateProjectModal } from "@/components/common/CreateProjectModal"
import { useAuth } from "@/contexts/AuthContext"
import {
  DropdownMenu,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

/**
 * Component Navbar với dark mode toggle
 */
export function Navbar() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [darkMode, setDarkMode] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    // Load dark mode từ localStorage
    const saved = localStorage.getItem("darkMode")
    if (saved === "true") {
      setDarkMode(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    localStorage.setItem("darkMode", String(newMode))
    if (newMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  // Lấy chữ cái đầu của fullname để hiển thị trong avatar
  const getInitials = (fullname: string) => {
    const parts = fullname.trim().split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return fullname[0]?.toUpperCase() || "U"
  }

  return (
    <nav className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/projects" className="flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground">CICT-Hosting</span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-4">
            <Link to="/projects">
              <Button
                variant={location.pathname === "/projects" ? "default" : "ghost"}
              >
                Projects
              </Button>
            </Link>
            <Button
              variant={location.pathname === "/projects/new" ? "default" : "outline"}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Tạo Project
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
              {darkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
            
            {/* User menu */}
            <DropdownMenu
              trigger={
                <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                    {user ? getInitials(user.fullname) : "U"}
                  </div>
                </button>
              }
              align="right"
              usePortal
            >
              {user && (
                <>
                  <div className="px-2 py-1.5 text-sm font-medium border-b pointer-events-none">
                    {user.fullname}
                  </div>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground border-b pointer-events-none">
                    {user.username} - {(user.tier || "standard").toLowerCase()}
                  </div>
                </>
              )}
              <DropdownMenuItem onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Modal tạo project */}
      <CreateProjectModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </nav>
  )
}

