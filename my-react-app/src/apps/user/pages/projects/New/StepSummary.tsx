import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Loader2, CheckCircle2, AlertCircle, FileText, FolderOpen, Calendar, Database, Server, Globe, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useWizardStore } from "@/apps/user/stores/wizard-store"
import { useAuth } from "@/contexts/AuthContext"
import { getProjectDetail, type ProjectDetailResponse } from "@/lib/project-api"
import { toast } from "sonner"

/**
 * Step 5: Tổng quan - Hiển thị thông tin tổng quan những gì đã được tạo và triển khai
 */
export function StepSummary() {
  const navigate = useNavigate()
  const { projectId } = useWizardStore()
  const { user } = useAuth()
  const [projectDetail, setProjectDetail] = useState<ProjectDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Load project detail từ API
  useEffect(() => {
    const loadProjectDetail = async () => {
      const currentProjectId = localStorage.getItem("currentProjectId") || projectId
      if (!currentProjectId || !user?.username) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")
      try {
        const detail = await getProjectDetail(currentProjectId, user.username)
        setProjectDetail(detail)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi tải thông tin project")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadProjectDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user?.username])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RUNNING":
        return <Badge variant="default" className="bg-green-500">Đang chạy</Badge>
      case "STOPPED":
        return <Badge variant="secondary">Đã dừng</Badge>
      case "ERROR":
        return <Badge variant="destructive">Lỗi</Badge>
      case "PAUSED":
        return <Badge variant="outline">Tạm dừng</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "-"
    try {
      const date = new Date(dateString)
      return date.toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Bước 5/5 — Tổng quan
            </h2>
            <p className="text-muted-foreground mt-1">
              Đang tải thông tin project...
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !projectDetail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Bước 5/5 — Tổng quan
            </h2>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || "Không thể tải thông tin project. Vui lòng thử lại sau."}
          </AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button onClick={() => navigate("/projects")} variant="outline">
            Quay lại danh sách
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Bước 5/5 — Tổng quan
          </h2>
          <p className="text-muted-foreground mt-1">
            Tổng quan những gì đã được tạo và triển khai
          </p>
        </div>
      </div>

      {/* Thông tin project */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-xl">Thông tin dự án</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
              <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                  Tên dự án
                </Label>
                <p className="text-sm font-semibold">{projectDetail.projectName}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                  Ngày tạo
                </Label>
                <p className="text-sm font-medium">{formatDate(projectDetail.createdAt)}</p>
              </div>
            </div>
          </div>
          {projectDetail.description && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                  Mô tả dự án
                </Label>
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{projectDetail.description}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tổng hợp - Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Databases */}
        <Card className="flex flex-col border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/30">
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg">
                Databases ({projectDetail.databases?.length || 0})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[600px] pr-2 p-4">
            {projectDetail.databases && projectDetail.databases.length > 0 ? (
              <div className="space-y-2">
                {projectDetail.databases.map((db) => (
                  <motion.div
                    key={db.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 bg-muted rounded-lg space-y-2 border border-border/50 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className={`p-1.5 rounded-md flex-shrink-0 ${
                          db.databaseType === "MYSQL" 
                            ? "bg-orange-100 dark:bg-orange-950/30" 
                            : "bg-green-100 dark:bg-green-950/30"
                        }`}>
                          <Database className={`w-3.5 h-3.5 ${
                            db.databaseType === "MYSQL"
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-green-600 dark:text-green-400"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{db.projectName}</div>
                          {db.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{db.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">{getStatusBadge(db.status)}</div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Loại:</span>{" "}
                        {db.databaseType === "MYSQL" ? "MySQL" : db.databaseType === "MONGODB" ? "MongoDB" : db.databaseType}
                      </div>
                      {db.databaseIp && (
                        <div className="truncate">
                          <span className="font-medium">IP:</span> {db.databaseIp}
                          {db.databasePort && `:${db.databasePort}`}
                        </div>
                      )}
                      {db.databaseName && (
                        <div className="truncate">
                          <span className="font-medium">DB:</span> {db.databaseName}
                        </div>
                      )}
                      {db.databaseUsername && (
                        <div className="truncate">
                          <span className="font-medium">User:</span> {db.databaseUsername}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-0.5">
                      {formatDate(db.createdAt)}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Database className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Chưa có database nào</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backends */}
        <Card className="flex flex-col border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/30">
                <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-lg">
                Backends ({projectDetail.backends?.length || 0})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[600px] pr-2 p-4">
            {projectDetail.backends && projectDetail.backends.length > 0 ? (
              <div className="space-y-2">
                {projectDetail.backends.map((be) => (
                  <motion.div
                    key={be.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 bg-muted rounded-lg space-y-2 border border-border/50 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className={`p-1.5 rounded-md flex-shrink-0 ${
                          be.frameworkType === "SPRINGBOOT" 
                            ? "bg-green-100 dark:bg-green-950/30" 
                            : "bg-blue-100 dark:bg-blue-950/30"
                        }`}>
                          <Server className={`w-3.5 h-3.5 ${
                            be.frameworkType === "SPRINGBOOT"
                              ? "text-green-600 dark:text-green-400"
                              : "text-blue-600 dark:text-blue-400"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{be.projectName}</div>
                          {be.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{be.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">{getStatusBadge(be.status)}</div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Framework:</span>{" "}
                        {be.frameworkType === "SPRINGBOOT" ? "Spring Boot" : be.frameworkType === "NODEJS" ? "Node.js" : be.frameworkType}
                      </div>
                      <div>
                        <span className="font-medium">Deploy:</span>{" "}
                        {be.deploymentType === "DOCKER" ? "Docker" : be.deploymentType === "FILE" ? "ZIP" : be.deploymentType}
                      </div>
                      {be.domainNameSystem && (
                        <div className="truncate">
                          <span className="font-medium">DNS:</span> {be.domainNameSystem}
                        </div>
                      )}
                      {be.databaseIp && be.databasePort && (
                        <div className="truncate">
                          <span className="font-medium">DB:</span> {be.databaseIp}:{be.databasePort}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-0.5">
                      {formatDate(be.createdAt)}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Server className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Chưa có backend nào</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Frontends */}
        <Card className="flex flex-col border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/30">
                <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-lg">
                Frontends ({projectDetail.frontends?.length || 0})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[600px] pr-2 p-4">
            {projectDetail.frontends && projectDetail.frontends.length > 0 ? (
              <div className="space-y-2">
                {projectDetail.frontends.map((fe) => {
                  const getFrontendTechColor = (tech: string) => {
                    if (tech === "REACT" || tech === "react") return { bg: "bg-cyan-100 dark:bg-cyan-950/30", text: "text-cyan-600 dark:text-cyan-400" }
                    if (tech === "VUE" || tech === "vue") return { bg: "bg-emerald-100 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400" }
                    if (tech === "ANGULAR" || tech === "angular") return { bg: "bg-red-100 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400" }
                    return { bg: "bg-green-100 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400" }
                  }
                  const techColors = getFrontendTechColor(fe.frameworkType || "")
                  return (
                    <motion.div
                      key={fe.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-3 bg-muted rounded-lg space-y-2 border border-border/50 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <div className={`p-1.5 rounded-md flex-shrink-0 ${techColors.bg}`}>
                            <Globe className={`w-3.5 h-3.5 ${techColors.text}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{fe.projectName}</div>
                            {fe.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{fe.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">{getStatusBadge(fe.status)}</div>
                      </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Framework:</span>{" "}
                        {fe.frameworkType === "REACT" ? "React" : fe.frameworkType === "VUE" ? "Vue" : fe.frameworkType === "ANGULAR" ? "Angular" : fe.frameworkType}
                      </div>
                      <div>
                        <span className="font-medium">Deploy:</span>{" "}
                        {fe.deploymentType === "DOCKER" ? "Docker" : fe.deploymentType === "FILE" ? "ZIP" : fe.deploymentType}
                      </div>
                      {fe.domainNameSystem && (
                        <div className="truncate">
                          <span className="font-medium">DNS:</span> {fe.domainNameSystem}
                        </div>
                      )}
                    </div>
                      <div className="text-[10px] text-muted-foreground pt-0.5">
                        {formatDate(fe.createdAt)}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Globe className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Chưa có frontend nào</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end">
        <Button onClick={() => navigate(`/projects/${projectDetail.id}`)} className="min-w-[180px]">
          Xem chi tiết dự án
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
