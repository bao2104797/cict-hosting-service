import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Plus, FolderOpen, Database, Server, Globe, Clock, ArrowRight, Filter, Grid3x3, List as ListIcon } from "lucide-react"
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
        status: "running" as const,
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
        return "Sắp theo thời gian"
      case "name":
        return "Sắp theo tên"
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
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-sm text-muted-foreground">Đang tải danh sách projects...</p>
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
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <FolderOpen className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">
                Quản lý Dự Án
              </h1>
              <p className="text-muted-foreground">
                Quản lý và theo dõi các dự án triển khai của bạn
              </p>
            </div>
          </div>
          {allProjects.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{projects.length}</span>
              <span>trong tổng số</span>
              <span className="font-medium text-foreground">{allProjects.length}</span>
              <span>projects</span>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <Card className="mb-6 border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* Search */}
              <div className="flex-1 relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Tìm kiếm theo tên hoặc mô tả..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              {/* Sort */}
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as "name" | "updated")}>
                  <SelectTrigger className="w-full sm:w-[200px] h-10">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-muted-foreground" />
                      <SelectValue placeholder="Sắp xếp">
                        {getSortLabel(sortBy)}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Sắp xếp theo thời gian</SelectItem>
                    <SelectItem value="name">Sắp xếp theo tên</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Create button */}
              <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto h-10">
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
            {projects.map((project, index) => {
              const dbCount = project._counts?.databases ?? project.components.databases.length
              const beCount = project._counts?.backends ?? project.components.backends.length
              const feCount = project._counts?.frontends ?? project.components.frontends.length
              const totalComponents = dbCount + beCount + feCount
              
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ y: -4 }}
                >
                  <Card 
                    className="hover:shadow-xl transition-all duration-300 cursor-pointer h-full flex flex-col border-border/50 overflow-hidden group"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <CardHeader className="pb-3 border-b border-border/50 bg-gradient-to-br from-muted/30 to-transparent">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                              <FolderOpen className="w-4 h-4 text-primary" />
                            </div>
                            <CardTitle className="text-lg font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                              {project.name}
                            </CardTitle>
                          </div>
                          {project.description && (
                            <CardDescription className="line-clamp-2 text-xs mt-1">
                              {project.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 p-5">
                      {/* Stats */}
                      {totalComponents > 0 ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/50">
                              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1.5" />
                              <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{dbCount}</span>
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Database</span>
                            </div>
                            <div className="flex flex-col items-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/50">
                              <Server className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-1.5" />
                              <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{beCount}</span>
                              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Backend</span>
                            </div>
                            <div className="flex flex-col items-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-900/50">
                              <Globe className="w-5 h-5 text-green-600 dark:text-green-400 mb-1.5" />
                              <span className="text-lg font-bold text-green-700 dark:text-green-300">{feCount}</span>
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Frontend</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              Thời gian tạo: {formatDate(project.updatedAt)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="p-4 rounded-full bg-muted mb-3">
                            <FolderOpen className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">Chưa có component nào</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Bắt đầu bằng cách thêm database, backend hoặc frontend
                          </p>
                        </div>
                      )}
                    </CardContent>
                    
                    <CardFooter className="pt-0 pb-4 px-5">
                      <Button
                        variant="outline"
                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/projects/${project.id}`)
                        }}
                      >
                        Xem chi tiết
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              )
            })}
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

