import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Upload, X, Plus, Loader2, Eye, EyeOff, Trash2 } from "lucide-react"
import { motion } from "framer-motion"
import type { DatabaseFormData } from "@/types"
import { validateZipFile, validateIP, validatePort } from "@/lib/validators"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HintBox } from "@/apps/user/components/HintBox"
import { useWizardStore } from "@/apps/user/stores/wizard-store"
import { useAuth } from "@/contexts/AuthContext"
import { deployDatabase, getProjectDatabases, deleteProjectDatabase, type DatabaseInfo } from "@/lib/project-api"
import { toast } from "sonner"

// Schema validation
const databaseSchema = z.object({
  name: z.string().min(1, "Tên database không được để trống"),
  type: z.enum(["mysql", "mongodb"]),
  databaseName: z.string().min(1, "Tên database không được để trống"),
  username: z.string().min(1, "Username database không được để trống"),
  password: z.string().min(1, "Password database không được để trống"),
})

type FormData = z.infer<typeof databaseSchema>

/**
 * Step 2: Cấu hình Database
 */
export function StepDatabase() {
  // Subscribe cụ thể vào databases để đảm bảo re-render
  const databases = useWizardStore((state) => state.databases)
  const { projectName, projectId, addDatabase, removeDatabase } = useWizardStore()
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [zipError, setZipError] = useState<string>("")
  const [isDeploying, setIsDeploying] = useState(false)
  const [projectDatabases, setProjectDatabases] = useState<DatabaseInfo[]>([])
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({})
  const [deletingDatabaseId, setDeletingDatabaseId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; type: "api" | "store"; storeIndex?: number } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(databaseSchema),
    defaultValues: {
      type: "mysql",
    },
  })

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

  // Load databases khi component mount hoặc projectId thay đổi
  useEffect(() => {
    loadProjectDatabases()
  }, [projectId])

  // Debug: Log khi databases thay đổi
  useEffect(() => {
    console.log("Databases đã thay đổi:", databases)
  }, [databases])

  // Mở modal xác nhận xóa database (từ API)
  const handleDeleteDatabase = (databaseId: number, databaseName: string) => {
    setDeleteTarget({ id: databaseId, name: databaseName, type: "api" })
  }

  // Mở modal xác nhận xóa database (từ store)
  const handleDeleteDatabaseFromStore = (index: number, databaseName: string) => {
    setDeleteTarget({ id: -1, name: databaseName, type: "store", storeIndex: index })
  }

  // Xác nhận xóa database
  const handleConfirmDeleteDatabase = async () => {
    if (!deleteTarget) return

    if (deleteTarget.type === "store" && deleteTarget.storeIndex !== undefined) {
      // Xóa khỏi store (chưa deploy lên server)
      removeDatabase(deleteTarget.storeIndex)
      toast.success(`Đã xóa database "${deleteTarget.name}"`)
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

    setDeletingDatabaseId(deleteTarget.id)
    try {
      // Gọi API xóa database
      await deleteProjectDatabase(currentProjectId, deleteTarget.id)
      
      // Reload danh sách từ API để lấy dữ liệu mới nhất
      const apiResponse = await getProjectDatabases(currentProjectId)
      setProjectDatabases(apiResponse.databases || [])
      
      // Đồng bộ store với API response: xóa tất cả các item trong store không còn trong API
      const apiDatabaseNames = new Set((apiResponse.databases || []).map(db => {
        const name = (db.projectName || db.databaseName || "").toLowerCase().trim()
        return name
      }))
      
      // Tìm và xóa các item trong store không còn trong API
      const storeDatabases = useWizardStore.getState().databases
      const indexesToRemove: number[] = []
      
      storeDatabases.forEach((storeDb, index) => {
        const storeDbName = (storeDb.name || storeDb.databaseName || "").toLowerCase().trim()
        // Xóa nếu không còn trong API hoặc có cùng name với item đã xóa
        if (!apiDatabaseNames.has(storeDbName) || storeDbName === deleteTarget.name.toLowerCase().trim()) {
          indexesToRemove.push(index)
        }
      })
      
      // Xóa từ cuối lên để tránh index bị thay đổi
      indexesToRemove.reverse().forEach(index => {
        removeDatabase(index)
      })
      
      // Đảm bảo xóa hết các item có cùng name với item đã xóa (xử lý trường hợp có nhiều item cùng name)
      let foundIndex = useWizardStore.getState().databases.findIndex(
        (d) => {
          const dName = (d.name || "").toLowerCase().trim()
          const dDbName = (d.databaseName || "").toLowerCase().trim()
          const targetName = deleteTarget.name.toLowerCase().trim()
          return dName === targetName || dDbName === targetName
        }
      )
      while (foundIndex !== -1) {
        removeDatabase(foundIndex)
        const updatedDatabases = useWizardStore.getState().databases
        foundIndex = updatedDatabases.findIndex(
          (d) => {
            const dName = (d.name || "").toLowerCase().trim()
            const dDbName = (d.databaseName || "").toLowerCase().trim()
            const targetName = deleteTarget.name.toLowerCase().trim()
            return dName === targetName || dDbName === targetName
          }
        )
      }
      
      toast.success(`Đã xóa database "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa database")
      console.error(error)
    } finally {
      setDeletingDatabaseId(null)
    }
  }

  const onSubmit = async (data: FormData) => {
    if (!user?.username) {
      toast.error("Bạn chưa đăng nhập")
      return
    }

    if (!projectId || !projectName) {
      toast.error("Vui lòng tạo project trước khi thêm database")
      return
    }

    // Validate ZIP nếu có
    if (zipFile) {
      const validation = validateZipFile(zipFile)
      if (!validation.valid) {
        setZipError(validation.message || "")
        return
      }
    }

    setIsDeploying(true)
    const loadingToast = toast.loading("Đang triển khai database...", {
      description: "Vui lòng đợi trong giây lát",
    })

    try {
      // Gọi API deploy database
      await deployDatabase({
        projectName: projectName,
        databaseType: data.type.toUpperCase() as "MYSQL" | "MONGODB",
        databaseName: data.databaseName,
        databaseUsername: data.username,
        databasePassword: data.password,
        file: zipFile || undefined,
        username: user.username,
        projectId: projectId,
      })

      // Lưu vào store để hiển thị trong danh sách
      const dbData: DatabaseFormData = {
        name: data.name,
        type: data.type,
        provision: "system",
        databaseName: data.databaseName,
        username: data.username,
        password: data.password,
        seedZip: zipFile || undefined,
      }

      addDatabase(dbData)
      toast.dismiss(loadingToast)
      toast.success(`Đã thêm database "${data.name}" thành công!`)
      
      // Reload danh sách databases từ API
      await loadProjectDatabases()
      
      reset()
      setZipFile(null)
      setZipError("")
      setShowForm(false)
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi thêm database")
      console.error(error)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Bước 2/5 — Cấu hình Database
        </h2>
        <p className="text-muted-foreground">
          Thiết lập các database cho project của bạn
        </p>
      </div>

      {/* Hướng dẫn */}
      <HintBox title="Hướng dẫn">
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Chọn loại database: MySQL hoặc MongoDB</li>
          <li>
            Hệ thống sẽ tự động tạo và quản lý database
          </li>
          <li>
            Upload file ZIP: Chỉ nhận tệp .zip. Khi giải nén, tên thư mục gốc phải trùng với tên database
          </li>
          <li>Ví dụ cấu trúc: <code className="bg-muted px-1 rounded">my-database.zip (chứa duy nhất 1 file my-database.sql)</code></li>
        </ul>
      </HintBox>

      {/* Danh sách databases đã thêm */}
      <Card>
        <CardHeader>
          <CardTitle>Databases đã thêm ({projectDatabases.length > 0 ? projectDatabases.length : databases.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDatabases ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : projectDatabases.length > 0 ? (
            <div className="space-y-3">
              {projectDatabases.map((db) => (
                <motion.div
                  key={db.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div>
                            <h4 className="font-medium">{db.projectName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {db.databaseType === "MYSQL" ? "MySQL" : db.databaseType === "MONGODB" ? "MongoDB" : db.databaseType}
                            </p>
                          </div>
                          
                          {/* IP, Port, Database Name trên một hàng */}
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">IP:</span>
                              <span className="ml-1 font-mono">{db.databaseIp || "-"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Port:</span>
                              <span className="ml-1 font-mono">{db.databasePort || "-"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Database:</span>
                              <span className="ml-1 font-mono">{db.databaseName || "-"}</span>
                            </div>
                          </div>
                          
                          {/* Username và Password trên một hàng */}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Username:</span>
                              <span className="ml-1 font-mono">{db.databaseUsername || "-"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Password:</span>
                              <span className="font-mono flex-1">
                                {showPasswords[db.id] ? db.databasePassword || "-" : "••••••••"}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  setShowPasswords((prev) => ({
                                    ...prev,
                                    [db.id]: !prev[db.id],
                                  }))
                                }}
                              >
                                {showPasswords[db.id] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDatabase(db.id, db.projectName || db.databaseName || "")}
                          disabled={deletingDatabaseId === db.id}
                          className="flex-shrink-0"
                        >
                          {deletingDatabaseId === db.id ? (
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
          ) : databases.length > 0 ? (
            // Fallback hiển thị từ store nếu API chưa có dữ liệu
            <div className="space-y-3">
              {databases.map((db, index) => (
                <motion.div
                  key={`${db.name}-${index}-${db.type}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{db.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {db.type === "mysql" ? "MySQL" : "MongoDB"} - Của hệ thống
                          </p>
                          {db.databaseName && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Database: {db.databaseName}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDatabaseFromStore(index, db.name)}
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
              Chưa có database nào. Nhấn "Thêm Database" để bắt đầu.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Form thêm database */}
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Thêm Database</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {isDeploying && (
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
                <Label htmlFor="name">
                  Tên Dự Án Database <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="my-database"
                  disabled={isDeploying}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="type">
                  Loại Database <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="type" disabled={isDeploying}>
                        <SelectValue placeholder="Chọn loại database" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mysql">MySQL</SelectItem>
                        <SelectItem value="mongodb">MongoDB</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.type && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.type.message}
                  </p>
                )}
              </div>

              {/* Form fields cho Database connection - chỉ hiển thị cho hệ thống */}
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Thông tin Database của hệ thống
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Nhập thông tin database của bạn muốn tạo
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="databaseName">
                      Tên Database <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="databaseName"
                      {...register("databaseName")}
                      placeholder="my_database"
                      disabled={isDeploying}
                    />
                    {errors.databaseName && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.databaseName.message}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">
                        Username Database <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="username"
                        {...register("username")}
                        placeholder="admin"
                        disabled={isDeploying}
                      />
                      {errors.username && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.username.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="password">
                        Password Database <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        {...register("password")}
                        placeholder="••••••••"
                        disabled={isDeploying}
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.password.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload ZIP */}
              <div>
                <Label>Upload file ZIP (nếu không có file SQL, hệ thống sẽ tạo database rỗng với tên mà bạn nhập)</Label>
                <div
                  className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDeploying ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted"
                  }`}
                  onClick={() => !isDeploying && document.getElementById("zip-input-db")?.click()}
                >
                  {zipFile ? (
                    <div>
                      <p className="font-medium">{zipFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(zipFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          setZipFile(null)
                          setZipError("")
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
                  id="zip-input-db"
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
                        setZipError("")
                      } else {
                        setZipError(validation.message || "")
                      }
                    }
                  }}
                />
                {zipError && (
                  <p className="text-sm text-destructive mt-1">{zipError}</p>
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
                    setZipError("")
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
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Thêm Database
        </Button>
      )}

      {/* Dialog xác nhận xóa database */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa database</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa database "{deleteTarget?.name}"? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deletingDatabaseId !== null}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteDatabase}
              disabled={deletingDatabaseId !== null}
            >
              {deletingDatabaseId !== null ? "Đang xóa..." : "Xóa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

