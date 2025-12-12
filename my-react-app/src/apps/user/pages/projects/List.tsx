import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Plus } from "lucide-react"
import { motion } from "framer-motion"
import { getUserProjects } from "@/lib/project-api"
import { useAuth } from "@/contexts/AuthContext"
import { useWizardStore } from "@/apps/user/stores/wizard-store"
import type { Project } from "@/types"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/common/EmptyState"
import { CreateProjectModal } from "@/components/common/CreateProjectModal"
import { toast } from "sonner"

/**
 * Trang danh sách Projects với tìm kiếm, lọc và sắp xếp
 */
export function ProjectsList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { resetWizard } = useWizardStore()
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "updated">("updated")
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Xóa currentProjectId và wizard-draft khi vào trang này
  useEffect(() => {
    // Xóa currentProjectId từ localStorage
    try {
      localStorage.removeItem("currentProjectId")
    } catch (error) {
      console.error("Lỗi xóa currentProjectId:", error)
    }
    
    // Xóa wizard-draft thông qua resetWizard
    resetWizard()
  }, [resetWizard])

  // Load projects từ API
  const loadProjects = useCallback(async () => {
    if (!user?.username) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await getUserProjects(user.username)
      
      // Map dữ liệu từ API response sang format Project
      const mappedProjects: Project[] = response.projects.map((item) => ({
        id: String(item.id),
        name: item.projectName,
        description: item.description || undefined,
        updatedAt: item.updatedAt,
        components: {
          databases: [], // Chỉ lưu counts, không tạo dummy data
          backends: [],
          frontends: [],
        },
        // Lưu counts riêng để hiển thị
        _counts: {
          databases: item.databaseCount,
          backends: item.backendCount,
          frontends: item.frontendCount,
        },
      }))

      setAllProjects(mappedProjects)
    } catch (err) {
      console.error("Lỗi load projects:", err)
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi tải danh sách projects")
      toast.error("Không thể tải danh sách projects")
    } finally {
      setLoading(false)
    }
  }, [user?.username])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Filter & sort projects khi thay đổi bộ lọc
  useEffect(() => {
    let filtered = allProjects

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      )
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name)
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    setProjects(sorted)
  }, [allProjects, searchQuery, sortBy])

  // Map giá trị sort sang tiếng Việt
  const getSortLabel = (value: string) => {
    switch (value) {
      case "updated":
        return "Sắp xếp theo thời gian"
      case "name":
        return "Sắp xếp theo tên"
      default:
        return value
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadProjects}>Thử lại</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Quản lý Projects
          </h1>
          <p className="text-muted-foreground">
            Quản lý và theo dõi các dự án triển khai của bạn
          </p>
        </div>

        {/* Toolbar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm kiếm project..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Sort */}
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as "name" | "updated")}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sắp xếp">
                      {getSortLabel(sortBy)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Sắp xếp theo thời gian</SelectItem>
                    <SelectItem value="name">Sắp xếp theo tên</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Create button */}
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Tạo Project
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Projects list */}
        {projects.length === 0 ? (
          <EmptyState
            title="Chưa có project nào"
            description="Bắt đầu bằng cách tạo project mới để triển khai ứng dụng của bạn"
            actionLabel="Tạo project mới"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-xl">{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription className="line-clamp-2">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span>Databases: {project._counts?.databases ?? project.components.databases.length}</span>
                        <span>Backends: {project._counts?.backends ?? project.components.backends.length}</span>
                        <span>Frontends: {project._counts?.frontends ?? project.components.frontends.length}</span>
                      </div>
                      <div className="text-xs">
                        Cập nhật: {formatDate(project.updatedAt)}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      Xem chi tiết
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal chọn loại project */}
      <CreateProjectModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onProjectCreated={() => {
          // Reload projects sau khi tạo thành công
          loadProjects()
        }}
      />
    </div>
  )
}

