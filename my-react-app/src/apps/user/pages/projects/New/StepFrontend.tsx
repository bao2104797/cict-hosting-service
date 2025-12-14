import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Upload, X, Plus, CheckCircle2, Loader2, Trash2, Globe, FileText, Package, Copy, Check, ExternalLink } from "lucide-react"
import { motion } from "framer-motion"
import type { FrontendFormData } from "@/types"
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
import { deployFrontend, getProjectFrontends, deleteProjectFrontend, checkDomainNameSystem, type FrontendInfo } from "@/lib/project-api"
import { toast } from "sonner"

const frontendSchema = z.object({
  name: z.string().min(1, "Tên frontend không được để trống"),
  tech: z.enum(["react", "vue", "angular"]),
  sourceType: z.enum(["zip", "image"]),
  dockerImage: z.string().optional(),
  publicUrl: z.string().optional(),
}).refine((data) => {
  if (data.sourceType === "image") {
    return !!data.dockerImage && data.dockerImage.trim() !== ""
  }
  return true
}, {
  message: "Vui lòng nhập Docker image hoặc upload file ZIP",
  path: ["dockerImage"]
})

type FormData = z.infer<typeof frontendSchema>

/**
 * Step 4: Cấu hình Frontend
 */
export function StepFrontend() {
  // Subscribe cụ thể vào frontends để đảm bảo re-render
  const frontends = useWizardStore((state) => state.frontends)
  const { projectName, projectId } = useWizardStore()
  const { user } = useAuth()
  const addFrontend = useWizardStore((state) => state.addFrontend)
  const removeFrontend = useWizardStore((state) => state.removeFrontend)
  const [showForm, setShowForm] = useState(false)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDeploying, setIsDeploying] = useState(false)
  const [projectFrontends, setProjectFrontends] = useState<FrontendInfo[]>([])
  const [loadingFrontends, setLoadingFrontends] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [deletingFrontendId, setDeletingFrontendId] = useState<number | null>(null)
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
    resolver: zodResolver(frontendSchema),
    defaultValues: {
      tech: "react",
      sourceType: "zip",
    },
  })

  const sourceType = watch("sourceType")
  const dockerImage = watch("dockerImage")
  const publicUrl = watch("publicUrl")

  useEffect(() => {
    setDnsStatus("idle")
    setDnsMessage("")
  }, [publicUrl])

  const handleCheckDns = async () => {
    const dnsValue = watch("publicUrl")
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

  // Load frontends từ API
  const loadProjectFrontends = async () => {
    // Lấy projectId từ localStorage hoặc wizard store
    const currentProjectId = localStorage.getItem("currentProjectId") || projectId
    if (!currentProjectId) return

    setLoadingFrontends(true)
    try {
      const response = await getProjectFrontends(currentProjectId)
      setProjectFrontends(response.frontends || [])
    } catch (error) {
      console.error("Lỗi load project frontends:", error)
      // Không hiển thị toast để tránh làm phiền user
    } finally {
      setLoadingFrontends(false)
    }
  }

  // Load frontends khi component mount hoặc projectId thay đổi
  useEffect(() => {
    const currentProjectId = localStorage.getItem("currentProjectId") || projectId
    if (currentProjectId) {
      loadProjectFrontends()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Mở modal xác nhận xóa frontend (từ API)
  const handleDeleteFrontend = (frontendId: number, frontendName: string) => {
    setDeleteTarget({ id: frontendId, name: frontendName, type: "api" })
  }

  // Mở modal xác nhận xóa frontend (từ store)
  const handleDeleteFrontendFromStore = (index: number, frontendName: string) => {
    setDeleteTarget({ id: -1, name: frontendName, type: "store", storeIndex: index })
  }

  // Xác nhận xóa frontend
  const handleConfirmDeleteFrontend = async () => {
    if (!deleteTarget) return

    if (deleteTarget.type === "store" && deleteTarget.storeIndex !== undefined) {
      // Xóa khỏi store (chưa deploy lên server)
      removeFrontend(deleteTarget.storeIndex)
      toast.success(`Đã xóa frontend "${deleteTarget.name}"`)
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

    setDeletingFrontendId(deleteTarget.id)
    try {
      // Gọi API xóa frontend
      await deleteProjectFrontend(currentProjectId, deleteTarget.id)
      
      // Xóa khỏi store ngay lập tức (trước khi reload để đồng bộ với localStorage)
      // Xóa tất cả các item trong store có cùng name
      let foundIndex = frontends.findIndex((f) => f.name === deleteTarget.name)
      while (foundIndex !== -1) {
        removeFrontend(foundIndex)
        // Lấy lại state từ store sau khi xóa
        const updatedFrontends = useWizardStore.getState().frontends
        foundIndex = updatedFrontends.findIndex((f) => f.name === deleteTarget.name)
      }
      
      // Reload danh sách từ API để cập nhật giao diện
      await loadProjectFrontends()
      
      toast.success(`Đã xóa frontend "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa frontend")
      console.error(error)
    } finally {
      setDeletingFrontendId(null)
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
      toast.error("Vui lòng tạo project trước khi thêm frontend")
      return
    }

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

    if (data.sourceType === "image") {
      const validation = validateDockerImage(data.dockerImage || "")
      if (!validation.valid) {
        setErrors({ ...errors, dockerImage: validation.message || "" })
        return
      }
    }

    setIsDeploying(true)
    const loadingToast = toast.loading("Đang triển khai frontend...", {
      description: "Vui lòng đợi trong giây lát",
    })

    try {
      // Chuyển đổi tech sang frameworkType
      const frameworkType = data.tech === "react" ? "REACT" : data.tech === "vue" ? "VUE" : "ANGULAR" as "REACT" | "VUE" | "ANGULAR"
      // Chuyển đổi sourceType sang deploymentType
      const deploymentType = data.sourceType === "zip" ? "FILE" : "DOCKER" as "FILE" | "DOCKER"

      // Gọi API deploy frontend
      await deployFrontend({
        projectName: data.name,
        deploymentType: deploymentType,
        frameworkType: frameworkType,
        dockerImage: data.sourceType === "image" ? data.dockerImage : undefined,
        file: data.sourceType === "zip" ? (zipFile ?? undefined) : undefined,
        domainNameSystem: data.publicUrl || "",
        username: user.username,
        projectId: projectId,
      })

      // Lưu vào store để hiển thị trong danh sách
      const feData: FrontendFormData = {
        name: data.name,
        tech: data.tech,
        sourceType: data.sourceType,
        zipFile: data.sourceType === "zip" ? (zipFile ?? undefined) : undefined,
        dockerImage: data.sourceType === "image" ? data.dockerImage : undefined,
        publicUrl: data.publicUrl || undefined,
      }

      addFrontend(feData)
      toast.dismiss(loadingToast)
      toast.success(`Đã thêm frontend "${data.name}" thành công!`)
      
      // Reload frontends từ API
      await loadProjectFrontends()
      
      reset()
      setZipFile(null)
      setErrors({})
      setShowForm(false)
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi thêm frontend")
      console.error(error)
    } finally {
      setIsDeploying(false)
    }
  }

  const getFrontendTechColor = (tech: string) => {
    if (tech === "REACT" || tech === "react") {
      return { bg: "bg-cyan-100 dark:bg-cyan-950/30", text: "text-cyan-600 dark:text-cyan-400" }
    } else if (tech === "VUE" || tech === "vue") {
      return { bg: "bg-emerald-100 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400" }
    } else if (tech === "ANGULAR" || tech === "angular") {
      return { bg: "bg-red-100 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400" }
    }
    return { bg: "bg-green-100 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400" }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/30">
          <Globe className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Bước 4/5 — Cấu hình Frontend
          </h2>
          <p className="text-muted-foreground mt-1">
            Thiết lập các frontend applications cho project
          </p>
        </div>
      </div>

      <HintBox title="Hướng dẫn">
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Chọn Framework:</strong> React, Vue hoặc Angular</li>
          <li>
            <strong>Upload ZIP:</strong> Tên thư mục gốc trùng với tên dự án
          </li>
          <li>
            <strong>Docker Image:</strong> Phải có file Dockerfile trong thư mục gốc
          </li>
          <li>
            <strong>Domain Name:</strong> Không chứa ký tự đặc biệt, không bắt đầu/kết thúc bằng '-' (ví dụ: <code className="bg-muted px-1 rounded">fe.myapp.local.test</code>)
          </li>
        </ul>
      </HintBox>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/30">
              <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">
              Frontends đã thêm ({projectFrontends.length > 0 ? projectFrontends.length : frontends.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loadingFrontends ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Đang tải danh sách frontends...</span>
            </div>
          ) : projectFrontends.length > 0 ? (
            <div 
              className="space-y-3 max-h-[600px] overflow-y-auto pr-2"
              style={{ scrollBehavior: 'smooth' }}
            >
              {projectFrontends.map((fe) => (
                <motion.div
                  key={fe.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border border-border/50 hover:shadow-lg transition-all">
                    <CardContent className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-border/50">
                        <div className="flex items-start gap-3 flex-1">
                          {(() => {
                            const techColors = getFrontendTechColor(fe.frameworkType || "")
                            return (
                              <div className={`p-2.5 rounded-lg flex-shrink-0 ${techColors.bg}`}>
                                <Globe className={`w-5 h-5 ${techColors.text}`} />
                              </div>
                            )
                          })()}
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">{fe.projectName}</h4>
                            {fe.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{fe.description}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-2">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-xs font-medium">
                                {fe.frameworkType === "REACT" ? "React" : fe.frameworkType === "VUE" ? "Vue" : fe.frameworkType === "ANGULAR" ? "Angular" : fe.frameworkType}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-xs font-medium">
                                {fe.deploymentType === "DOCKER" ? "Docker Image" : fe.deploymentType === "FILE" ? "File ZIP" : fe.deploymentType}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFrontend(fe.id, fe.projectName)}
                          disabled={deletingFrontendId === fe.id}
                          className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          {deletingFrontendId === fe.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Connection Information */}
                      <div className="space-y-3">
                        {/* DNS */}
                        {fe.domainNameSystem && (
                          <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                            <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-950/30 flex-shrink-0 mt-0.5">
                              <Globe className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Domain Name (DNS)
                              </Label>
                              <div className="flex items-center gap-2 mt-1">
                                <a
                                  href={`http://${fe.domainNameSystem}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-sm flex-1 truncate text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    window.open(`http://${fe.domainNameSystem}`, '_blank')
                                  }}
                                >
                                  {fe.domainNameSystem}
                                </a>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      window.open(`http://${fe.domainNameSystem}`, '_blank')
                                    }}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(fe.domainNameSystem || "")
                                      setCopiedField(`dns-${fe.id}`)
                                      toast.success("Đã sao chép DNS")
                                      setTimeout(() => setCopiedField(null), 2000)
                                    }}
                                  >
                                    {copiedField === `dns-${fe.id}` ? (
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
                        {fe.dockerImage && (
                          <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                            <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-950/30 flex-shrink-0 mt-0.5">
                              <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Docker Image
                              </Label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-sm flex-1 truncate">{fe.dockerImage}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(fe.dockerImage || "")
                                    setCopiedField(`docker-${fe.id}`)
                                    toast.success("Đã sao chép Docker Image")
                                    setTimeout(() => setCopiedField(null), 2000)
                                  }}
                                >
                                  {copiedField === `docker-${fe.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : frontends.length > 0 ? (
            // Fallback to store data if API data is not available
            <div 
              className="space-y-3 max-h-[600px] overflow-y-auto pr-2"
              style={{ scrollBehavior: 'smooth' }}
            >
              {frontends.map((fe, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border border-border/50 hover:shadow-lg transition-all">
                    <CardContent className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-border/50">
                        <div className="flex items-start gap-3 flex-1">
                          {(() => {
                            const techColors = getFrontendTechColor(fe.tech || "")
                            return (
                              <div className={`p-2.5 rounded-lg flex-shrink-0 ${techColors.bg}`}>
                                <Globe className={`w-5 h-5 ${techColors.text}`} />
                              </div>
                            )
                          })()}
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">{fe.name}</h4>
                            <div className="flex flex-wrap gap-3 mt-2">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-xs font-medium">
                                {fe.tech === "react" ? "React" : fe.tech === "vue" ? "Vue" : "Angular"}
                              </span>
                              {fe.sourceType && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-xs font-medium">
                                  {fe.sourceType === "image" ? "Docker Image" : "File ZIP"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFrontendFromStore(index, fe.name)}
                          className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Connection Information */}
                      <div className="space-y-3">
                        {/* DNS */}
                        {fe.publicUrl && (
                          <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                            <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-950/30 flex-shrink-0 mt-0.5">
                              <Globe className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Domain Name (DNS)
                              </Label>
                              <div className="flex items-center gap-2 mt-1">
                                <a
                                  href={`http://${fe.publicUrl}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-sm flex-1 truncate text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    window.open(`http://${fe.publicUrl}`, '_blank')
                                  }}
                                >
                                  {fe.publicUrl}
                                </a>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      window.open(`http://${fe.publicUrl}`, '_blank')
                                    }}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(fe.publicUrl || "")
                                      setCopiedField(`dns-store-${index}`)
                                      toast.success("Đã sao chép DNS")
                                      setTimeout(() => setCopiedField(null), 2000)
                                    }}
                                  >
                                    {copiedField === `dns-store-${index}` ? (
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
                        {fe.dockerImage && (
                          <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                            <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-950/30 flex-shrink-0 mt-0.5">
                              <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Docker Image
                              </Label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-sm flex-1 truncate">{fe.dockerImage}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(fe.dockerImage || "")
                                    setCopiedField(`docker-store-${index}`)
                                    toast.success("Đã sao chép Docker Image")
                                    setTimeout(() => setCopiedField(null), 2000)
                                  }}
                                >
                                  {copiedField === `docker-store-${index}` ? (
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/30 mb-3">
                <Globe className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Chưa có frontend nào
              </p>
              <p className="text-xs text-muted-foreground">
                Nhấn "Thêm Frontend" để bắt đầu
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/30">
                <Plus className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-xl">Thêm Frontend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {isDeploying && (
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
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">Thông tin cơ bản</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium">
                      Tên Frontend <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      id="name" 
                      {...register("name")} 
                      placeholder="web-app" 
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
                            <SelectItem value="react">React</SelectItem>
                            <SelectItem value="vue">Vue</SelectItem>
                            <SelectItem value="angular">Angular</SelectItem>
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
                    onClick={() => !isDeploying && document.getElementById("zip-input-fe")?.click()}
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
                    id="zip-input-fe"
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
                  <Label htmlFor="publicUrl" className="text-sm font-medium">Domain Name</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      id="publicUrl"
                      {...register("publicUrl")}
                      placeholder="fe-myapp"
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

              <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    reset()
                    setZipFile(null)
                    setErrors({})
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
                      Thêm Frontend
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
          Thêm Frontend
        </Button>
      )}

      {/* Dialog xác nhận xóa frontend */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa frontend</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa frontend "{deleteTarget?.name}"? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deletingFrontendId !== null}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteFrontend}
              disabled={deletingFrontendId !== null}
            >
              {deletingFrontendId !== null ? "Đang xóa..." : "Xóa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

