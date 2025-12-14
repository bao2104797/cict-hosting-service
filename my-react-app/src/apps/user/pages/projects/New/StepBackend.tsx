import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Upload, X, Plus, CheckCircle2, Loader2, Eye, EyeOff, Trash2, Server, FileText, Package, Code, Database, Globe, Network, Key, User, Copy, Check, ExternalLink, HardDrive } from "lucide-react"
import { motion } from "framer-motion"
import type { BackendFormData } from "@/types"
import { validateZipFile, validateDockerImage } from "@/lib/validators"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HintBox } from "@/apps/user/components/HintBox"
import { useWizardStore } from "@/apps/user/stores/wizard-store"
import { useAuth } from "@/contexts/AuthContext"
import { getProjectDatabases, getProjectBackends, deployBackend, deleteProjectBackend, checkDomainNameSystem, type DatabaseInfo, type BackendInfo } from "@/lib/project-api"
import { toast } from "sonner"

const backendSchema = z.object({
  name: z.string().min(1, "Tên backend không được để trống"),
  tech: z.enum(["spring", "node"]),
  sourceType: z.enum(["zip", "image"]),
  dockerImage: z.string().optional(),
  dns: z.string().optional(),
  // Database connection fields - required
  dbName: z.string().min(1, "Tên database không được để trống"),
  dbIp: z.string().min(1, "IP database không được để trống"),
  dbPort: z.string().min(1, "Port database không được để trống"),
  dbUsername: z.string().min(1, "Username database không được để trống"),
  dbPassword: z.string().min(1, "Password database không được để trống"),
}).refine((data) => {
  if (data.sourceType === "image") {
    return !!data.dockerImage && data.dockerImage.trim() !== ""
  }
  return true
}, {
  message: "Vui lòng nhập Docker image hoặc upload file ZIP",
  path: ["dockerImage"]
})

type FormData = z.infer<typeof backendSchema>

/**
 * Step 3: Cấu hình Backend
 */
export function StepBackend() {
  // Subscribe cụ thể vào backends và databases để đảm bảo re-render
  const backends = useWizardStore((state) => state.backends)
  const databases = useWizardStore((state) => state.databases)
  const { projectName, projectId } = useWizardStore()
  const { user } = useAuth()
  const addBackend = useWizardStore((state) => state.addBackend)
  const removeBackend = useWizardStore((state) => state.removeBackend)
  const [showForm, setShowForm] = useState(false)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dbConnectionMode, setDbConnectionMode] = useState<"manual" | "select">("manual")
  const [selectedDbId, setSelectedDbId] = useState<string>("")
  const [projectDatabases, setProjectDatabases] = useState<DatabaseInfo[]>([])
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [projectBackends, setProjectBackends] = useState<BackendInfo[]>([])
  const [loadingBackends, setLoadingBackends] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [deletingBackendId, setDeletingBackendId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; type: "api" | "store"; storeIndex?: number } | null>(null)
  const [isCheckingDns, setIsCheckingDns] = useState(false)
  const [dnsStatus, setDnsStatus] = useState<"idle" | "valid" | "invalid">("idle")
  const [dnsMessage, setDnsMessage] = useState("")

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    control,
    formState: { errors: formErrors },
  } = useForm<FormData>({
    resolver: zodResolver(backendSchema),
    defaultValues: {
      tech: "spring",
      sourceType: "zip",
    },
  })

  const sourceType = watch("sourceType")
  const dockerImage = watch("dockerImage")
  const dns = watch("dns")

  // Load databases từ API
  const loadProjectDatabases = async () => {
    // Lấy projectId từ localStorage hoặc wizard store
    const currentProjectId = localStorage.getItem("currentProjectId") || projectId
    if (!currentProjectId) return

    setLoadingDatabases(true)
    try {
      const response = await getProjectDatabases(currentProjectId)
      setProjectDatabases(response.databases || [])
    } catch (error) {
      console.error("Lỗi load project databases:", error)
      // Không hiển thị toast để tránh làm phiền user
    } finally {
      setLoadingDatabases(false)
    }
  }

  // Load backends từ API
  const loadProjectBackends = async () => {
    // Lấy projectId từ localStorage hoặc wizard store
    const currentProjectId = localStorage.getItem("currentProjectId") || projectId
    if (!currentProjectId) return

    setLoadingBackends(true)
    try {
      const response = await getProjectBackends(currentProjectId)
      setProjectBackends(response.backends || [])
    } catch (error) {
      console.error("Lỗi load project backends:", error)
      // Không hiển thị toast để tránh làm phiền user
    } finally {
      setLoadingBackends(false)
    }
  }

  // Load backends khi component mount hoặc projectId thay đổi
  useEffect(() => {
    const currentProjectId = localStorage.getItem("currentProjectId") || projectId
    if (currentProjectId) {
      loadProjectBackends()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Mở modal xác nhận xóa backend (từ API)
  const handleDeleteBackend = (backendId: number, backendName: string) => {
    setDeleteTarget({ id: backendId, name: backendName, type: "api" })
  }

  // Mở modal xác nhận xóa backend (từ store)
  const handleDeleteBackendFromStore = (index: number, backendName: string) => {
    setDeleteTarget({ id: -1, name: backendName, type: "store", storeIndex: index })
  }

  // Xác nhận xóa backend
  const handleConfirmDeleteBackend = async () => {
    if (!deleteTarget) return

    if (deleteTarget.type === "store" && deleteTarget.storeIndex !== undefined) {
      // Xóa khỏi store (chưa deploy lên server)
      removeBackend(deleteTarget.storeIndex)
      toast.success(`Đã xóa backend "${deleteTarget.name}"`)
      setDeleteTarget(null)
      return
    }

    // Xóa từ API (đã deploy lên server)
    const currentProjectId = localStorage.getItem("currentProjectId") || projectId
    if (!currentProjectId) {
      toast.error("Không tìm thấy project ID")
      setDeleteTarget(null)
      return
    }

    setDeletingBackendId(deleteTarget.id)
    try {
      // Gọi API xóa backend
      await deleteProjectBackend(currentProjectId, deleteTarget.id)
      
      // Xóa khỏi store ngay lập tức (trước khi reload để đồng bộ với localStorage)
      // Xóa tất cả các item trong store có cùng name
      let foundIndex = backends.findIndex((b) => b.name === deleteTarget.name)
      while (foundIndex !== -1) {
        removeBackend(foundIndex)
        // Lấy lại state từ store sau khi xóa
        const updatedBackends = useWizardStore.getState().backends
        foundIndex = updatedBackends.findIndex((b) => b.name === deleteTarget.name)
      }
      
      // Reload danh sách từ API để cập nhật giao diện
      await loadProjectBackends()
      
      toast.success(`Đã xóa backend "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa backend")
      console.error(error)
    } finally {
      setDeletingBackendId(null)
    }
  }

  // Khi chọn database từ danh sách, tự động điền các trường
  const handleSelectDatabase = (dbId: string) => {
    const selectedDb = projectDatabases.find((db) => String(db.id) === dbId)
    if (selectedDb) {
      setSelectedDbId(dbId)
      // Điền thông tin từ database đã chọn
      if (selectedDb.databaseName) {
        setValue("dbName", selectedDb.databaseName)
      }
      if (selectedDb.databaseIp) {
        setValue("dbIp", selectedDb.databaseIp)
      }
      if (selectedDb.databasePort) {
        setValue("dbPort", String(selectedDb.databasePort))
      }
      if (selectedDb.databaseUsername) {
        setValue("dbUsername", selectedDb.databaseUsername)
      }
      if (selectedDb.databasePassword) {
        setValue("dbPassword", selectedDb.databasePassword)
      }
    }
  }

  // Khi chuyển sang chế độ nhập thủ công, xóa selection
  const handleModeChange = (mode: "manual" | "select") => {
    setDbConnectionMode(mode)
    if (mode === "manual") {
      setSelectedDbId("")
    } else if (mode === "select") {
      // Load databases từ API khi chọn mode "select"
      loadProjectDatabases()
    }
  }

  useEffect(() => {
    setDnsStatus("idle")
    setDnsMessage("")
  }, [dns])

  const handleCheckDns = async () => {
    const dnsValue = watch("dns")
    if (!dnsValue) {
      toast.info("Vui lòng nhập DNS trước khi kiểm tra")
      return
    }

    setIsCheckingDns(true)
    setDnsStatus("idle")
    setDnsMessage("")
    try {
      const response = await checkDomainNameSystem(dnsValue)
      if (response.exists) {
        toast.error(response.message || "DNS đã tồn tại")
        setDnsStatus("invalid")
        setDnsMessage(response.message || "DNS đã tồn tại")
      } else {
        toast.success(response.message || "DNS có thể sử dụng")
        setDnsStatus("valid")
        setDnsMessage(response.message || "DNS có thể sử dụng")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể kiểm tra DNS"
      toast.error(message)
      setDnsStatus("invalid")
      setDnsMessage(message)
    } finally {
      setIsCheckingDns(false)
    }
  }

  // Validate Docker image
  const validateDocker = () => {
    if (sourceType === "image" && dockerImage) {
      const validation = validateDockerImage(dockerImage)
      if (!validation.valid) {
        setErrors({ ...errors, dockerImage: validation.message || "" })
      } else {
        setErrors({ ...errors, dockerImage: "" })
      }
    }
  }


  const onSubmit = async (data: FormData) => {
    if (!user?.username) {
      toast.error("Bạn chưa đăng nhập")
      return
    }

    if (!projectId || !projectName) {
      toast.error("Vui lòng tạo project trước khi thêm backend")
      return
    }

    // Validate ZIP nếu có
    if (data.sourceType === "zip" && !zipFile) {
      setErrors({ ...errors, zipFile: "Vui lòng chọn file ZIP" })
      return
    }

    if (data.sourceType === "zip" && zipFile) {
      const validation = validateZipFile(zipFile)
      if (!validation.valid) {
        setErrors({ ...errors, zipFile: validation.message || "" })
        return
      }
    }

    // Validate Docker image
    if (data.sourceType === "image") {
      const validation = validateDockerImage(data.dockerImage || "")
      if (!validation.valid) {
        setErrors({ ...errors, dockerImage: validation.message || "" })
        return
      }
    }

    setIsDeploying(true)
    const loadingToast = toast.loading("Đang triển khai backend...", {
      description: "Vui lòng đợi trong giây lát",
    })

    try {
      // Chuyển đổi tech sang frameworkType
      const frameworkType = data.tech === "spring" ? "SPRINGBOOT" : "NODEJS" as "SPRINGBOOT" | "NODEJS"
      // Chuyển đổi sourceType sang deploymentType
      const deploymentType = data.sourceType === "zip" ? "FILE" : "DOCKER" as "FILE" | "DOCKER"

      // Gọi API deploy backend
      await deployBackend({
        projectName: data.name,
        deploymentType: deploymentType,
        frameworkType: frameworkType,
        dockerImage: data.sourceType === "image" ? data.dockerImage : undefined,
        file: data.sourceType === "zip" ? (zipFile ?? undefined) : undefined,
        databaseIp: data.dbIp,
        databasePort: parseInt(data.dbPort) || 0,
        databaseName: data.dbName,
        databaseUsername: data.dbUsername,
        databasePassword: data.dbPassword,
        domainNameSystem: data.dns || "",
        username: user.username,
        projectId: projectId,
      })

      // Tạo env vars từ database connection fields để lưu vào store
      const env: Array<{ key: string; value: string }> = []
      if (data.dbName) env.push({ key: "DB_NAME", value: data.dbName })
      if (data.dbIp) env.push({ key: "DB_HOST", value: data.dbIp })
      if (data.dbPort) env.push({ key: "DB_PORT", value: data.dbPort })
      if (data.dbUsername) env.push({ key: "DB_USERNAME", value: data.dbUsername })
      if (data.dbPassword) env.push({ key: "DB_PASSWORD", value: data.dbPassword })

      const beData: BackendFormData = {
        name: data.name,
        tech: data.tech,
        sourceType: data.sourceType,
        zipFile: data.sourceType === "zip" ? (zipFile ?? undefined) : undefined,
        dockerImage: data.sourceType === "image" ? data.dockerImage : undefined,
        env,
        dns: data.dns || undefined,
      }

      addBackend(beData)
      toast.dismiss(loadingToast)
      toast.success(`Đã thêm backend "${data.name}" thành công!`)
      
      // Reload backends từ API
      await loadProjectBackends()
      
      reset()
      setZipFile(null)
      setErrors({})
      setShowForm(false)
      setSelectedDbId("")
      setDbConnectionMode("manual")
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi thêm backend")
      console.error(error)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/30">
          <Server className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Bước 3/5 — Cấu hình Backend
          </h2>
          <p className="text-muted-foreground mt-1">
            Thiết lập các backend services cho project
          </p>
        </div>
      </div>

      <HintBox title="Hướng dẫn">
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Chọn Framework:</strong> Spring Boot hoặc Node.js</li>
          <li>
            <strong>Upload ZIP:</strong> Tên thư mục gốc trùng với tên dự án.
          </li>
          <li>
            <strong>Docker Image:</strong> Phải có file Dockerfile trong thư mục gốc
          </li>
          <li>
            <strong>Domain Name:</strong> Không chứa ký tự đặc biệt, không bắt đầu/kết thúc bằng '-' (ví dụ: <code className="bg-muted px-1 rounded">api.myapp.local.test</code>)
          </li>
          <li>
            <strong>Kết nối Database:</strong> Bạn có thể nhập thủ công thông tin kết nối database hoặc chọn từ danh sách database đã tạo ở bước trước. Nếu không có database, backend sẽ không hoạt động.
          </li>
        </ul>
      </HintBox>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/30">
              <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-xl">
              Backends đã thêm ({projectBackends.length > 0 ? projectBackends.length : backends.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loadingBackends ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Đang tải danh sách backends...</span>
            </div>
          ) : projectBackends.length > 0 ? (
            <div 
              className="space-y-3 max-h-[600px] overflow-y-auto pr-2"
              style={{ scrollBehavior: 'smooth' }}
            >
              {projectBackends.map((be) => (
                <motion.div
                  key={be.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border border-border/50 hover:shadow-lg transition-all">
                    <CardContent className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-border/50">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                            be.frameworkType === "SPRINGBOOT" 
                              ? "bg-green-100 dark:bg-green-950/30" 
                              : "bg-blue-100 dark:bg-blue-950/30"
                          }`}>
                            <Code className={`w-5 h-5 ${
                              be.frameworkType === "SPRINGBOOT"
                                ? "text-green-600 dark:text-green-400"
                                : "text-blue-600 dark:text-blue-400"
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">{be.projectName}</h4>
                            {be.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{be.description}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-2">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-xs font-medium">
                                {be.frameworkType === "SPRINGBOOT" ? "Spring Boot" : be.frameworkType === "NODEJS" ? "Node.js" : be.frameworkType}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-xs font-medium">
                                {be.deploymentType === "DOCKER" ? "Docker Image" : be.deploymentType === "FILE" ? "File ZIP" : be.deploymentType}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBackend(be.id, be.projectName)}
                          disabled={deletingBackendId === be.id}
                          className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          {deletingBackendId === be.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Connection Information */}
                      <div className="space-y-3">
                        {/* DNS */}
                        {be.domainNameSystem && (
                          <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                            <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-950/30 flex-shrink-0 mt-0.5">
                              <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Domain Name (DNS)
                              </Label>
                              <div className="flex items-center gap-2 mt-1">
                                <a
                                  href={`http://${be.domainNameSystem}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-sm flex-1 truncate text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    window.open(`http://${be.domainNameSystem}`, '_blank')
                                  }}
                                >
                                  {be.domainNameSystem}
                                </a>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      window.open(`http://${be.domainNameSystem}`, '_blank')
                                    }}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(be.domainNameSystem || "")
                                      setCopiedField(`dns-${be.id}`)
                                      toast.success("Đã sao chép DNS")
                                      setTimeout(() => setCopiedField(null), 2000)
                                    }}
                                  >
                                    {copiedField === `dns-${be.id}` ? (
                                      <Check className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Docker Image (if exists) */}
                        {be.dockerImage && (
                          <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                            <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-950/30 flex-shrink-0 mt-0.5">
                              <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Docker Image
                              </Label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-sm flex-1 truncate">{be.dockerImage}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(be.dockerImage || "")
                                    setCopiedField(`docker-${be.id}`)
                                    toast.success("Đã sao chép Docker Image")
                                    setTimeout(() => setCopiedField(null), 2000)
                                  }}
                                >
                                  {copiedField === `docker-${be.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Database Connection Info */}
                        {be.databaseIp && be.databasePort && be.databaseName && (
                          <div className="p-3 bg-muted/50 rounded-lg border border-border/50 space-y-3">
                            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                              <Database className="w-3.5 h-3.5 text-muted-foreground" />
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Database Connection
                              </Label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* IP */}
                              <div className="flex items-start gap-3">
                                <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-950/30 flex-shrink-0 mt-0.5">
                                  <Network className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    IP Address
                                  </Label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="font-mono text-sm flex-1 truncate">{be.databaseIp}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 flex-shrink-0"
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(be.databaseIp || "")
                                        setCopiedField(`dbip-${be.id}`)
                                        toast.success("Đã sao chép IP address")
                                        setTimeout(() => setCopiedField(null), 2000)
                                      }}
                                    >
                                      {copiedField === `dbip-${be.id}` ? (
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Port */}
                              <div className="flex items-start gap-3">
                                <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-950/30 flex-shrink-0 mt-0.5">
                                  <Network className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Port
                                  </Label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="font-mono text-sm flex-1">{be.databasePort}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 flex-shrink-0"
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(String(be.databasePort || ""))
                                        setCopiedField(`dbport-${be.id}`)
                                        toast.success("Đã sao chép Port")
                                        setTimeout(() => setCopiedField(null), 2000)
                                      }}
                                    >
                                      {copiedField === `dbport-${be.id}` ? (
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Database Name */}
                              <div className="flex items-start gap-3">
                                <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-950/30 flex-shrink-0 mt-0.5">
                                  <HardDrive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Database Name
                                  </Label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="font-mono text-sm flex-1 truncate">{be.databaseName}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 flex-shrink-0"
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(be.databaseName || "")
                                        setCopiedField(`dbname-${be.id}`)
                                        toast.success("Đã sao chép Database Name")
                                        setTimeout(() => setCopiedField(null), 2000)
                                      }}
                                    >
                                      {copiedField === `dbname-${be.id}` ? (
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Username */}
                              {be.databaseUsername && (
                                <div className="flex items-start gap-3">
                                  <div className="p-1.5 rounded-md bg-cyan-100 dark:bg-cyan-950/30 flex-shrink-0 mt-0.5">
                                    <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      Username
                                    </Label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="font-mono text-sm flex-1 truncate">{be.databaseUsername}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 flex-shrink-0"
                                        onClick={async () => {
                                          await navigator.clipboard.writeText(be.databaseUsername || "")
                                          setCopiedField(`dbusername-${be.id}`)
                                          toast.success("Đã sao chép Username")
                                          setTimeout(() => setCopiedField(null), 2000)
                                        }}
                                      >
                                        {copiedField === `dbusername-${be.id}` ? (
                                          <Check className="w-3.5 h-3.5 text-green-600" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Password */}
                              {be.databasePassword && (
                                <div className="flex items-start gap-3">
                                  <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-950/30 flex-shrink-0 mt-0.5">
                                    <Key className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      Password
                                    </Label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="font-mono text-sm flex-1 truncate">
                                        {showPasswords[be.id] ? be.databasePassword : "••••••••"}
                                      </span>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={async () => {
                                            await navigator.clipboard.writeText(be.databasePassword || "")
                                            setCopiedField(`dbpassword-${be.id}`)
                                            toast.success("Đã sao chép Password")
                                            setTimeout(() => setCopiedField(null), 2000)
                                          }}
                                        >
                                          {copiedField === `dbpassword-${be.id}` ? (
                                            <Check className="w-3.5 h-3.5 text-green-600" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => {
                                            setShowPasswords((prev) => ({
                                              ...prev,
                                              [be.id]: !prev[be.id],
                                            }))
                                          }}
                                        >
                                          {showPasswords[be.id] ? (
                                            <EyeOff className="w-3.5 h-3.5" />
                                          ) : (
                                            <Eye className="w-3.5 h-3.5" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : backends.length > 0 ? (
            // Fallback to store data if API data is not available
            <div 
              className="space-y-3 max-h-[600px] overflow-y-auto pr-2"
              style={{ scrollBehavior: 'smooth' }}
            >
              {backends.map((be, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{be.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {be.tech === "spring" ? "Spring Boot" : "Node.js"}
                          </p>
                          {be.dns && (
                            <p className="text-sm text-muted-foreground mt-1">
                              DNS: {be.dns}
                            </p>
                          )}
                          {be.dockerImage && (
                            <p className="text-sm text-muted-foreground mt-1 font-mono text-xs">
                              {be.dockerImage}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBackendFromStore(index, be.name)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950/30 mb-3">
                <Server className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Chưa có backend nào
              </p>
              <p className="text-xs text-muted-foreground">
                Nhấn "Thêm Backend" để bắt đầu
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/30">
                <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-xl">Thêm Backend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {isDeploying && (
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
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">Thông tin cơ bản</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium">
                      Tên Backend <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      id="name" 
                      {...register("name")} 
                      placeholder="api-service" 
                      disabled={isDeploying}
                      className="mt-1.5"
                    />
                    {formErrors.name && (
                      <p className="text-sm text-destructive mt-1">{formErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="tech" className="text-sm font-medium">
                      Framework <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      name="tech"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="tech" disabled={isDeploying} className="mt-1.5">
                            <SelectValue placeholder="Chọn technology" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spring">Spring Boot</SelectItem>
                            <SelectItem value="node">Node.js</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {formErrors.tech && (
                      <p className="text-sm text-destructive mt-1">{formErrors.tech.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Source Type */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">
                    Nguồn mã nguồn <span className="text-destructive">*</span>
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={sourceType === "zip" ? "default" : "outline"}
                    onClick={() => setValue("sourceType", "zip")}
                    disabled={isDeploying}
                    className="flex-1"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload ZIP
                  </Button>
                  <Button
                    type="button"
                    variant={sourceType === "image" ? "default" : "outline"}
                    onClick={() => setValue("sourceType", "image")}
                    disabled={isDeploying}
                    className="flex-1"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Docker Image
                  </Button>
                </div>
              </div>

              {sourceType === "zip" ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    File ZIP <span className="text-destructive">*</span>
                  </Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                      isDeploying 
                        ? "opacity-50 cursor-not-allowed border-muted-foreground/30" 
                        : "cursor-pointer hover:bg-muted/50 hover:border-primary/50 border-border"
                    }`}
                    onClick={() => !isDeploying && document.getElementById("zip-input-be")?.click()}
                  >
                    {zipFile ? (
                      <div className="space-y-3">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/30">
                          <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{zipFile.name}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setZipFile(null)
                            setErrors({ ...errors, zipFile: "" })
                          }}
                          disabled={isDeploying}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Xóa file
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                          <Upload className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Chọn file ZIP</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="zip-input-be"
                    type="file"
                    accept=".zip"
                    className="hidden"
                    disabled={isDeploying}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const validation = validateZipFile(file)
                        if (validation.valid) {
                          setZipFile(file)
                          setErrors({ ...errors, zipFile: "" })
                        } else {
                          setErrors({ ...errors, zipFile: validation.message || "" })
                        }
                      }
                    }}
                  />
                  {errors.zipFile && (
                    <p className="text-sm text-destructive mt-1">{errors.zipFile}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="dockerImage" className="text-sm font-medium">
                    Docker Image <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dockerImage"
                    {...register("dockerImage")}
                    placeholder="docker.io/user/app:1.0.0"
                    className="font-mono mt-1.5"
                    onBlur={validateDocker}
                    disabled={isDeploying}
                  />
                  {errors.dockerImage && (
                    <p className="text-sm text-destructive mt-1">{errors.dockerImage}</p>
                  )}
                </div>
              )}

              {/* Domain Name */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">Domain Name (Tùy chọn)</Label>
                </div>
                <div>
                  <Label htmlFor="dns" className="text-sm font-medium">Domain Name</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      id="dns"
                      {...register("dns")}
                      placeholder="api-myapp"
                      className={`flex-1 ${
                        dnsStatus === "valid"
                          ? "border-green-500 focus-visible:ring-green-500"
                          : dnsStatus === "invalid"
                          ? "border-red-500 focus-visible:ring-red-500 text-red-600"
                          : ""
                      }`}
                      disabled={isDeploying}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCheckDns}
                      disabled={isDeploying || isCheckingDns}
                    >
                      {isCheckingDns ? (
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
                  {dnsMessage && (
                    <p
                      className={`text-sm mt-1 ${
                        dnsStatus === "valid"
                          ? "text-green-600"
                          : dnsStatus === "invalid"
                          ? "text-red-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {dnsMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Database connection fields */}
              <div className="p-5 bg-muted/50 rounded-lg border border-border/50 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">
                    Kết nối Database
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Chọn cách nhập thông tin kết nối database
                </p>

                {/* Chọn chế độ: Nhập thủ công hoặc Chọn từ danh sách */}
                <div className="flex gap-2 mb-4">
                  <Button
                    type="button"
                    variant={dbConnectionMode === "manual" ? "default" : "outline"}
                    onClick={() => handleModeChange("manual")}
                    size="sm"
                    disabled={isDeploying}
                  >
                    Nhập thủ công
                  </Button>
                  <Button
                    type="button"
                    variant={dbConnectionMode === "select" ? "default" : "outline"}
                    onClick={() => handleModeChange("select")}
                    size="sm"
                    disabled={isDeploying}
                  >
                    Chọn từ danh sách {projectDatabases.length > 0 && `(${projectDatabases.length})`}
                  </Button>
                </div>

                {dbConnectionMode === "select" ? (
                  <div className="space-y-4">
                    {loadingDatabases ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Đang tải danh sách databases...</span>
                      </div>
                    ) : projectDatabases.length > 0 ? (
                      <>
                        <div>
                          <Label htmlFor="select-db">Chọn Database đã triển khai ở bước trước</Label>
                          <Select
                            value={selectedDbId}
                            onValueChange={(value) => {
                              handleSelectDatabase(value)
                            }}
                          >
                            <SelectTrigger id="select-db" disabled={isDeploying}>
                              <SelectValue placeholder="-- Chọn database --">
                                {selectedDbId ? (() => {
                                  const selectedDb = projectDatabases.find((db) => String(db.id) === selectedDbId)
                                  if (!selectedDb) return "-- Chọn database --"
                                  const dbType = selectedDb.databaseType === "MYSQL" ? "MySQL" : selectedDb.databaseType === "MONGODB" ? "MongoDB" : selectedDb.databaseType
                                  return `${selectedDb.projectName} (${dbType})${selectedDb.databaseName ? ` - ${selectedDb.databaseName}` : ""}`
                                })() : "-- Chọn database --"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                            {projectDatabases.map((db) => (
                                <SelectItem key={db.id} value={String(db.id)}>
                                {db.projectName} ({db.databaseType === "MYSQL" ? "MySQL" : db.databaseType === "MONGODB" ? "MongoDB" : db.databaseType})
                                {db.databaseName && ` - ${db.databaseName}`}
                                </SelectItem>
                            ))}
                            </SelectContent>
                          </Select>
                          {selectedDbId && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Đã chọn: {projectDatabases.find((db) => String(db.id) === selectedDbId)?.projectName}
                            </p>
                          )}
                        </div>
                        {/* Hiển thị thông tin đã chọn (read-only) */}
                        {selectedDbId && projectDatabases.find((db) => String(db.id) === selectedDbId) && (() => {
                          const selectedDb = projectDatabases.find((db) => String(db.id) === selectedDbId)!
                          return (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              transition={{ duration: 0.2 }}
                              className="p-3 bg-background rounded-md border space-y-2"
                            >
                              <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-5">
                                  <Label className="text-xs text-muted-foreground">Tên Database</Label>
                                  <p className="text-sm font-medium">
                                    {selectedDb.databaseName || "-"}
                                  </p>
                                </div>
                                <div className="col-span-5">
                                  <Label className="text-xs text-muted-foreground">IP/Host Database</Label>
                                  <p className="text-sm font-medium">
                                    {selectedDb.databaseIp || "-"}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <Label className="text-xs text-muted-foreground">Port</Label>
                                  <p className="text-sm font-medium">
                                    {selectedDb.databasePort || "-"}
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Username</Label>
                                  <p className="text-sm font-medium">
                                    {selectedDb.databaseUsername || "-"}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Password</Label>
                                  <p className="text-sm font-medium">
                                    {selectedDb.databasePassword ? "••••••••" : "-"}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )
                        })()}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Chưa có database nào. Vui lòng thêm database ở bước trước.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                      <div className="sm:col-span-5">
                        <Label htmlFor="dbName" className="text-sm font-medium flex items-center gap-2">
                          <Database className="w-3 h-3 text-muted-foreground" />
                          Tên Database
                        </Label>
                        <Input
                          id="dbName"
                          {...register("dbName")}
                          placeholder="my_database"
                          disabled={isDeploying}
                          className="mt-1.5"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <Label htmlFor="dbIp" className="text-sm font-medium flex items-center gap-2">
                          <Network className="w-3 h-3 text-muted-foreground" />
                          IP/Host Database
                        </Label>
                        <Input
                          id="dbIp"
                          {...register("dbIp")}
                          placeholder="192.168.1.100"
                          disabled={isDeploying}
                          className="mt-1.5"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="dbPort" className="text-sm font-medium">
                          Port
                        </Label>
                        <Input
                          id="dbPort"
                          {...register("dbPort")}
                          placeholder="3306"
                          disabled={isDeploying}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dbUsername" className="text-sm font-medium flex items-center gap-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          Username Database
                        </Label>
                        <Input
                          id="dbUsername"
                          {...register("dbUsername")}
                          placeholder="admin"
                          disabled={isDeploying}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="dbPassword" className="text-sm font-medium flex items-center gap-2">
                          <Key className="w-3 h-3 text-muted-foreground" />
                          Password Database
                        </Label>
                        <Input
                          id="dbPassword"
                          type="password"
                          {...register("dbPassword")}
                          placeholder="••••••••"
                          disabled={isDeploying}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    reset()
                    setZipFile(null)
                    setErrors({})
                    setDbConnectionMode("manual")
                    setSelectedDbId("")
                  }}
                  disabled={isDeploying}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isDeploying} className="min-w-[140px]">
                  {isDeploying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang triển khai...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Thêm Backend
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" className="w-full h-12" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Thêm Backend
        </Button>
      )}

      {/* Dialog xác nhận xóa backend */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa backend</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa backend "{deleteTarget?.name}"? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deletingBackendId !== null}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteBackend}
              disabled={deletingBackendId !== null}
            >
              {deletingBackendId !== null ? "Đang xóa..." : "Xóa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

