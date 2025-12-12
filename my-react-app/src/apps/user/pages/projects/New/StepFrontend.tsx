import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Upload, X, Plus, CheckCircle2, Loader2, Trash2 } from "lucide-react"
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Bước 4/5 — Cấu hình Frontend
        </h2>
        <p className="text-muted-foreground">
          Thiết lập các frontend applications
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>
            Frontends đã thêm ({projectFrontends.length > 0 ? projectFrontends.length : frontends.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFrontends ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Đang tải danh sách frontends...</span>
            </div>
          ) : projectFrontends.length > 0 ? (
            <div className="space-y-3">
              {projectFrontends.map((fe) => (
                <motion.div
                  key={fe.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div>
                            <h4 className="font-medium">{fe.projectName}</h4>
                            {fe.description && (
                              <p className="text-sm text-muted-foreground mt-1">{fe.description}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFrontend(fe.id, fe.projectName)}
                          disabled={deletingFrontendId === fe.id}
                          className="flex-shrink-0"
                        >
                          {deletingFrontendId === fe.id ? (
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
          ) : frontends.length > 0 ? (
            // Fallback to store data if API data is not available
            <div className="space-y-3">
              {frontends.map((fe, index) => (
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
                          <h4 className="font-medium">{fe.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {fe.tech === "react" ? "React" : fe.tech === "vue" ? "Vue" : "Angular"}
                          </p>
                          {fe.publicUrl && (
                            <p className="text-sm text-muted-foreground mt-1">
                              URL: {fe.publicUrl}
                            </p>
                          )}
                          {fe.dockerImage && (
                            <p className="text-sm text-muted-foreground mt-1 font-mono text-xs">
                              {fe.dockerImage}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFrontendFromStore(index, fe.name)}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chưa có frontend nào. Nhấn "Thêm Frontend" để bắt đầu.
            </p>
          )}
        </CardContent>
      </Card>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Thêm Frontend</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Tên Frontend <span className="text-destructive">*</span></Label>
                  <Input id="name" {...register("name")} placeholder="web-app" disabled={isDeploying} />
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
                    onClick={() => !isDeploying && document.getElementById("zip-input-fe")?.click()}
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
                <Label htmlFor="publicUrl">DNS (tùy chọn)</Label>
                <div className="flex gap-2">
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

