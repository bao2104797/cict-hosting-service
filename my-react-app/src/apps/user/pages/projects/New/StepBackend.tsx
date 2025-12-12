import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Upload, X, Plus, CheckCircle2, Loader2, Eye, EyeOff, Trash2 } from "lucide-react"
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
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Bước 3/5 — Cấu hình Backend
        </h2>
        <p className="text-muted-foreground">
          Thiết lập các backend services
        </p>
      </div>

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
            <strong>Kết nối Database:</strong> Bạn có thể nhập thủ công thông tin kết nối database hoặc chọn từ danh sách database đã tạo ở bước trước
          </li>
        </ul>
      </HintBox>

      <Card>
        <CardHeader>
          <CardTitle>
            Backends đã thêm ({projectBackends.length > 0 ? projectBackends.length : backends.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBackends ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Đang tải danh sách backends...</span>
            </div>
          ) : projectBackends.length > 0 ? (
            <div className="space-y-3">
              {projectBackends.map((be) => (
                <motion.div
                  key={be.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div>
                            <h4 className="font-medium">{be.projectName}</h4>
                            {be.description && (
                              <p className="text-sm text-muted-foreground mt-1">{be.description}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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
                          </div>
                          {be.databaseIp && be.databasePort && be.databaseName && (
                            <div className="mt-2 pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-1 font-medium">Thông tin Database:</p>
                              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground">
                                <div className="col-span-4">
                                  <span className="font-medium">IP:</span> {be.databaseIp}
                                </div>
                                <div className="col-span-2">
                                  <span className="font-medium">Port:</span> {be.databasePort}
                                </div>
                                <div className="col-span-6">
                                  <span className="font-medium">Database:</span> {be.databaseName}
                                </div>
                                <div className="col-span-6">
                                  <span className="font-medium">Username:</span> {be.databaseUsername || "-"}
                                </div>
                                <div className="col-span-6">
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium">Password:</span>
                                    <span className="font-mono">
                                      {be.databasePassword
                                        ? showPasswords[be.id]
                                          ? be.databasePassword
                                          : "••••••••"
                                        : "-"}
                                    </span>
                                    {be.databasePassword && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 ml-1"
                                        onClick={() => {
                                          setShowPasswords((prev) => ({
                                            ...prev,
                                            [be.id]: !prev[be.id],
                                          }))
                                        }}
                                      >
                                        {showPasswords[be.id] ? (
                                          <EyeOff className="w-3 h-3" />
                                        ) : (
                                          <Eye className="w-3 h-3" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBackend(be.id, be.projectName)}
                          disabled={deletingBackendId === be.id}
                          className="flex-shrink-0"
                        >
                          {deletingBackendId === be.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : backends.length > 0 ? (
            // Fallback to store data if API data is not available
            <div className="space-y-3">
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
            <p className="text-sm text-muted-foreground text-center py-4">
              Chưa có backend nào. Nhấn "Thêm Backend" để bắt đầu.
            </p>
          )}
        </CardContent>
      </Card>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Thêm Backend</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Tên Backend <span className="text-destructive">*</span></Label>
                  <Input id="name" {...register("name")} placeholder="api-service" disabled={isDeploying} />
                  {formErrors.name && (
                    <p className="text-sm text-destructive mt-1">{formErrors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="tech">Technology <span className="text-destructive">*</span></Label>
                  <Controller
                    name="tech"
                    control={control}
                    render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="tech" disabled={isDeploying}>
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

              <div>
                <Label>Nguồn mã nguồn <span className="text-destructive">*</span></Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant={sourceType === "zip" ? "default" : "outline"}
                    onClick={() => setValue("sourceType", "zip")}
                    disabled={isDeploying}
                  >
                    Upload ZIP
                  </Button>
                  <Button
                    type="button"
                    variant={sourceType === "image" ? "default" : "outline"}
                    onClick={() => setValue("sourceType", "image")}
                    disabled={isDeploying}
                  >
                    Docker Image
                  </Button>
                </div>
              </div>

              {sourceType === "zip" ? (
                <div>
                  <Label>File ZIP <span className="text-destructive">*</span></Label>
                  <div
                    className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDeploying ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted"
                    }`}
                    onClick={() => !isDeploying && document.getElementById("zip-input-be")?.click()}
                  >
                    {zipFile ? (
                      <div>
                        <p className="font-medium">{zipFile.name}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setZipFile(null)
                            setErrors({ ...errors, zipFile: "" })
                          }}
                          disabled={isDeploying}
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
                <div>
                  <Label htmlFor="dockerImage">Docker Image <span className="text-destructive">*</span></Label>
                  <Input
                    id="dockerImage"
                    {...register("dockerImage")}
                    placeholder="docker.io/user/app:1.0.0"
                    className="font-mono"
                    onBlur={validateDocker}
                    disabled={isDeploying}
                  />
                  {errors.dockerImage && (
                    <p className="text-sm text-destructive mt-1">{errors.dockerImage}</p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="dns">DNS (tùy chọn)</Label>
                <div className="flex gap-2">
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

              {/* Database connection fields */}
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Kết nối Database
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Chọn cách nhập thông tin kết nối database
                  </p>
                </div>

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
                          <Label htmlFor="select-db">Chọn Database</Label>
                          <Select
                            value={selectedDbId}
                            onValueChange={(value) => {
                              handleSelectDatabase(value)
                            }}
                          >
                            <SelectTrigger id="select-db" disabled={isDeploying}>
                              <SelectValue placeholder="-- Chọn database --" />
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
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-5">
                        <Label htmlFor="dbName">
                          Tên Database
                        </Label>
                        <Input
                          id="dbName"
                          {...register("dbName")}
                          placeholder="my_database"
                          disabled={isDeploying}
                        />
                      </div>
                      <div className="col-span-5">
                        <Label htmlFor="dbIp">
                          IP/Host Database
                        </Label>
                        <Input
                          id="dbIp"
                          {...register("dbIp")}
                          placeholder="192.168.1.100"
                          disabled={isDeploying}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="dbPort">
                          Port
                        </Label>
                        <Input
                          id="dbPort"
                          {...register("dbPort")}
                          placeholder="3306"
                          disabled={isDeploying}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dbUsername">
                          Username Database
                        </Label>
                        <Input
                          id="dbUsername"
                          {...register("dbUsername")}
                          placeholder="admin"
                          disabled={isDeploying}
                        />
                      </div>
                      <div>
                        <Label htmlFor="dbPassword">
                          Password Database
                        </Label>
                        <Input
                          id="dbPassword"
                          type="password"
                          {...register("dbPassword")}
                          placeholder="••••••••"
                          disabled={isDeploying}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isDeploying}>
                  {isDeploying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang triển khai...
                    </>
                  ) : (
                    "Thêm"
                  )}
                </Button>
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
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
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

