import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Copy, CheckCircle2, ExternalLink, MoreVertical, Play, Pause, Trash2, Eye, EyeOff, Plus, Upload, X, Loader2, SlidersHorizontal } from "lucide-react"
import { motion } from "framer-motion"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { getProjectById, deployProject, addDatabaseToProject, addBackendToProject, addFrontendToProject } from "@/lib/mock-api"
import { getProjectBasicInfo, getProjectOverview, getProjectDatabases, getProjectBackends, getProjectFrontends, deleteProject, getProjectDeploymentHistory, deployDatabase, deployBackend, deployFrontend, startProjectFrontend, stopProjectFrontend, startProjectBackend, stopProjectBackend, deleteProjectBackend, deleteProjectFrontend, startProjectDatabase, stopProjectDatabase, deleteProjectDatabase, checkDomainNameSystem, type DatabaseInfo, type BackendInfo, type FrontendInfo, type DeploymentHistoryItem, createBackendScaleRequest, getBackendReplicaInfo, cancelBackendScaleRequest, createFrontendScaleRequest, getFrontendReplicaInfo, cancelFrontendScaleRequest } from "@/lib/project-api"
import { useAuth } from "@/contexts/AuthContext"
import type { Project, ComponentStatus } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { OverviewStats } from "@/components/common/StatsChart"
import { HintBox } from "@/apps/user/components/HintBox"
import { validateDNS, validateDockerImage, validateIP, validatePort, validateZipFile } from "@/lib/validators"
import { toast } from "sonner"

const MIN_BACKEND_REPLICAS = 1
const resolveMaxBackendReplicas = (backend?: BackendInfo | null) => {
  if (!backend) {
    return MIN_BACKEND_REPLICAS + 4
  }
  if (backend.maxReplicas && backend.maxReplicas > 0) {
    return Math.max(backend.maxReplicas, MIN_BACKEND_REPLICAS + 1)
  }
  const fallback = backend.replicas && backend.replicas > 0 ? backend.replicas : MIN_BACKEND_REPLICAS
  return Math.max(fallback, MIN_BACKEND_REPLICAS + 4)
}

const MIN_FRONTEND_REPLICAS = 1
const resolveMaxFrontendReplicas = (frontend?: FrontendInfo | null) => {
  if (!frontend) {
    return MIN_FRONTEND_REPLICAS + 4
  }
  if (frontend.maxReplicas && frontend.maxReplicas > 0) {
    return Math.max(frontend.maxReplicas, MIN_FRONTEND_REPLICAS + 1)
  }
  const fallback = frontend.replicas && frontend.replicas > 0 ? frontend.replicas : MIN_FRONTEND_REPLICAS
  return Math.max(fallback, MIN_FRONTEND_REPLICAS + 4)
}

/**
 * Trang chi tiết Project với tabs
 */
export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [projectBasicInfo, setProjectBasicInfo] = useState<{ name: string; description?: string; createdAt?: string; updatedAt: string } | null>(null)
  const [projectOverview, setProjectOverview] = useState<{
    databases: { total: number; running: number; paused: number; other: number }
    backends: { total: number; running: number; paused: number; other: number }
    frontends: { total: number; running: number; paused: number; other: number }
  } | null>(null)
  const [projectDatabases, setProjectDatabases] = useState<DatabaseInfo[]>([])
  const [projectBackends, setProjectBackends] = useState<BackendInfo[]>([])
  const [projectFrontends, setProjectFrontends] = useState<FrontendInfo[]>([])
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [showLogModal, setShowLogModal] = useState(false)
  const [selectedLogs, setSelectedLogs] = useState("")
  const [deploying, setDeploying] = useState(false)
  const [showAddDatabase, setShowAddDatabase] = useState(false)
  const [showAddBackend, setShowAddBackend] = useState(false)
  const [showAddFrontend, setShowAddFrontend] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: "database" | "backend" | "frontend"; id: number; name: string } | null>(null)
  const [isDeletingResource, setIsDeletingResource] = useState(false)
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [isDeployingDatabase, setIsDeployingDatabase] = useState(false)
  const [isDeployingBackend, setIsDeployingBackend] = useState(false)
  const [isDeployingFrontend, setIsDeployingFrontend] = useState(false)
  const [showAdjustBackendModal, setShowAdjustBackendModal] = useState(false)
  const [selectedBackendForAdjust, setSelectedBackendForAdjust] = useState<BackendInfo | null>(null)
  const [adjustBackendReplicas, setAdjustBackendReplicas] = useState(1)
  const [isSubmittingBackendAdjust, setIsSubmittingBackendAdjust] = useState(false)
  const [isLoadingBackendInfo, setIsLoadingBackendInfo] = useState(false)
  const [pendingBackendRequest, setPendingBackendRequest] = useState<{ id: number; newReplicas: number; status: string } | null>(null)
  const [backendReplicaInfoMessage, setBackendReplicaInfoMessage] = useState<string | null>(null)
  const [isCancellingBackendRequest, setIsCancellingBackendRequest] = useState(false)
  const [showAdjustFrontendModal, setShowAdjustFrontendModal] = useState(false)
  const [selectedFrontendForAdjust, setSelectedFrontendForAdjust] = useState<FrontendInfo | null>(null)
  const [adjustFrontendReplicas, setAdjustFrontendReplicas] = useState(1)
  const [isSubmittingFrontendAdjust, setIsSubmittingFrontendAdjust] = useState(false)
  const [isLoadingFrontendInfo, setIsLoadingFrontendInfo] = useState(false)
  const [pendingFrontendRequest, setPendingFrontendRequest] = useState<{ id: number; newReplicas: number; status: string } | null>(null)
  const [frontendReplicaInfoMessage, setFrontendReplicaInfoMessage] = useState<string | null>(null)
  const [isCancellingFrontendRequest, setIsCancellingFrontendRequest] = useState(false)
  
  // State cho file uploads
  const [zipFileDb, setZipFileDb] = useState<File | null>(null)
  const [zipErrorDb, setZipErrorDb] = useState("")
  const [zipFileBe, setZipFileBe] = useState<File | null>(null)
  const [zipErrorBe, setZipErrorBe] = useState("")
  const [zipFileFe, setZipFileFe] = useState<File | null>(null)
  const [zipErrorFe, setZipErrorFe] = useState("")
  
  // State cho runtime env (chỉ cho frontend)
  const [runtimeEnv, setRuntimeEnv] = useState<Array<{ key: string; value: string }>>([])

  // Load project basic info từ API
  useEffect(() => {
    const loadProjectBasicInfo = async () => {
      if (!id) return
      try {
        const basicInfo = await getProjectBasicInfo(id)
        setProjectBasicInfo({
          name: basicInfo.projectName,
          description: basicInfo.description,
          createdAt: basicInfo.createdAt,
          updatedAt: basicInfo.updatedAt,
        })
      } catch (error) {
        console.error("Lỗi load project basic info:", error)
        // Không hiển thị toast để tránh làm phiền user nếu vẫn có thể load từ mock-api
      }
    }

    loadProjectBasicInfo()
  }, [id])

  // Load project overview từ API
  const loadProjectOverview = async () => {
    if (!id) return
    try {
      const overview = await getProjectOverview(id)
      // Map dữ liệu từ API sang format phù hợp với component
      setProjectOverview({
        databases: {
          total: (overview.databases.total || 0),
          running: (overview.databases.running || 0),
          paused: (overview.databases.paused || 0) + (overview.databases.stopped || 0),
          other: (overview.databases.error || 0),
        },
        backends: {
          total: (overview.backends.total || 0),
          running: (overview.backends.running || 0),
          paused: (overview.backends.paused || 0) + (overview.backends.stopped || 0),
          other: (overview.backends.error || 0),
        },
        frontends: {
          total: (overview.frontends.total || 0),
          running: (overview.frontends.running || 0),
          paused: (overview.frontends.paused || 0) + (overview.frontends.stopped || 0),
          other: (overview.frontends.error || 0),
        },
      })
    } catch (error) {
      console.error("Lỗi load project overview:", error)
      // Không hiển thị toast để tránh làm phiền user nếu vẫn có thể load từ mock-api
    }
  }

  useEffect(() => {
    loadProjectOverview()
  }, [id])

  // Load project databases từ API
  const loadProjectDatabases = async () => {
    if (!id) return
    try {
      const response = await getProjectDatabases(id)
      setProjectDatabases(response.databases)
    } catch (error) {
      console.error("Lỗi load project databases:", error)
      // Không hiển thị toast để tránh làm phiền user nếu vẫn có thể load từ mock-api
    }
  }

  useEffect(() => {
    loadProjectDatabases()
  }, [id])

  const loadProjectBackendsData = async () => {
    if (!id) return
    try {
      const response = await getProjectBackends(id)
      setProjectBackends(response.backends)
    } catch (error) {
      console.error("Lỗi load project backends:", error)
      // Không hiển thị toast để tránh làm phiền user nếu vẫn có thể load từ mock-api
    }
  }

  // Load project backends từ API
  useEffect(() => {
    loadProjectBackendsData()
  }, [id])

  const loadProjectFrontendsData = async () => {
    if (!id) return
    try {
      const response = await getProjectFrontends(id)
      setProjectFrontends(response.frontends)
    } catch (error) {
      console.error("Lỗi load project frontends:", error)
      // Không hiển thị toast để tránh làm phiền user nếu vẫn có thể load từ mock-api
    }
  }

  // Load project frontends từ API
  useEffect(() => {
    loadProjectFrontendsData()
  }, [id])

  // Load project (components) từ mock-api - optional, chỉ dùng làm fallback
  useEffect(() => {
    const loadProject = async () => {
      if (!id) return
      setLoading(true)
      try {
        const data = await getProjectById(id)
        setProject(data)
      } catch (error) {
        // Không hiển thị lỗi vì chúng ta đã có dữ liệu từ các API thực
        // Chỉ log để debug
        console.log("Không tìm thấy project trong mock-api, sử dụng dữ liệu từ API thực")
        // Tạo project object giả từ dữ liệu API để tránh lỗi render
        setProject({
          id: id,
          name: projectBasicInfo?.name || "Project",
          description: projectBasicInfo?.description,
          status: "running",
          updatedAt: projectBasicInfo?.updatedAt || new Date().toISOString(),
          components: {
            databases: [],
            backends: [],
            frontends: [],
          },
          endpoints: [],
        } as Project)
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [id, projectBasicInfo])

  // Xem log (giả lập)
  const handleViewLog = (resourceName: string) => {
    const fakeLogs = [
      `[${new Date().toLocaleString("vi-VN")}] Starting ${resourceName}...`,
      `[${new Date().toLocaleString("vi-VN")}] Building Docker image...`,
      `[${new Date().toLocaleString("vi-VN")}] Pushing to registry...`,
      `[${new Date().toLocaleString("vi-VN")}] Deploying to cluster...`,
      `[${new Date().toLocaleString("vi-VN")}] ${resourceName} deployed successfully`,
    ].join("\n")
    setSelectedLogs(fakeLogs)
    setShowLogModal(true)
  }

  // Chạy component
  const handleStart = async (resourceName: string, resourceType: "database" | "backend" | "frontend") => {
    if (!id) return
    setDeploying(true)
    try {
      await deployProject(id)
      toast.success(`Đã bắt đầu chạy ${resourceName}!`)
      // Reload project để cập nhật status (nếu có trong mock-api)
      try {
        const data = await getProjectById(id)
        setProject(data)
      } catch (error) {
        // Nếu không tìm thấy trong mock-api, không sao vì đã có dữ liệu từ API thực
        console.log("Không thể reload từ mock-api, sử dụng dữ liệu từ API thực")
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra khi chạy")
    } finally {
      setDeploying(false)
    }
  }

  // Tạm dừng component
  const handlePause = async (resourceName: string, resourceType: "database" | "backend" | "frontend") => {
    toast.success(`Đã tạm dừng ${resourceName}!`)
    // Mock: Cập nhật status trong project
    if (project) {
      // Có thể cập nhật state local hoặc gọi API
      toast.info("Tính năng tạm dừng đang được phát triển")
    }
  }

  // Điều khiển frontend thực tế
  const handleFrontendStart = async (frontendId: number, resourceName: string) => {
    if (!id) return
    setDeploying(true)
    try {
      await startProjectFrontend(id, frontendId)
      toast.success(`Đã khởi động ${resourceName}!`)
      await Promise.all([loadProjectOverview(), loadProjectFrontendsData()])
    } catch (error) {
      console.error("Lỗi khởi động frontend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể khởi động frontend")
    } finally {
      setDeploying(false)
    }
  }

  const handleFrontendStop = async (frontendId: number, resourceName: string) => {
    if (!id) return
    try {
      await stopProjectFrontend(id, frontendId)
      toast.success(`Đã tạm dừng ${resourceName}!`)
      await Promise.all([loadProjectOverview(), loadProjectFrontendsData()])
    } catch (error) {
      console.error("Lỗi tạm dừng frontend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể tạm dừng frontend")
    }
  }

  // Điều khiển backend thực tế
  const handleBackendStart = async (backendId: number, resourceName: string) => {
    if (!id) return
    setDeploying(true)
    try {
      await startProjectBackend(id, backendId)
      toast.success(`Đã khởi động ${resourceName}!`)
      await Promise.all([loadProjectOverview(), loadProjectBackendsData()])
    } catch (error) {
      console.error("Lỗi khởi động backend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể khởi động backend")
    } finally {
      setDeploying(false)
    }
  }

  const handleBackendStop = async (backendId: number, resourceName: string) => {
    if (!id) return
    try {
      await stopProjectBackend(id, backendId)
      toast.success(`Đã tạm dừng ${resourceName}!`)
      await Promise.all([loadProjectOverview(), loadProjectBackendsData()])
    } catch (error) {
      console.error("Lỗi tạm dừng backend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể tạm dừng backend")
    }
  }

  const fetchBackendReplicaInfo = async (backend: BackendInfo) => {
    setIsLoadingBackendInfo(true)
    try {
      const info = await getBackendReplicaInfo(backend.id)
      const mergedBackend: BackendInfo = {
        ...backend,
        replicas: info.replicas ?? backend.replicas,
        maxReplicas: info.maxReplicas ?? backend.maxReplicas,
      }
      setSelectedBackendForAdjust(mergedBackend)
      setBackendReplicaInfoMessage(info.message ?? null)

      if (info.hasPendingRequest && info.pendingRequestId) {
        setPendingBackendRequest({
          id: info.pendingRequestId,
          newReplicas: info.pendingNewReplicas ?? mergedBackend.replicas ?? MIN_BACKEND_REPLICAS,
          status: info.pendingStatus ?? "PENDING",
        })
        if (info.pendingNewReplicas) {
          setAdjustBackendReplicas(info.pendingNewReplicas)
        }
      } else {
        setPendingBackendRequest(null)
        const currentReplicasValue =
          info.replicas && info.replicas > 0
            ? info.replicas
            : mergedBackend.replicas && mergedBackend.replicas > 0
            ? mergedBackend.replicas
            : MIN_BACKEND_REPLICAS
        const limit = resolveMaxBackendReplicas(mergedBackend)
        setAdjustBackendReplicas(Math.min(Math.max(currentReplicasValue, MIN_BACKEND_REPLICAS), limit))
      }
    } catch (error) {
      console.error("Lỗi lấy thông tin replicas backend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể lấy thông tin replicas backend")
    } finally {
      setIsLoadingBackendInfo(false)
    }
  }

  const openAdjustBackendModal = (backend: BackendInfo) => {
    setSelectedBackendForAdjust(backend)
    setBackendReplicaInfoMessage(null)
    setPendingBackendRequest(null)
    setShowAdjustBackendModal(true)
    fetchBackendReplicaInfo(backend)
  }

  const closeAdjustBackendModal = () => {
    setShowAdjustBackendModal(false)
    setSelectedBackendForAdjust(null)
    setAdjustBackendReplicas(1)
    setIsLoadingBackendInfo(false)
    setPendingBackendRequest(null)
    setBackendReplicaInfoMessage(null)
  }

  const handleSubmitBackendAdjust = async () => {
    if (!selectedBackendForAdjust) return
    if (pendingBackendRequest) {
      toast.info("Bạn đã gửi yêu cầu điều chỉnh và đang chờ phê duyệt.")
      return
    }
    setIsSubmittingBackendAdjust(true)
    try {
      await createBackendScaleRequest({
        backendId: selectedBackendForAdjust.id,
        newReplicas: adjustBackendReplicas,
      })
      toast.success("Đã gửi yêu cầu điều chỉnh backend. Vui lòng chờ phê duyệt.")
      closeAdjustBackendModal()
      await Promise.all([loadProjectOverview(), loadProjectBackendsData()])
    } catch (error) {
      console.error("Lỗi gửi yêu cầu điều chỉnh backend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể gửi yêu cầu điều chỉnh backend")
    } finally {
      setIsSubmittingBackendAdjust(false)
    }
  }

  const handleCancelPendingBackendRequest = async () => {
    if (!pendingBackendRequest || !selectedBackendForAdjust) return
    setIsCancellingBackendRequest(true)
    try {
      await cancelBackendScaleRequest(pendingBackendRequest.id)
      toast.success("Đã hủy yêu cầu điều chỉnh backend.")
      closeAdjustBackendModal()
      await Promise.all([loadProjectOverview(), loadProjectBackendsData()])
    } catch (error) {
      console.error("Lỗi hủy yêu cầu backend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể hủy yêu cầu điều chỉnh backend")
    } finally {
      setIsCancellingBackendRequest(false)
    }
  }

  const fetchFrontendReplicaInfo = async (frontend: FrontendInfo) => {
    setIsLoadingFrontendInfo(true)
    try {
      const info = await getFrontendReplicaInfo(frontend.id)
      const mergedFrontend: FrontendInfo = {
        ...frontend,
        replicas: info.replicas ?? frontend.replicas,
        maxReplicas: info.maxReplicas ?? frontend.maxReplicas,
      }
      setSelectedFrontendForAdjust(mergedFrontend)
      setFrontendReplicaInfoMessage(info.message ?? null)

      if (info.hasPendingRequest && info.pendingRequestId) {
        setPendingFrontendRequest({
          id: info.pendingRequestId,
          newReplicas: info.pendingNewReplicas ?? mergedFrontend.replicas ?? MIN_FRONTEND_REPLICAS,
          status: info.pendingStatus ?? "PENDING",
        })
        if (info.pendingNewReplicas) {
          setAdjustFrontendReplicas(info.pendingNewReplicas)
        }
      } else {
        setPendingFrontendRequest(null)
        const currentReplicasValue =
          info.replicas && info.replicas > 0
            ? info.replicas
            : mergedFrontend.replicas && mergedFrontend.replicas > 0
            ? mergedFrontend.replicas
            : MIN_FRONTEND_REPLICAS
        const limit = resolveMaxFrontendReplicas(mergedFrontend)
        setAdjustFrontendReplicas(Math.min(Math.max(currentReplicasValue, MIN_FRONTEND_REPLICAS), limit))
      }
    } catch (error) {
      console.error("Lỗi lấy thông tin replicas frontend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể lấy thông tin replicas frontend")
    } finally {
      setIsLoadingFrontendInfo(false)
    }
  }

  const openAdjustFrontendModal = (frontend: FrontendInfo) => {
    setSelectedFrontendForAdjust(frontend)
    setFrontendReplicaInfoMessage(null)
    setPendingFrontendRequest(null)
    setShowAdjustFrontendModal(true)
    fetchFrontendReplicaInfo(frontend)
  }

  const closeAdjustFrontendModal = () => {
    setShowAdjustFrontendModal(false)
    setSelectedFrontendForAdjust(null)
    setAdjustFrontendReplicas(1)
    setIsLoadingFrontendInfo(false)
    setPendingFrontendRequest(null)
    setFrontendReplicaInfoMessage(null)
  }

  const handleSubmitFrontendAdjust = async () => {
    if (!selectedFrontendForAdjust) return
    if (pendingFrontendRequest) {
      toast.info("Bạn đã gửi yêu cầu điều chỉnh và đang chờ phê duyệt.")
      return
    }
    setIsSubmittingFrontendAdjust(true)
    try {
      await createFrontendScaleRequest({
        frontendId: selectedFrontendForAdjust.id,
        newReplicas: adjustFrontendReplicas,
      })
      toast.success("Đã gửi yêu cầu điều chỉnh frontend. Vui lòng chờ phê duyệt.")
      closeAdjustFrontendModal()
      await Promise.all([loadProjectOverview(), loadProjectFrontendsData()])
    } catch (error) {
      console.error("Lỗi gửi yêu cầu điều chỉnh frontend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể gửi yêu cầu điều chỉnh frontend")
    } finally {
      setIsSubmittingFrontendAdjust(false)
    }
  }

  const handleCancelPendingFrontendRequest = async () => {
    if (!pendingFrontendRequest || !selectedFrontendForAdjust) return
    setIsCancellingFrontendRequest(true)
    try {
      await cancelFrontendScaleRequest(pendingFrontendRequest.id)
      toast.success("Đã hủy yêu cầu điều chỉnh frontend.")
      closeAdjustFrontendModal()
      await Promise.all([loadProjectOverview(), loadProjectFrontendsData()])
    } catch (error) {
      console.error("Lỗi hủy yêu cầu frontend:", error)
      toast.error(error instanceof Error ? error.message : "Không thể hủy yêu cầu điều chỉnh frontend")
    } finally {
      setIsCancellingFrontendRequest(false)
    }
  }

  // Điều khiển database thực tế
  const handleDatabaseStart = async (databaseId: number, resourceName: string) => {
    if (!id) return
    setDeploying(true)
    try {
      await startProjectDatabase(id, databaseId)
      toast.success(`Đã khởi động ${resourceName}!`)
      await Promise.all([loadProjectOverview(), loadProjectDatabases()])
    } catch (error) {
      console.error("Lỗi khởi động database:", error)
      toast.error(error instanceof Error ? error.message : "Không thể khởi động database")
    } finally {
      setDeploying(false)
    }
  }

  const handleDatabaseStop = async (databaseId: number, resourceName: string) => {
    if (!id) return
    try {
      await stopProjectDatabase(id, databaseId)
      toast.success(`Đã tạm dừng ${resourceName}!`)
      await Promise.all([loadProjectOverview(), loadProjectDatabases()])
    } catch (error) {
      console.error("Lỗi tạm dừng database:", error)
      toast.error(error instanceof Error ? error.message : "Không thể tạm dừng database")
    }
  }

  // Xóa component
  const handleDelete = (resourceName: string, resourceType: "database" | "backend" | "frontend", resourceId?: number) => {
    if (!resourceId) {
      toast.error("Không tìm thấy ID của resource")
      return
    }
    setDeleteTarget({ type: resourceType, id: resourceId, name: resourceName })
  }

  const handleConfirmDeleteResource = async () => {
    if (!deleteTarget || !id) return

    setIsDeletingResource(true)
    try {
      if (deleteTarget.type === "database") {
        await deleteProjectDatabase(id, deleteTarget.id)
        toast.success(`Đã xóa database "${deleteTarget.name}" thành công!`)
        await Promise.all([loadProjectOverview(), loadProjectDatabases()])
      } else if (deleteTarget.type === "backend") {
        await deleteProjectBackend(id, deleteTarget.id)
        toast.success(`Đã xóa backend "${deleteTarget.name}" thành công!`)
        await Promise.all([loadProjectOverview(), loadProjectBackendsData()])
      } else if (deleteTarget.type === "frontend") {
        await deleteProjectFrontend(id, deleteTarget.id)
        toast.success(`Đã xóa frontend "${deleteTarget.name}" thành công!`)
        await Promise.all([loadProjectOverview(), loadProjectFrontendsData()])
      }
      setDeleteTarget(null)
    } catch (error) {
      console.error("Lỗi xóa resource:", error)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa resource")
    } finally {
      setIsDeletingResource(false)
    }
  }

  // Kiểm tra DNS
  const handleCheckDNS = async (domainNameSystem: string) => {
    if (!domainNameSystem) {
      toast.error("DNS không hợp lệ")
      return
    }

    try {
      const result = await checkDomainNameSystem(domainNameSystem)
      if (result.exists) {
        toast.error(result.message || `DNS "${domainNameSystem}" đã được sử dụng`)
      } else {
        toast.success(result.message || `DNS "${domainNameSystem}" có thể sử dụng`)
      }
    } catch (error) {
      console.error("Lỗi kiểm tra DNS:", error)
      toast.error(error instanceof Error ? error.message : "Không thể kiểm tra DNS")
    }
  }

  // Xem chi tiết component
  const handleViewDetails = (resourceName: string, resourceType: "database" | "backend" | "frontend") => {
    toast.info(`Xem chi tiết ${resourceName} (${resourceType})`)
    // Có thể mở modal hoặc navigate đến trang chi tiết
  }

  // Xóa project
  const handleDeleteProject = async () => {
    if (!id || !user?.username) {
      toast.error("Không thể xóa project")
      return
    }

    setIsDeleting(true)
    try {
      await deleteProject(id, user.username)
      toast.success("Đã xóa project thành công!")
      navigate("/projects")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa project")
      console.error(error)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // Load deployment history
  const loadDeploymentHistory = async () => {
    if (!id) return

    setLoadingHistory(true)
    try {
      const response = await getProjectDeploymentHistory(id)
      setDeploymentHistory(response.historyItems || [])
    } catch (error) {
      console.error("Lỗi load deployment history:", error)
      toast.error("Không thể tải lịch sử triển khai")
    } finally {
      setLoadingHistory(false)
    }
  }

  // Get type label và icon
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "PROJECT":
        return "Project"
      case "DATABASE":
        return "Database"
      case "BACKEND":
        return "Backend"
      case "FRONTEND":
        return "Frontend"
      default:
        return type
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "PROJECT":
        return { variant: "default" as const, label: "Project" }
      case "DATABASE":
        return { variant: "secondary" as const, label: "Database" }
      case "BACKEND":
        return { variant: "outline" as const, label: "Backend" }
      case "FRONTEND":
        return { variant: "outline" as const, label: "Frontend" }
      default:
        return { variant: "secondary" as const, label: type }
    }
  }

    // Tính toán thống kê - ưu tiên dữ liệu từ API, nếu không có thì tính từ project
    const calculateStats = () => {
      // Nếu có dữ liệu từ API overview, sử dụng nó
      if (projectOverview) {
        return projectOverview
      }

      // Nếu không có, tính từ project (fallback)
      // Sử dụng displayProject nếu đã được tạo, nếu không thì return null
      const currentProject = project || (projectBasicInfo ? {
        id: id || "",
        name: projectBasicInfo.name,
        description: projectBasicInfo.description,
        status: "running" as const,
        updatedAt: projectBasicInfo.updatedAt,
        components: {
          databases: [],
          backends: [],
          frontends: [],
        },
        endpoints: [],
      } : null)

      if (!currentProject) return null

      const calculateComponentStats = (components: Array<{ status: ComponentStatus }>) => {
        const stats = {
          total: components.length,
          running: 0,
          paused: 0,
          other: 0,
        }

        components.forEach((comp) => {
          if (comp.status === "deployed") {
            stats.running++
          } else if (comp.status === "pending" || comp.status === "building") {
            stats.paused++
          } else {
            stats.other++
          }
        })

        return stats
      }

      return {
        databases: calculateComponentStats(currentProject.components.databases),
        backends: calculateComponentStats(currentProject.components.backends),
        frontends: calculateComponentStats(currentProject.components.frontends),
      }
    }

  const stats = calculateStats()
  const minAdjustableReplicas = MIN_BACKEND_REPLICAS
  const maxAdjustableReplicas = resolveMaxBackendReplicas(selectedBackendForAdjust)

  // Map trạng thái
  const getStatusBadge = (status: ComponentStatus | Project["status"]) => {
    switch (status) {
      case "deployed":
      case "running":
        return { variant: "success" as const, label: "Đang chạy" }
      case "building":
      case "deploying":
        return { variant: "default" as const, label: "Đang triển khai" }
      case "pending":
        return { variant: "warning" as const, label: "Chờ xử lý" }
      case "error":
        return { variant: "destructive" as const, label: "Lỗi" }
      case "paused":
        return { variant: "secondary" as const, label: "Tạm dừng" }
      default:
        return { variant: "secondary" as const, label: String(status) }
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Đã sao chép vào clipboard!")
  }

  // Schema validation cho form thêm database
  const databaseSchema = z.object({
    name: z.string().min(1, "Tên database không được để trống"),
    type: z.enum(["mysql", "mongodb"]),
    databaseName: z.string().min(1, "Tên database không được để trống"),
    username: z.string().min(1, "Username database không được để trống"),
    password: z.string().min(1, "Password database không được để trống"),
  })

  // Schema validation cho form thêm backend
  const backendSchema = z.object({
    name: z.string().min(1, "Tên backend không được để trống"),
    tech: z.enum(["spring", "node"]),
    sourceKind: z.enum(["zip", "image"]),
    sourceRef: z.string().optional(),
    dns: z.string().optional(),
    // Database connection fields
    dbName: z.string().optional(),
    dbIp: z.string().optional(),
    dbPort: z.string().optional(),
    dbUsername: z.string().optional(),
    dbPassword: z.string().optional(),
  }).refine((data) => {
    if (data.sourceKind === "image") {
      return !!data.sourceRef && data.sourceRef.trim() !== ""
    }
    return true
  }, {
    message: "Vui lòng nhập Docker image hoặc upload file ZIP",
    path: ["sourceRef"]
  })

  // Schema validation cho form thêm frontend
  const frontendSchema = z.object({
    name: z.string().min(1, "Tên frontend không được để trống"),
    tech: z.enum(["react", "vue", "angular"]),
    sourceKind: z.enum(["zip", "image"]),
    sourceRef: z.string().optional(),
    publicUrl: z.string().optional(),
  }).refine((data) => {
    if (data.sourceKind === "image") {
      return !!data.sourceRef && data.sourceRef.trim() !== ""
    }
    return true
  }, {
    message: "Vui lòng nhập Docker image hoặc upload file ZIP",
    path: ["sourceRef"]
  })

  // Form thêm database
  const {
    register: registerDb,
    handleSubmit: handleSubmitDb,
    reset: resetDb,
    control: controlDb,
    formState: { errors: errorsDb },
  } = useForm<z.infer<typeof databaseSchema>>({
    resolver: zodResolver(databaseSchema),
    defaultValues: {
      type: "mysql",
    },
  })

  const onSubmitDatabase = async (data: z.infer<typeof databaseSchema>) => {
    if (!id || !user?.username) {
      toast.error("Không thể thêm database")
      return
    }

    setIsDeployingDatabase(true)
    const loadingToast = toast.loading("Đang triển khai database...", {
      description: "Vui lòng đợi trong giây lát",
    })

    try {
      // Chuyển đổi databaseType từ lowercase sang uppercase
      const databaseType = data.type.toUpperCase() as "MYSQL" | "MONGODB"
      
      // Gọi API deploy database
      await deployDatabase({
        projectName: data.name,
        databaseType: databaseType,
        databaseName: data.databaseName || data.name,
        databaseUsername: data.username || "root",
        databasePassword: data.password || "password",
        file: zipFileDb || undefined,
        username: user.username,
        projectId: Number(id),
      })

      toast.dismiss(loadingToast)
      toast.success(`Đã thêm database "${data.name}" thành công!`)
      setShowAddDatabase(false)
      resetDb()
      setZipFileDb(null)
      setZipErrorDb("")
      
      // Reload danh sách databases
      if (id) {
        try {
          const response = await getProjectDatabases(id)
          setProjectDatabases(response.databases || [])
        } catch (err) {
          console.error("Lỗi reload databases:", err)
        }
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi thêm database")
      console.error(error)
    } finally {
      setIsDeployingDatabase(false)
    }
  }

  // Form thêm backend
  const {
    register: registerBe,
    handleSubmit: handleSubmitBe,
    watch: watchBe,
    setValue: setValueBe,
    reset: resetBe,
    control: controlBe,
    formState: { errors: errorsBe },
  } = useForm<z.infer<typeof backendSchema>>({
    resolver: zodResolver(backendSchema),
    defaultValues: {
      tech: "spring",
      sourceKind: "image",
    },
  })

  const sourceTypeBe = watchBe("sourceKind")
  const dockerImageBe = watchBe("sourceRef")
  const dnsBe = watchBe("dns")
  const [dnsStatusBe, setDnsStatusBe] = useState<"idle" | "valid" | "invalid">("idle")
  const [dnsMessageBe, setDnsMessageBe] = useState("")
  const [isCheckingDnsBe, setIsCheckingDnsBe] = useState(false)

  // Validate Docker image
  const validateDockerBe = () => {
    if (sourceTypeBe === "image" && dockerImageBe) {
      const validation = validateDockerImage(dockerImageBe)
      if (!validation.valid) {
        // Có thể set error state nếu cần
      }
    }
  }

  useEffect(() => {
    setDnsStatusBe("idle")
    setDnsMessageBe("")
  }, [dnsBe])

  // Validate DNS
  const validateDNSBe = () => {
    if (dnsBe) {
      const validation = validateDNS(dnsBe)
      if (!validation.valid) {
        setDnsStatusBe("invalid")
        setDnsMessageBe(validation.message || "DNS không hợp lệ")
      }
    }
  }

  const handleCheckDnsBe = async () => {
    if (!dnsBe) {
      toast.info("Vui lòng nhập DNS trước khi kiểm tra")
      return
    }

    setIsCheckingDnsBe(true)
    setDnsStatusBe("idle")
    setDnsMessageBe("")
    try {
      const response = await checkDomainNameSystem(dnsBe)
      if (response.exists) {
        setDnsStatusBe("invalid")
        setDnsMessageBe(response.message || "DNS đã tồn tại")
        toast.error(response.message || "DNS đã tồn tại")
      } else {
        setDnsStatusBe("valid")
        setDnsMessageBe(response.message || "DNS có thể sử dụng")
        toast.success(response.message || "DNS có thể sử dụng")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể kiểm tra DNS"
      setDnsStatusBe("invalid")
      setDnsMessageBe(message)
      toast.error(message)
    } finally {
      setIsCheckingDnsBe(false)
    }
  }

  const onSubmitBackend = async (data: z.infer<typeof backendSchema>) => {
    if (!id || !user?.username) {
      toast.error("Không thể thêm backend")
      return
    }

    if (data.sourceKind === "zip" && !zipFileBe) {
      toast.error("Vui lòng chọn file ZIP")
      return
    }

    if (data.sourceKind === "zip" && zipFileBe) {
      const validation = validateZipFile(zipFileBe)
      if (!validation.valid) {
        setZipErrorBe(validation.message || "")
        return
      }
    }

    // Validate Docker image
    if (data.sourceKind === "image") {
      if (!data.sourceRef || data.sourceRef.trim() === "") {
        toast.error("Vui lòng nhập Docker image")
        return
      }
      const validation = validateDockerImage(data.sourceRef)
      if (!validation.valid) {
        toast.error(validation.message || "Định dạng Docker image không hợp lệ")
        return
      }
    }

    setIsDeployingBackend(true)
    const loadingToast = toast.loading("Đang triển khai backend...", {
      description: "Vui lòng đợi trong giây lát",
    })

    try {
      // Chuyển đổi tech sang frameworkType
      const frameworkType = data.tech === "spring" ? "SPRINGBOOT" : "NODEJS" as "SPRINGBOOT" | "NODEJS"
      // Chuyển đổi sourceKind sang deploymentType
      const deploymentType = data.sourceKind === "zip" ? "FILE" : "DOCKER" as "FILE" | "DOCKER"

      // Gọi API deploy backend
      await deployBackend({
        projectName: data.name,
        deploymentType: deploymentType,
        frameworkType: frameworkType,
        dockerImage: data.sourceKind === "image" ? data.sourceRef : undefined,
        file: data.sourceKind === "zip" ? zipFileBe || undefined : undefined,
        databaseIp: data.dbIp || "",
        databasePort: Number(data.dbPort) || 3306,
        databaseName: data.dbName || "",
        databaseUsername: data.dbUsername || "",
        databasePassword: data.dbPassword || "",
        domainNameSystem: data.dns || "",
        username: user.username,
        projectId: Number(id),
      })

      toast.dismiss(loadingToast)
      toast.success(`Đã thêm backend "${data.name}" thành công!`)
      setShowAddBackend(false)
      resetBe()
      setZipFileBe(null)
      setZipErrorBe("")
      
      // Reload danh sách backends
      if (id) {
        try {
          const response = await getProjectBackends(id)
          setProjectBackends(response.backends || [])
        } catch (err) {
          console.error("Lỗi reload backends:", err)
        }
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi thêm backend")
      console.error(error)
    } finally {
      setIsDeployingBackend(false)
    }
  }

  // Form thêm frontend
  const {
    register: registerFe,
    handleSubmit: handleSubmitFe,
    watch: watchFe,
    setValue: setValueFe,
    reset: resetFe,
    control: controlFe,
    formState: { errors: errorsFe },
  } = useForm<z.infer<typeof frontendSchema>>({
    resolver: zodResolver(frontendSchema),
    defaultValues: {
      tech: "react",
      sourceKind: "image",
    },
  })

  const sourceTypeFe = watchFe("sourceKind")
  const dockerImageFe = watchFe("sourceRef")
  const publicUrlFe = watchFe("publicUrl")
  const [dnsStatusFe, setDnsStatusFe] = useState<"idle" | "valid" | "invalid">("idle")
  const [dnsMessageFe, setDnsMessageFe] = useState("")
  const [isCheckingDnsFe, setIsCheckingDnsFe] = useState(false)

  // Validate Docker image
  const validateDockerFe = () => {
    if (sourceTypeFe === "image" && dockerImageFe) {
      const validation = validateDockerImage(dockerImageFe)
      if (!validation.valid) {
        // Có thể set error state nếu cần
      }
    }
  }

  useEffect(() => {
    setDnsStatusFe("idle")
    setDnsMessageFe("")
  }, [publicUrlFe])

  // Validate DNS
  const validateDNSPublicUrl = () => {
    if (publicUrlFe) {
      const validation = validateDNS(publicUrlFe)
      if (!validation.valid) {
        setDnsStatusFe("invalid")
        setDnsMessageFe(validation.message || "DNS không hợp lệ")
      }
    }
  }

  const handleCheckDnsFe = async () => {
    if (!publicUrlFe) {
      toast.info("Vui lòng nhập DNS trước khi kiểm tra")
      return
    }

    setIsCheckingDnsFe(true)
    setDnsStatusFe("idle")
    setDnsMessageFe("")
    try {
      const response = await checkDomainNameSystem(publicUrlFe)
      if (response.exists) {
        setDnsStatusFe("invalid")
        setDnsMessageFe(response.message || "DNS đã tồn tại")
        toast.error(response.message || "DNS đã tồn tại")
      } else {
        setDnsStatusFe("valid")
        setDnsMessageFe(response.message || "DNS có thể sử dụng")
        toast.success(response.message || "DNS có thể sử dụng")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể kiểm tra DNS"
      setDnsStatusFe("invalid")
      setDnsMessageFe(message)
      toast.error(message)
    } finally {
      setIsCheckingDnsFe(false)
    }
  }

  const onSubmitFrontend = async (data: z.infer<typeof frontendSchema>) => {
    if (!id || !user?.username) {
      toast.error("Không thể thêm frontend")
      return
    }

    if (data.sourceKind === "zip" && !zipFileFe) {
      toast.error("Vui lòng chọn file ZIP")
      return
    }

    if (data.sourceKind === "zip" && zipFileFe) {
      const validation = validateZipFile(zipFileFe)
      if (!validation.valid) {
        setZipErrorFe(validation.message || "")
        return
      }
    }

    // Validate Docker image
    if (data.sourceKind === "image") {
      if (!data.sourceRef || data.sourceRef.trim() === "") {
        toast.error("Vui lòng nhập Docker image")
        return
      }
      const validation = validateDockerImage(data.sourceRef)
      if (!validation.valid) {
        toast.error(validation.message || "Định dạng Docker image không hợp lệ")
        return
      }
    }

    setIsDeployingFrontend(true)
    const loadingToast = toast.loading("Đang triển khai frontend...", {
      description: "Vui lòng đợi trong giây lát",
    })

    try {
      // Chuyển đổi tech sang frameworkType
      const frameworkType = data.tech.toUpperCase() as "REACT" | "VUE" | "ANGULAR"
      // Chuyển đổi sourceKind sang deploymentType
      const deploymentType = data.sourceKind === "zip" ? "FILE" : "DOCKER" as "FILE" | "DOCKER"

      // Gọi API deploy frontend
      await deployFrontend({
        projectName: data.name,
        deploymentType: deploymentType,
        frameworkType: frameworkType,
        dockerImage: data.sourceKind === "image" ? data.sourceRef : undefined,
        file: data.sourceKind === "zip" ? zipFileFe || undefined : undefined,
        domainNameSystem: data.publicUrl || "",
        username: user.username,
        projectId: Number(id),
      })

      toast.dismiss(loadingToast)
      toast.success(`Đã thêm frontend "${data.name}" thành công!`)
      setShowAddFrontend(false)
      resetFe()
      setZipFileFe(null)
      setZipErrorFe("")
      
      // Reload danh sách frontends
      if (id) {
        try {
          const response = await getProjectFrontends(id)
          setProjectFrontends(response.frontends || [])
        } catch (err) {
          console.error("Lỗi reload frontends:", err)
        }
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi thêm frontend")
      console.error(error)
    } finally {
      setIsDeployingFrontend(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Nếu không có projectBasicInfo thì có thể project không tồn tại
  if (!projectBasicInfo && !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Không tìm thấy project
          </h2>
          <Button onClick={() => navigate("/projects")}>Quay lại danh sách</Button>
        </div>
      </div>
    )
  }

  // Tạo project object nếu chưa có (từ mock-api) nhưng có dữ liệu từ API
  const displayProject = project || {
    id: id || "",
    name: projectBasicInfo?.name || "Project",
    description: projectBasicInfo?.description,
    status: "running",
    createdAt: projectBasicInfo?.createdAt || projectBasicInfo?.updatedAt || new Date().toISOString(),
    updatedAt: projectBasicInfo?.updatedAt || new Date().toISOString(),
    components: {
      databases: [],
      backends: [],
      frontends: [],
    },
        endpoints: [],
  } as Project

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/projects")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay lại
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Xóa Project
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-3xl mb-2">
                    {projectBasicInfo?.name || displayProject.name}
                  </CardTitle>
                  {(projectBasicInfo?.description || displayProject.description) && (
                    <CardDescription className="mb-4">
                      {projectBasicInfo?.description || displayProject.description}
                    </CardDescription>
                  )}
                  <span className="text-sm text-muted-foreground">
                    Ngày tạo:{" "}
                    {projectBasicInfo?.createdAt
                      ? new Date(projectBasicInfo.createdAt).toLocaleString("vi-VN")
                      : new Date(displayProject.createdAt ?? displayProject.updatedAt).toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="overview" className="w-full" onValueChange={(value) => {
              // Khi chuyển sang tab "overview", load overview
              if (value === "overview" && id) {
                loadProjectOverview()
              }
              // Khi chuyển sang tab "history", load deployment history
              if (value === "history" && id && deploymentHistory.length === 0 && !loadingHistory) {
                loadDeploymentHistory()
              }
            }}>
              <TabsList className="w-full justify-start border-b rounded-none">
                <TabsTrigger value="overview">Tổng quan</TabsTrigger>
                <TabsTrigger value="databases">
                  Databases ({projectDatabases.length > 0 ? projectDatabases.length : (stats?.databases?.total ?? displayProject.components.databases.length)})
                </TabsTrigger>
                <TabsTrigger value="backends">
                  Backends ({projectBackends.length > 0 ? projectBackends.length : (stats?.backends?.total ?? displayProject.components.backends.length)})
                </TabsTrigger>
                <TabsTrigger value="frontends">
                  Frontends ({projectFrontends.length > 0 ? projectFrontends.length : (stats?.frontends?.total ?? displayProject.components.frontends.length)})
                </TabsTrigger>
                <TabsTrigger value="history">Lịch sử triển khai</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="p-6">
                <div className="space-y-6">
                  {/* Thống kê với biểu đồ */}
                  {stats && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Thống kê Components</h3>
                      <OverviewStats
                        databases={stats.databases}
                        backends={stats.backends}
                        frontends={stats.frontends}
                      />
                    </div>
                  )}

                  {/* Tổng hợp nhanh */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Tổng hợp</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {stats?.databases?.total ?? displayProject.components.databases.length}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Databases</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {stats?.backends?.total ?? displayProject.components.backends.length}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Backends</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {stats?.frontends?.total ?? displayProject.components.frontends.length}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Frontends</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="text-2xl font-bold">
                            {(stats?.databases?.total ?? displayProject.components.databases.length) +
                              (stats?.backends?.total ?? displayProject.components.backends.length) +
                              (stats?.frontends?.total ?? displayProject.components.frontends.length)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Tổng cộng</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="databases" className="p-6">
                {/* Header với nút thêm */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Databases</h3>
                  <Button onClick={() => setShowAddDatabase(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm Database
                  </Button>
                </div>

                {/* Thống kê Databases */}
                {stats && (
                  <Card className="mb-6">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {stats.databases.total}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Tổng số</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {stats.databases.running}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Đang chạy</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {stats.databases.paused}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Đang dừng</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(projectDatabases.length > 0 || displayProject.components.databases.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(projectDatabases.length > 0 ? projectDatabases : displayProject.components.databases).map((db) => {
                      // Map dữ liệu từ API hoặc mock
                      const isApiData = 'databaseType' in db
                      const dbName = isApiData ? (db as DatabaseInfo).projectName : (db as any).name
                      const dbDescription = isApiData ? (db as DatabaseInfo).description : undefined
                      const dbType = isApiData ? (db as DatabaseInfo).databaseType : (db as any).type
                      const dbStatus = getStatusBadge(isApiData ? (db as DatabaseInfo).status.toLowerCase() as ComponentStatus : (db as any).status)
                      const dbIp = isApiData ? (db as DatabaseInfo).databaseIp : undefined
                      const dbPort = isApiData ? (db as DatabaseInfo).databasePort : undefined
                      const dbDatabaseName = isApiData ? (db as DatabaseInfo).databaseName : (db as any).databaseName
                      const dbUsername = isApiData ? (db as DatabaseInfo).databaseUsername : (db as any).username
                      const dbPassword = isApiData ? (db as DatabaseInfo).databasePassword : undefined
                      const dbId = isApiData ? `api-${(db as DatabaseInfo).id}` : (db as any).id
                      const dbApiId = isApiData ? (db as DatabaseInfo).id : null
                      const rawDbStatus = isApiData ? (db as DatabaseInfo).status : (db as any).status
                      const dbStatusKey = rawDbStatus ? rawDbStatus.toString().toLowerCase() : ""

                      return (
                        <Card key={dbId}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{dbName}</CardTitle>
                                {dbDescription && (
                                  <CardDescription className="mt-1">
                                    {dbDescription}
                                  </CardDescription>
                                )}
                                <CardDescription className="mt-1">
                                  {dbType === "MYSQL" || dbType === "mysql" ? "MySQL" : dbType === "MONGODB" || dbType === "mongodb" ? "MongoDB" : dbType}
                                </CardDescription>
                              </div>
                              <Badge variant={dbStatus.variant}>
                                {dbStatus.label}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {/* IP, Port, Database Name - chung 1 hàng */}
                              {(dbIp || dbPort || dbDatabaseName) && (
                                <div className="grid grid-cols-3 gap-4">
                                  {/* IP */}
                                  {dbIp && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        IP
                                      </span>
                                      <p className="text-sm font-mono mt-1">{dbIp}</p>
                                    </div>
                                  )}
                                  
                                  {/* Port */}
                                  {dbPort && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        Port
                                      </span>
                                      <p className="text-sm font-mono mt-1">{dbPort}</p>
                                    </div>
                                  )}

                                  {/* Database Name */}
                                  {dbDatabaseName && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        Database Name
                                      </span>
                                      <p className="text-sm font-mono mt-1">{dbDatabaseName}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Username và Password - chung 1 hàng */}
                              {(dbUsername || dbPassword) && (
                                <div className="grid grid-cols-2 gap-4">
                                  {/* Username */}
                                  {dbUsername && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        Username
                                      </span>
                                      <p className="text-sm font-mono mt-1">{dbUsername}</p>
                                    </div>
                                  )}

                                  {/* Password với icon toggle */}
                                  {dbPassword && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        Password
                                      </span>
                                      <div className="relative mt-1">
                                        <p className="text-sm font-mono pr-8">
                                          {showPasswords[dbId] ? dbPassword : "••••••••"}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => setShowPasswords(prev => ({ ...prev, [dbId]: !prev[dbId] }))}
                                          className="absolute right-0 top-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                                          aria-label={showPasswords[dbId] ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                                        >
                                          {showPasswords[dbId] ? (
                                            <EyeOff className="w-4 h-4" />
                                          ) : (
                                            <Eye className="w-4 h-4" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end mt-4">
                              <DropdownMenu
                                trigger={
                                  <Button variant="outline" size="sm">
                                    <MoreVertical className="w-4 h-4 mr-2" />
                                    Thao tác
                                  </Button>
                                }
                              >
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (dbApiId !== null) {
                                      handleDatabaseStart(dbApiId, dbName)
                                    } else {
                                      handleStart(dbName, "database")
                                    }
                                  }}
                                  disabled={deploying || ["running", "deployed"].includes(dbStatusKey)}
                                >
                                  <Play className="w-4 h-4 mr-2" />
                                  Chạy
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (dbApiId !== null) {
                                      handleDatabaseStop(dbApiId, dbName)
                                    } else {
                                      handlePause(dbName, "database")
                                    }
                                  }}
                                  disabled={
                                    deploying ||
                                    ["paused", "stopped"].includes(dbStatusKey) ||
                                    ["pending", "building", "deploying"].includes(dbStatusKey)
                                  }
                                >
                                  <Pause className="w-4 h-4 mr-2" />
                                  Tạm dừng
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (dbApiId !== null) {
                                      handleDelete(dbName, "database", dbApiId)
                                    } else {
                                      handleDelete(dbName, "database")
                                    }
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Xóa
                                </DropdownMenuItem>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    Chưa có database nào
                  </p>
                )}
              </TabsContent>

              <TabsContent value="backends" className="p-6">
                {/* Header với nút thêm */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Backends</h3>
                  <Button onClick={() => setShowAddBackend(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm Backend
                  </Button>
                </div>

                {/* Thống kê Backends */}
                {stats && (
                  <Card className="mb-6">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {stats.backends.total}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Tổng số</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {stats.backends.running}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Đang chạy</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {stats.backends.paused}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Đang dừng</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(projectBackends.length > 0 || displayProject.components.backends.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(projectBackends.length > 0 ? projectBackends : displayProject.components.backends).map((be) => {
                      // Map dữ liệu từ API hoặc mock
                      const isApiData = 'frameworkType' in be
                  const backendData = be as BackendInfo
                      const beName = isApiData ? (be as BackendInfo).projectName : (be as any).name
                      const beDescription = isApiData ? (be as BackendInfo).description : undefined
                      const beTech = isApiData ? (be as BackendInfo).frameworkType : (be as any).tech
                      const rawBeStatus = isApiData ? (be as BackendInfo).status : (be as any).status
                      const beStatusKey = rawBeStatus ? rawBeStatus.toString().toLowerCase() : ""
                      const beStatus = getStatusBadge(isApiData ? (be as BackendInfo).status.toLowerCase() as ComponentStatus : (be as any).status)
                      const beDns = isApiData ? (be as BackendInfo).domainNameSystem : (be as any).dns
                      const beDockerImage = isApiData ? (be as BackendInfo).dockerImage : (be as any).source?.ref
                      const beDbIp = isApiData ? (be as BackendInfo).databaseIp : undefined
                      const beDbPort = isApiData ? (be as BackendInfo).databasePort : undefined
                      const beDbName = isApiData ? (be as BackendInfo).databaseName : undefined
                      const beDbUsername = isApiData ? (be as BackendInfo).databaseUsername : undefined
                      const beDbPassword = isApiData ? (be as BackendInfo).databasePassword : undefined
                      const beId = isApiData ? `api-be-${(be as BackendInfo).id}` : (be as any).id
                      const beApiId = isApiData ? (be as BackendInfo).id : null

                      return (
                        <Card key={beId}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{beName}</CardTitle>
                                {beDescription && (
                                  <CardDescription className="mt-1">
                                    {beDescription}
                                  </CardDescription>
                                )}
                                <CardDescription className="mt-1">
                                  {beTech === "SPRING" || beTech === "spring" ? "Spring Boot" : beTech === "NODEJS" || beTech === "node" ? "Node.js" : beTech}
                                </CardDescription>
                              </div>
                              <Badge variant={beStatus.variant}>
                                {beStatus.label}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {/* DNS */}
                              {beDns && (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase">
                                      DNS
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => copyToClipboard(beDns!)}
                                      title="Sao chép DNS"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => handleCheckDNS(beDns)}
                                      title="Kiểm tra DNS"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <p className="text-sm font-mono mt-1">{beDns}</p>
                                </div>
                              )}

                              {/* Docker Image */}
                              {beDockerImage && (
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground uppercase">
                                    Docker Image
                                  </span>
                                  <p className="text-sm font-mono mt-1">{beDockerImage}</p>
                                </div>
                              )}

                              {/* IP, Port, Database Name - chung 1 hàng (nếu có database connection) */}
                              {(beDbIp || beDbPort || beDbName) && (
                                <div className="grid grid-cols-3 gap-4">
                                  {/* IP */}
                                  {beDbIp && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        IP
                                      </span>
                                      <p className="text-sm font-mono mt-1">{beDbIp}</p>
                                    </div>
                                  )}
                                  
                                  {/* Port */}
                                  {beDbPort && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        Port
                                      </span>
                                      <p className="text-sm font-mono mt-1">{beDbPort}</p>
                                    </div>
                                  )}

                                  {/* Database Name */}
                                  {beDbName && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        Database Name
                                      </span>
                                      <p className="text-sm font-mono mt-1">{beDbName}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Username và Password - chung 1 hàng (nếu có database connection) */}
                              {(beDbUsername || beDbPassword) && (
                                <div className="grid grid-cols-2 gap-4">
                                  {/* Username */}
                                  {beDbUsername && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        Username
                                      </span>
                                      <p className="text-sm font-mono mt-1">{beDbUsername}</p>
                                    </div>
                                  )}

                                  {/* Password với icon toggle */}
                                  {beDbPassword && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground uppercase">
                                        Password
                                      </span>
                                      <div className="relative mt-1">
                                        <p className="text-sm font-mono pr-8">
                                          {showPasswords[beId] ? beDbPassword : "••••••••"}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => setShowPasswords(prev => ({ ...prev, [beId]: !prev[beId] }))}
                                          className="absolute right-0 top-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                                          aria-label={showPasswords[beId] ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                                        >
                                          {showPasswords[beId] ? (
                                            <EyeOff className="w-4 h-4" />
                                          ) : (
                                            <Eye className="w-4 h-4" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end mt-4">
                              <DropdownMenu
                                trigger={
                                  <Button variant="outline" size="sm">
                                    <MoreVertical className="w-4 h-4 mr-2" />
                                    Thao tác
                                  </Button>
                                }
                              >
                                {beApiId !== null && (
                                  <DropdownMenuItem
                                    onClick={() => openAdjustBackendModal(backendData)}
                                  >
                                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                                    Điều chỉnh replicas
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (beApiId !== null) {
                                      handleBackendStart(beApiId, beName)
                                    } else {
                                      handleStart(beName, "backend")
                                    }
                                  }}
                                  disabled={deploying || ["running", "deployed"].includes(beStatusKey)}
                                >
                                  <Play className="w-4 h-4 mr-2" />
                                  Chạy
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (beApiId !== null) {
                                      handleBackendStop(beApiId, beName)
                                    } else {
                                      handlePause(beName, "backend")
                                    }
                                  }}
                                  disabled={
                                    deploying ||
                                    ["paused", "stopped"].includes(beStatusKey) ||
                                    ["pending", "building", "deploying"].includes(beStatusKey)
                                  }
                                >
                                  <Pause className="w-4 h-4 mr-2" />
                                  Tạm dừng
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (beApiId !== null) {
                                      handleDelete(beName, "backend", beApiId)
                                    } else {
                                      handleDelete(beName, "backend")
                                    }
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Xóa
                                </DropdownMenuItem>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    Chưa có backend nào
                  </p>
                )}
              </TabsContent>

              <TabsContent value="frontends" className="p-6">
                {/* Header với nút thêm */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Frontends</h3>
                  <Button onClick={() => setShowAddFrontend(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm Frontend
                  </Button>
                </div>

                {/* Thống kê Frontends */}
                {stats && (
                  <Card className="mb-6">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {stats.frontends.total}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Tổng số</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {stats.frontends.running}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Đang chạy</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {stats.frontends.paused}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Đang dừng</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(projectFrontends.length > 0 || displayProject.components.frontends.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(projectFrontends.length > 0 ? projectFrontends : displayProject.components.frontends).map((fe) => {
                      // Map dữ liệu từ API hoặc mock
                      const isApiData = 'frameworkType' in fe
                  const frontendData = fe as FrontendInfo
                      const feName = isApiData ? (fe as FrontendInfo).projectName : (fe as any).name
                      const feDescription = isApiData ? (fe as FrontendInfo).description : undefined
                      const feTech = isApiData ? (fe as FrontendInfo).frameworkType : (fe as any).tech
                      const rawFeStatus = isApiData ? (fe as FrontendInfo).status : (fe as any).status
                      const feStatusKey = rawFeStatus ? rawFeStatus.toString().toLowerCase() : ""
                      const feStatus = getStatusBadge(isApiData ? (fe as FrontendInfo).status.toLowerCase() as ComponentStatus : (fe as any).status)
                      const feDns = isApiData ? (fe as FrontendInfo).domainNameSystem : (fe as any).publicUrl
                      const feDockerImage = isApiData ? (fe as FrontendInfo).dockerImage : (fe as any).source?.ref
                      const feId = isApiData ? `api-fe-${(fe as FrontendInfo).id}` : (fe as any).id
                      const feApiId = isApiData ? (fe as FrontendInfo).id : null

                      return (
                        <Card key={feId}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{feName}</CardTitle>
                                {feDescription && (
                                  <CardDescription className="mt-1">
                                    {feDescription}
                                  </CardDescription>
                                )}
                                <CardDescription className="mt-1">
                                  {feTech === "REACT" || feTech === "react" ? "React" : 
                                   feTech === "VUE" || feTech === "vue" ? "Vue" : 
                                   feTech === "ANGULAR" || feTech === "angular" ? "Angular" : feTech}
                                </CardDescription>
                              </div>
                              <Badge variant={feStatus.variant}>
                                {feStatus.label}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {/* DNS */}
                              {feDns && (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase">
                                      DNS
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => copyToClipboard(feDns!)}
                                      title="Sao chép DNS"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => handleCheckDNS(feDns)}
                                      title="Kiểm tra DNS"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <a
                                    href={`http://${feDns}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                                  >
                                    {feDns}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}

                              {/* Docker Image */}
                              {feDockerImage && (
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground uppercase">
                                    Docker Image
                                  </span>
                                  <p className="text-sm font-mono mt-1">{feDockerImage}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end mt-4">
                              <DropdownMenu
                                trigger={
                                  <Button variant="outline" size="sm">
                                    <MoreVertical className="w-4 h-4 mr-2" />
                                    Thao tác
                                  </Button>
                                }
                              >
                                {feApiId !== null && (
                                  <DropdownMenuItem onClick={() => openAdjustFrontendModal(frontendData)}>
                                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                                    Điều chỉnh replicas
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (feApiId !== null) {
                                      handleFrontendStart(feApiId, feName)
                                    } else {
                                      handleStart(feName, "frontend")
                                    }
                                  }}
                                  disabled={deploying || ["running", "deployed"].includes(feStatusKey)}
                                >
                                  <Play className="w-4 h-4 mr-2" />
                                  Chạy
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (feApiId !== null) {
                                      handleFrontendStop(feApiId, feName)
                                    } else {
                                      handlePause(feName, "frontend")
                                    }
                                  }}
                                  disabled={
                                    deploying ||
                                    ["paused", "stopped"].includes(feStatusKey) ||
                                    ["pending", "building", "deploying"].includes(feStatusKey)
                                  }
                                >
                                  <Pause className="w-4 h-4 mr-2" />
                                  Tạm dừng
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (feApiId !== null) {
                                      handleDelete(feName, "frontend", feApiId)
                                    } else {
                                      handleDelete(feName, "frontend")
                                    }
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Xóa
                                </DropdownMenuItem>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    Chưa có frontend nào
                  </p>
                )}
              </TabsContent>

              <TabsContent value="history" className="p-6">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : deploymentHistory.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    Chưa có lịch sử triển khai
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deploymentHistory.map((item, index) => {
                      const badgeConfig = getTypeBadge(item.type)
                      return (
                        <div key={`${item.type}-${item.id}`} className="text-sm p-4 bg-muted rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={badgeConfig.variant}>{badgeConfig.label}</Badge>
                              <span className="font-medium">{item.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString("vi-VN")}
                            </span>
                          </div>
                          {item.description && (
                            <div className="text-muted-foreground mb-2">{item.description}</div>
                          )}
                          <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                            {item.type === "DATABASE" && item.databaseType && (
                              <span>Loại: {item.databaseType}</span>
                            )}
                            {item.type === "BACKEND" && (
                              <>
                                {item.frameworkType && <span>Framework: {item.frameworkType}</span>}
                                {item.deploymentType && <span>Deployment: {item.deploymentType}</span>}
                              </>
                            )}
                            {item.type === "FRONTEND" && (
                              <>
                                {item.frameworkType && <span>Framework: {item.frameworkType}</span>}
                                {item.deploymentType && <span>Deployment: {item.deploymentType}</span>}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Modal xem log */}
        <Dialog open={showLogModal} onOpenChange={setShowLogModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Logs</DialogTitle>
              <DialogDescription>
                Logs của quá trình triển khai
              </DialogDescription>
            </DialogHeader>
            <textarea
              className="w-full h-96 p-4 bg-muted rounded-md font-mono text-sm"
              value={selectedLogs}
              readOnly
            />
          </DialogContent>
        </Dialog>

        {/* Dialog thêm Database */}
        <Dialog open={showAddDatabase} onOpenChange={setShowAddDatabase}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm Database</DialogTitle>
              <DialogDescription>
                Thêm database mới vào project
              </DialogDescription>
            </DialogHeader>
            
            <HintBox title="Hướng dẫn">
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Chọn loại database: MySQL hoặc MongoDB</li>
                <li>
                  Hệ thống sẽ tự động tạo và quản lý database (chỉ thao tác qua ứng dụng, không cấp quyền đăng nhập DB)
                </li>
                <li>
                  Upload file ZIP: Chỉ nhận tệp .zip. Khi giải nén, tên thư mục gốc phải trùng với tên database
                </li>
                <li>Ví dụ cấu trúc: <code className="bg-muted px-1 rounded">my-database/schema.sql</code></li>
              </ul>
            </HintBox>
            
            <form onSubmit={handleSubmitDb(onSubmitDatabase)} className="space-y-4">
              {isDeployingDatabase && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                      Đang triển khai database...
                    </p>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">
                    Quá trình này có thể mất vài phút. Vui lòng không đóng cửa sổ này.
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="db-name">
                  Tên Database <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="db-name"
                  {...registerDb("name")}
                  placeholder="my-database"
                  disabled={isDeployingDatabase}
                />
                {errorsDb.name && (
                  <p className="text-sm text-destructive mt-1">
                    {errorsDb.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="db-type">
                  Loại Database <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="type"
                  control={controlDb}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isDeployingDatabase}>
                      <SelectTrigger id="db-type">
                        <SelectValue placeholder="Chọn loại database" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mysql">MySQL</SelectItem>
                        <SelectItem value="mongodb">MongoDB</SelectItem>
                      </SelectContent>
                </Select>
                  )}
                />
                {errorsDb.type && (
                  <p className="text-sm text-destructive mt-1">
                    {errorsDb.type.message}
                  </p>
                )}
              </div>

              {/* Form fields cho Database connection - chỉ hiển thị cho hệ thống */}
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Thông tin Database
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Nhập thông tin database
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="db-databaseName">
                      Tên Database <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="db-databaseName"
                      {...registerDb("databaseName")}
                      placeholder="my_database"
                      disabled={isDeployingDatabase}
                    />
                    {errorsDb.databaseName && (
                      <p className="text-sm text-destructive mt-1">
                        {errorsDb.databaseName.message}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="db-username">
                        Username Database <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="db-username"
                        {...registerDb("username")}
                        placeholder="admin"
                        disabled={isDeployingDatabase}
                      />
                      {errorsDb.username && (
                        <p className="text-sm text-destructive mt-1">
                          {errorsDb.username.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="db-password">
                        Password Database <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="db-password"
                        type="password"
                        {...registerDb("password")}
                        placeholder="••••••••"
                        disabled={isDeployingDatabase}
                      />
                      {errorsDb.password && (
                        <p className="text-sm text-destructive mt-1">
                          {errorsDb.password.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload ZIP */}
              <div>
                <Label>Upload file ZIP (tùy chọn)</Label>
                <div
                  className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDeployingDatabase 
                      ? "opacity-50 cursor-not-allowed" 
                      : "cursor-pointer hover:bg-muted"
                  }`}
                  onClick={() => !isDeployingDatabase && document.getElementById("zip-input-db-modal")?.click()}
                >
                  {zipFileDb ? (
                    <div>
                      <p className="font-medium">{zipFileDb.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(zipFileDb.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          setZipFileDb(null)
                          setZipErrorDb("")
                        }}
                      >
                        Xóa file
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm">Chọn file hoặc kéo thả vào đây</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        File ZIP, tối đa 100 MB
                      </p>
                    </div>
                  )}
                </div>
                <input
                  id="zip-input-db-modal"
                  type="file"
                  accept=".zip"
                  className="hidden"
                  disabled={isDeployingDatabase}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const validation = validateZipFile(file)
                      if (validation.valid) {
                        setZipFileDb(file)
                        setZipErrorDb("")
                      } else {
                        setZipErrorDb(validation.message || "")
                      }
                    }
                  }}
                />
                {zipErrorDb && (
                  <p className="text-sm text-destructive mt-1">{zipErrorDb}</p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddDatabase(false)
                    resetDb()
                    setZipFileDb(null)
                    setZipErrorDb("")
                  }}
                  disabled={isDeployingDatabase}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isDeployingDatabase}>
                  {isDeployingDatabase ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang triển khai...
                    </>
                  ) : (
                    "Thêm Database"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog thêm Backend */}
        <Dialog open={showAddBackend} onOpenChange={setShowAddBackend}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm Backend</DialogTitle>
              <DialogDescription>
                Thêm backend mới vào project
              </DialogDescription>
            </DialogHeader>
            
            <HintBox title="Hướng dẫn">
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Chọn Spring Boot hoặc Node.js</li>
                <li>
                  <strong>Upload ZIP:</strong> Tên thư mục gốc trùng với tên dự án. Spring Boot cần <code className="bg-muted px-1 rounded">pom.xml</code> hoặc <code className="bg-muted px-1 rounded">build.gradle</code>. Node cần <code className="bg-muted px-1 rounded">package.json</code>
                </li>
                <li>
                  <strong>Docker Image:</strong> Định dạng <code className="bg-muted px-1 rounded">owner/name:tag</code> (ví dụ: <code className="bg-muted px-1 rounded">docker.io/user/app:1.0.0</code>)
                </li>
                <li>
                  <strong>DNS:</strong> Chỉ a-z, 0-9, '-', dài 3-63 ký tự, không bắt đầu/kết thúc bằng '-' (ví dụ: <code className="bg-muted px-1 rounded">api.myapp.local.test</code>)
                </li>
                <li>
                  <strong>Kết nối Database:</strong> Nhập thông tin kết nối database (tên, IP, Port, Username, Password) để backend có thể kết nối
                </li>
              </ul>
            </HintBox>
            
            <form onSubmit={handleSubmitBe(onSubmitBackend)} className="space-y-4">
              {isDeployingBackend && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                      Đang triển khai backend...
                    </p>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">
                    Quá trình này có thể mất vài phút. Vui lòng không đóng cửa sổ này.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="be-name">Tên Backend <span className="text-destructive">*</span></Label>
                  <Input id="be-name" {...registerBe("name")} placeholder="api-service" disabled={isDeployingBackend} />
                  {errorsBe.name && (
                    <p className="text-sm text-destructive mt-1">{errorsBe.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="be-tech">Technology <span className="text-destructive">*</span></Label>
                  <Controller
                    name="tech"
                    control={controlBe}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isDeployingBackend}>
                        <SelectTrigger id="be-tech">
                          <SelectValue placeholder="Chọn technology" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spring">Spring Boot</SelectItem>
                          <SelectItem value="node">Node.js</SelectItem>
                        </SelectContent>
                  </Select>
                    )}
                  />
                  {errorsBe.tech && (
                    <p className="text-sm text-destructive mt-1">{errorsBe.tech.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>Nguồn mã nguồn <span className="text-destructive">*</span></Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant={sourceTypeBe === "zip" ? "default" : "outline"}
                    onClick={() => setValueBe("sourceKind", "zip")}
                    disabled={isDeployingBackend}
                  >
                    Upload ZIP
                  </Button>
                  <Button
                    type="button"
                    variant={sourceTypeBe === "image" ? "default" : "outline"}
                    onClick={() => setValueBe("sourceKind", "image")}
                    disabled={isDeployingBackend}
                  >
                    Docker Image
                  </Button>
                </div>
              </div>

              {sourceTypeBe === "zip" ? (
                <div>
                  <Label>File ZIP <span className="text-destructive">*</span></Label>
                  <div
                    className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDeployingBackend 
                        ? "opacity-50 cursor-not-allowed" 
                        : "cursor-pointer hover:bg-muted"
                    }`}
                    onClick={() => !isDeployingBackend && document.getElementById("zip-input-be-modal")?.click()}
                  >
                    {zipFileBe ? (
                      <div>
                        <p className="font-medium">{zipFileBe.name}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setZipFileBe(null)
                            setZipErrorBe("")
                          }}
                        >
                          Xóa file
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm">Chọn file ZIP</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="zip-input-be-modal"
                    type="file"
                    accept=".zip"
                    className="hidden"
                    disabled={isDeployingBackend}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const validation = validateZipFile(file)
                        if (validation.valid) {
                          setZipFileBe(file)
                          setZipErrorBe("")
                        } else {
                          setZipErrorBe(validation.message || "")
                        }
                      }
                    }}
                  />
                  {zipErrorBe && (
                    <p className="text-sm text-destructive mt-1">{zipErrorBe}</p>
                  )}
                </div>
              ) : (
                <div>
                  <Label htmlFor="be-source-ref">Docker Image <span className="text-destructive">*</span></Label>
                  <Input
                    id="be-source-ref"
                    {...registerBe("sourceRef")}
                    placeholder="docker.io/user/app:1.0.0"
                    className="font-mono"
                    onBlur={validateDockerBe}
                    disabled={isDeployingBackend}
                  />
                  {errorsBe.sourceRef && (
                    <p className="text-sm text-destructive mt-1">{errorsBe.sourceRef.message}</p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="be-dns">DNS (tùy chọn)</Label>
                <div className="flex gap-2">
                  <Input
                    id="be-dns"
                    {...registerBe("dns")}
                    placeholder="api-myapp"
                    className={`flex-1 ${
                      dnsStatusBe === "valid"
                        ? "border-green-500 focus-visible:ring-green-500"
                        : dnsStatusBe === "invalid"
                        ? "border-red-500 focus-visible:ring-red-500 text-red-600"
                        : ""
                    }`}
                    disabled={isDeployingBackend}
                    onBlur={validateDNSBe}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeployingBackend || isCheckingDnsBe}
                    onClick={handleCheckDnsBe}
                  >
                    {isCheckingDnsBe ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang kiểm tra...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Kiểm tra
                      </>
                    )}
                  </Button>
                </div>
                {dnsMessageBe && (
                  <p
                    className={`text-sm mt-1 ${
                      dnsStatusBe === "valid"
                        ? "text-green-600"
                        : dnsStatusBe === "invalid"
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {dnsMessageBe}
                  </p>
                )}
              </div>

              {/* Database connection fields */}
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Kết nối Database
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Nhập thông tin kết nối database cho backend
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-5">
                      <Label htmlFor="be-dbName">
                        Tên Database
                      </Label>
                      <Input
                        id="be-dbName"
                        {...registerBe("dbName")}
                        placeholder="my_database"
                        disabled={isDeployingBackend}
                      />
                    </div>
                    <div className="col-span-5">
                      <Label htmlFor="be-dbIp">
                        IP/Host Database
                      </Label>
                      <Input
                        id="be-dbIp"
                        {...registerBe("dbIp")}
                        placeholder="192.168.1.100"
                        disabled={isDeployingBackend}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="be-dbPort">
                        Port
                      </Label>
                      <Input
                        id="be-dbPort"
                        {...registerBe("dbPort")}
                        placeholder="3306"
                        disabled={isDeployingBackend}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="be-dbUsername">
                        Username Database
                      </Label>
                      <Input
                        id="be-dbUsername"
                        {...registerBe("dbUsername")}
                        placeholder="admin"
                        disabled={isDeployingBackend}
                      />
                    </div>
                    <div>
                      <Label htmlFor="be-dbPassword">
                        Password Database
                      </Label>
                      <Input
                        id="be-dbPassword"
                        type="password"
                        {...registerBe("dbPassword")}
                        placeholder="••••••••"
                        disabled={isDeployingBackend}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddBackend(false)
                    resetBe()
                    setZipFileBe(null)
                    setZipErrorBe("")
                  }}
                  disabled={isDeployingBackend}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isDeployingBackend}>
                  {isDeployingBackend ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang triển khai...
                    </>
                  ) : (
                    "Thêm Backend"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog điều chỉnh replicas Backend */}
        <Dialog
          open={showAdjustBackendModal}
          onOpenChange={(open) => {
            if (open) {
              setShowAdjustBackendModal(true)
            } else {
              closeAdjustBackendModal()
            }
          }}
        >
          <DialogContent className="max-w-md">
            {selectedBackendForAdjust && (
              <>
                <DialogHeader>
                  <DialogTitle>Điều chỉnh replicas</DialogTitle>
                  <DialogDescription>
                    Backend: {selectedBackendForAdjust.projectName}. Yêu cầu sẽ được gửi để admin phê duyệt.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {backendReplicaInfoMessage && (
                    <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                      {backendReplicaInfoMessage}
                    </div>
                  )}
                  {isLoadingBackendInfo ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      <span className="text-sm text-muted-foreground">Đang tải thông tin replicas...</span>
                    </div>
                  ) : (
                    <>
                      {pendingBackendRequest ? null : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs font-medium text-muted-foreground uppercase">Hiện tại</span>
                              <p className="text-lg font-semibold mt-1">
                                {selectedBackendForAdjust.replicas ?? "Không rõ"}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground uppercase">Tối đa</span>
                              <p className="text-lg font-semibold mt-1">{maxAdjustableReplicas}</p>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">
                              Chọn số replicas mong muốn
                            </Label>
                            <div className="flex items-center gap-3 mt-3">
                              <span className="text-sm text-muted-foreground">{minAdjustableReplicas}</span>
                              <input
                                type="range"
                                min={minAdjustableReplicas}
                                max={maxAdjustableReplicas}
                                value={adjustBackendReplicas}
                                onChange={(event) => {
                                  setAdjustBackendReplicas(Number(event.target.value))
                                }}
                                className="flex-1"
                                disabled={isLoadingBackendInfo}
                              />
                              <span className="text-sm text-muted-foreground">{maxAdjustableReplicas}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                              <Input
                                type="number"
                                min={minAdjustableReplicas}
                                max={maxAdjustableReplicas}
                                value={adjustBackendReplicas}
                                onChange={(event) => {
                                  const value = Number(event.target.value)
                                  if (!Number.isNaN(value)) {
                                    const clamped = Math.max(
                                      minAdjustableReplicas,
                                      Math.min(maxAdjustableReplicas, value)
                                    )
                                    setAdjustBackendReplicas(clamped)
                                  }
                                }}
                                className="w-24"
                                disabled={isLoadingBackendInfo}
                              />
                              <span className="text-3xl font-semibold">{adjustBackendReplicas}</span>
                              <span className="text-muted-foreground">replicas</span>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Hệ thống sẽ gửi yêu cầu điều chỉnh. Trạng thái sẽ là PENDING cho đến khi admin xử lý.
                          </p>
                        </>
                      )}
                    </>
                  )}
                  {pendingBackendRequest ? (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={closeAdjustBackendModal}
                        disabled={isCancellingBackendRequest}
                      >
                        Đóng
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleCancelPendingBackendRequest}
                        disabled={isCancellingBackendRequest}
                      >
                        {isCancellingBackendRequest ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Đang hủy...
                          </>
                        ) : (
                          "Hủy yêu cầu"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={closeAdjustBackendModal} disabled={isSubmittingBackendAdjust}>
                        Hủy
                      </Button>
                      <Button
                        onClick={handleSubmitBackendAdjust}
                        disabled={isSubmittingBackendAdjust || isLoadingBackendInfo}
                      >
                        {isSubmittingBackendAdjust ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Đang gửi...
                          </>
                        ) : (
                          "Gửi yêu cầu"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog điều chỉnh replicas Frontend */}
        <Dialog
          open={showAdjustFrontendModal}
          onOpenChange={(open) => {
            if (open) {
              setShowAdjustFrontendModal(true)
            } else {
              closeAdjustFrontendModal()
            }
          }}
        >
          <DialogContent className="max-w-md">
            {selectedFrontendForAdjust && (
              <>
                <DialogHeader>
                  <DialogTitle>Điều chỉnh replicas</DialogTitle>
                  <DialogDescription>
                    Frontend: {selectedFrontendForAdjust.projectName}. Yêu cầu sẽ được gửi để admin phê duyệt.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {frontendReplicaInfoMessage && (
                    <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                      {frontendReplicaInfoMessage}
                    </div>
                  )}
                  {isLoadingFrontendInfo ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      <span className="text-sm text-muted-foreground">Đang tải thông tin replicas...</span>
                    </div>
                  ) : (
                    <>
                      {pendingFrontendRequest ? null : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs font-medium text-muted-foreground uppercase">Hiện tại</span>
                              <p className="text-lg font-semibold mt-1">
                                {selectedFrontendForAdjust.replicas ?? "Không rõ"}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground uppercase">Tối đa</span>
                              <p className="text-lg font-semibold mt-1">
                                {resolveMaxFrontendReplicas(selectedFrontendForAdjust)}
                              </p>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">
                              Chọn số replicas mong muốn
                            </Label>
                            <div className="flex items-center gap-3 mt-3">
                              <span className="text-sm text-muted-foreground">{MIN_FRONTEND_REPLICAS}</span>
                              <input
                                type="range"
                                min={MIN_FRONTEND_REPLICAS}
                                max={resolveMaxFrontendReplicas(selectedFrontendForAdjust)}
                                value={adjustFrontendReplicas}
                                onChange={(event) => {
                                  setAdjustFrontendReplicas(Number(event.target.value))
                                }}
                                className="flex-1"
                                disabled={isLoadingFrontendInfo}
                              />
                              <span className="text-sm text-muted-foreground">
                                {resolveMaxFrontendReplicas(selectedFrontendForAdjust)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                              <Input
                                type="number"
                                min={MIN_FRONTEND_REPLICAS}
                                max={resolveMaxFrontendReplicas(selectedFrontendForAdjust)}
                                value={adjustFrontendReplicas}
                                onChange={(event) => {
                                  const value = Number(event.target.value)
                                  if (!Number.isNaN(value)) {
                                    const clamped = Math.max(
                                      MIN_FRONTEND_REPLICAS,
                                      Math.min(resolveMaxFrontendReplicas(selectedFrontendForAdjust), value)
                                    )
                                    setAdjustFrontendReplicas(clamped)
                                  }
                                }}
                                className="w-24"
                                disabled={isLoadingFrontendInfo}
                              />
                              <span className="text-3xl font-semibold">{adjustFrontendReplicas}</span>
                              <span className="text-muted-foreground">replicas</span>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Hệ thống sẽ gửi yêu cầu điều chỉnh. Trạng thái sẽ là PENDING cho đến khi admin xử lý.
                          </p>
                        </>
                      )}
                    </>
                  )}
                  {pendingFrontendRequest ? (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={closeAdjustFrontendModal}
                        disabled={isCancellingFrontendRequest}
                      >
                        Đóng
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleCancelPendingFrontendRequest}
                        disabled={isCancellingFrontendRequest}
                      >
                        {isCancellingFrontendRequest ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Đang hủy...
                          </>
                        ) : (
                          "Hủy yêu cầu"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={closeAdjustFrontendModal} disabled={isSubmittingFrontendAdjust}>
                        Hủy
                      </Button>
                      <Button
                        onClick={handleSubmitFrontendAdjust}
                        disabled={isSubmittingFrontendAdjust || isLoadingFrontendInfo}
                      >
                        {isSubmittingFrontendAdjust ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Đang gửi...
                          </>
                        ) : (
                          "Gửi yêu cầu"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog thêm Frontend */}
        <Dialog open={showAddFrontend} onOpenChange={setShowAddFrontend}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm Frontend</DialogTitle>
              <DialogDescription>
                Thêm frontend mới vào project
              </DialogDescription>
            </DialogHeader>
            
            <HintBox title="Hướng dẫn">
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Chọn React, Vue hoặc Angular</li>
                <li>
                  <strong>Upload ZIP:</strong> Tên thư mục gốc trùng với tên dự án
                </li>
                <li>
                  <strong>Docker Image:</strong> Định dạng <code className="bg-muted px-1 rounded">owner/name:tag</code>
                </li>
                <li>
                  <strong>DNS:</strong> Chỉ a-z, 0-9, '-', dài 3-63 ký tự, không bắt đầu/kết thúc bằng '-' (ví dụ: <code className="bg-muted px-1 rounded">fe.myapp.local.test</code>)
                </li>
              </ul>
            </HintBox>
            
            <form onSubmit={handleSubmitFe(onSubmitFrontend)} className="space-y-4">
              {isDeployingFrontend && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                      Đang triển khai frontend...
                    </p>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">
                    Quá trình này có thể mất vài phút. Vui lòng không đóng cửa sổ này.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fe-name">Tên Frontend <span className="text-destructive">*</span></Label>
                  <Input id="fe-name" {...registerFe("name")} placeholder="web-app" disabled={isDeployingFrontend} />
                  {errorsFe.name && (
                    <p className="text-sm text-destructive mt-1">{errorsFe.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="fe-tech">Technology <span className="text-destructive">*</span></Label>
                  <Controller
                    name="tech"
                    control={controlFe}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isDeployingFrontend}>
                        <SelectTrigger id="fe-tech">
                          <SelectValue placeholder="Chọn technology" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="react">React</SelectItem>
                          <SelectItem value="vue">Vue</SelectItem>
                          <SelectItem value="angular">Angular</SelectItem>
                        </SelectContent>
                  </Select>
                    )}
                  />
                  {errorsFe.tech && (
                    <p className="text-sm text-destructive mt-1">{errorsFe.tech.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>Nguồn mã nguồn <span className="text-destructive">*</span></Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant={sourceTypeFe === "zip" ? "default" : "outline"}
                    onClick={() => setValueFe("sourceKind", "zip")}
                    disabled={isDeployingFrontend}
                  >
                    Upload ZIP
                  </Button>
                  <Button
                    type="button"
                    variant={sourceTypeFe === "image" ? "default" : "outline"}
                    onClick={() => setValueFe("sourceKind", "image")}
                    disabled={isDeployingFrontend}
                  >
                    Docker Image
                  </Button>
                </div>
              </div>

              {sourceTypeFe === "zip" ? (
                <div>
                  <Label>File ZIP <span className="text-destructive">*</span></Label>
                  <div
                    className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDeployingFrontend ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted"
                    }`}
                    onClick={() => !isDeployingFrontend && document.getElementById("zip-input-fe-modal")?.click()}
                  >
                    {zipFileFe ? (
                      <div>
                        <p className="font-medium">{zipFileFe.name}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setZipFileFe(null)
                            setZipErrorFe("")
                          }}
                          disabled={isDeployingFrontend}
                        >
                          Xóa file
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm">Chọn file ZIP</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="zip-input-fe-modal"
                    type="file"
                    accept=".zip"
                    className="hidden"
                    disabled={isDeployingFrontend}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const validation = validateZipFile(file)
                        if (validation.valid) {
                          setZipFileFe(file)
                          setZipErrorFe("")
                        } else {
                          setZipErrorFe(validation.message || "")
                        }
                      }
                    }}
                  />
                  {zipErrorFe && (
                    <p className="text-sm text-destructive mt-1">{zipErrorFe}</p>
                  )}
                </div>
              ) : (
                <div>
                  <Label htmlFor="fe-source-ref">Docker Image <span className="text-destructive">*</span></Label>
                  <Input
                    id="fe-source-ref"
                    {...registerFe("sourceRef")}
                    placeholder="docker.io/user/app:1.0.0"
                    className="font-mono"
                    onBlur={validateDockerFe}
                    disabled={isDeployingFrontend}
                  />
                  {errorsFe.sourceRef && (
                    <p className="text-sm text-destructive mt-1">{errorsFe.sourceRef.message}</p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="fe-public-url">DNS (tùy chọn)</Label>
                <div className="flex gap-2">
                  <Input
                    id="fe-public-url"
                    {...registerFe("publicUrl")}
                    placeholder="fe-myapp"
                    onBlur={validateDNSPublicUrl}
                    className={`flex-1 ${
                      dnsStatusFe === "valid"
                        ? "border-green-500 focus-visible:ring-green-500"
                        : dnsStatusFe === "invalid"
                        ? "border-red-500 focus-visible:ring-red-500 text-red-600"
                        : ""
                    }`}
                    disabled={isDeployingFrontend}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCheckDnsFe}
                    disabled={isDeployingFrontend || isCheckingDnsFe}
                  >
                    {isCheckingDnsFe ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang kiểm tra...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Kiểm tra
                      </>
                    )}
                  </Button>
                </div>
                {dnsMessageFe && (
                  <p
                    className={`text-sm mt-1 ${
                      dnsStatusFe === "valid"
                        ? "text-green-600"
                        : dnsStatusFe === "invalid"
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {dnsMessageFe}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddFrontend(false)
                    resetFe()
                    setZipFileFe(null)
                    setZipErrorFe("")
                  }}
                  disabled={isDeployingFrontend}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isDeployingFrontend}>
                  {isDeployingFrontend ? "Đang triển khai..." : "Thêm Frontend"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog xác nhận xóa project */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xác nhận xóa project</DialogTitle>
              <DialogDescription>
                Bạn có chắc chắn muốn xóa project "{projectBasicInfo?.name || displayProject.name}"? 
                Hành động này không thể hoàn tác. Tất cả databases, backends và frontends của project này sẽ bị xóa.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProject}
                disabled={isDeleting}
              >
                {isDeleting ? "Đang xóa..." : "Xóa Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog xác nhận xóa database/backend/frontend */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Xác nhận xóa{" "}
                {deleteTarget?.type === "database"
                  ? "database"
                  : deleteTarget?.type === "backend"
                  ? "backend"
                  : "frontend"}
              </DialogTitle>
              <DialogDescription>
                Bạn có chắc chắn muốn xóa{" "}
                {deleteTarget?.type === "database"
                  ? "database"
                  : deleteTarget?.type === "backend"
                  ? "backend"
                  : "frontend"}{" "}
                "{deleteTarget?.name}"? Hành động này không thể hoàn tác.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeletingResource}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDeleteResource}
                disabled={isDeletingResource}
              >
                {isDeletingResource ? "Đang xóa..." : "Xóa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

