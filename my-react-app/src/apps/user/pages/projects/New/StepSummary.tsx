import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
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
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Bước 5/5 — Tổng quan
          </h2>
          <p className="text-muted-foreground">
            Đang tải thông tin project...
          </p>
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
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Bước 5/5 — Tổng quan
          </h2>
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
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Bước 5/5 — Tổng quan
        </h2>
        <p className="text-muted-foreground">
          Tổng quan những gì đã được tạo và triển khai
        </p>
      </div>

      {/* Thông tin project */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{projectDetail.projectName}</CardTitle>
              {projectDetail.description && (
                <CardDescription className="mt-1">{projectDetail.description}</CardDescription>
              )}
            </div>
            {getStatusBadge(projectDetail.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Ngày tạo:</Label>
              <p className="font-medium">{formatDate(projectDetail.createdAt)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Cập nhật lần cuối:</Label>
              <p className="font-medium">{formatDate(projectDetail.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tổng hợp */}
      <div className="space-y-6">
        {/* Databases */}
        <Card>
          <CardHeader>
            <CardTitle>
              Databases ({projectDetail.databases?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectDetail.databases && projectDetail.databases.length > 0 ? (
              <div className="space-y-3">
                {projectDetail.databases.map((db) => (
                  <div key={db.id} className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{db.projectName}</div>
                        {db.description && (
                          <p className="text-sm text-muted-foreground mt-1">{db.description}</p>
                        )}
                      </div>
                      {getStatusBadge(db.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Loại:</span>{" "}
                        {db.databaseType === "MYSQL" ? "MySQL" : db.databaseType === "MONGODB" ? "MongoDB" : db.databaseType}
                      </div>
                      {db.databaseIp && (
                        <div>
                          <span className="font-medium">IP:</span> {db.databaseIp}
                          {db.databasePort && `:${db.databasePort}`}
                        </div>
                      )}
                      {db.databaseName && (
                        <div>
                          <span className="font-medium">Database:</span> {db.databaseName}
                        </div>
                      )}
                      {db.databaseUsername && (
                        <div>
                          <span className="font-medium">Username:</span> {db.databaseUsername}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tạo lúc: {formatDate(db.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có database nào</p>
            )}
          </CardContent>
        </Card>

        {/* Backends */}
        <Card>
          <CardHeader>
            <CardTitle>
              Backends ({projectDetail.backends?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectDetail.backends && projectDetail.backends.length > 0 ? (
              <div className="space-y-3">
                {projectDetail.backends.map((be) => (
                  <div key={be.id} className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{be.projectName}</div>
                        {be.description && (
                          <p className="text-sm text-muted-foreground mt-1">{be.description}</p>
                        )}
                      </div>
                      {getStatusBadge(be.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Framework:</span>{" "}
                        {be.frameworkType === "SPRINGBOOT" ? "Spring Boot" : be.frameworkType === "NODEJS" ? "Node.js" : be.frameworkType}
                      </div>
                      <div>
                        <span className="font-medium">Deployment:</span>{" "}
                        {be.deploymentType === "DOCKER" ? "Docker Image" : be.deploymentType === "FILE" ? "File ZIP" : be.deploymentType}
                      </div>
                      {be.domainNameSystem && (
                        <div>
                          <span className="font-medium">DNS:</span> {be.domainNameSystem}
                        </div>
                      )}
                      {be.databaseIp && be.databasePort && (
                        <div>
                          <span className="font-medium">Database:</span> {be.databaseIp}:{be.databasePort}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tạo lúc: {formatDate(be.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có backend nào</p>
            )}
          </CardContent>
        </Card>

        {/* Frontends */}
        <Card>
          <CardHeader>
            <CardTitle>
              Frontends ({projectDetail.frontends?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectDetail.frontends && projectDetail.frontends.length > 0 ? (
              <div className="space-y-3">
                {projectDetail.frontends.map((fe) => (
                  <div key={fe.id} className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{fe.projectName}</div>
                        {fe.description && (
                          <p className="text-sm text-muted-foreground mt-1">{fe.description}</p>
                        )}
                      </div>
                      {getStatusBadge(fe.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Framework:</span>{" "}
                        {fe.frameworkType === "REACT" ? "React" : fe.frameworkType === "VUE" ? "Vue" : fe.frameworkType === "ANGULAR" ? "Angular" : fe.frameworkType}
                      </div>
                      <div>
                        <span className="font-medium">Deployment:</span>{" "}
                        {fe.deploymentType === "DOCKER" ? "Docker Image" : fe.deploymentType === "FILE" ? "File ZIP" : fe.deploymentType}
                      </div>
                      {fe.domainNameSystem && (
                        <div>
                          <span className="font-medium">DNS:</span> {fe.domainNameSystem}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tạo lúc: {formatDate(fe.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có frontend nào</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end">
        <Button onClick={() => navigate(`/projects/${projectDetail.id}`)}>
          Xem chi tiết project
        </Button>
      </div>
    </div>
  )
}
