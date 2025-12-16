import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Upload, X, Plus, Loader2, Eye, EyeOff, Trash2, Database, FileText, Package, CheckCircle2, Network, HardDrive, User, Key, Copy, Check } from "lucide-react"
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
  const [copiedField, setCopiedField] = useState<string | null>(null)
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
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/30">
          <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Bước 2/5 — Cấu hình Database
          </h2>
          <p className="text-muted-foreground mt-1">
            Thiết lập các database cho project của bạn
          </p>
        </div>
      </div>

      {/* Hướng dẫn */}
      <HintBox title="Hướng dẫn">
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Chọn loại database:</strong> MySQL hoặc MongoDB</li>
          <li>
            <strong>Hệ thống sẽ tự động tạo và quản lý database</strong>
          </li>
          <li>
            <strong>Upload file ZIP:</strong> Chỉ nhận tệp .zip. Khi giải nén, tên thư mục gốc phải trùng với tên database
          </li>
          <li><strong>Ví dụ cấu trúc:</strong> <code className="bg-muted px-1 rounded">my-database.zip (chứa duy nhất 1 file my-database.sql)</code></li>
        </ul>
      </HintBox>

      {/* Danh sách databases đã thêm */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/30">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-xl">
              Databases đã thêm ({projectDatabases.length > 0 ? projectDatabases.length : databases.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loadingDatabases ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : projectDatabases.length > 0 ? (
            <div 
              className="space-y-3 max-h-[600px] overflow-y-auto pr-2"
              style={{ scrollBehavior: 'smooth' }}
            >
              {projectDatabases.map((db) => (
                <motion.div
                  key={db.id}
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
                            db.databaseType === "MYSQL" 
                              ? "bg-orange-100 dark:bg-orange-950/30" 
                              : "bg-green-100 dark:bg-green-950/30"
                          }`}>
                            <Database className={`w-5 h-5 ${
                              db.databaseType === "MYSQL"
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-green-600 dark:text-green-400"
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-base">{db.projectName}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {db.databaseType === "MYSQL" ? "MySQL Database" : db.databaseType === "MONGODB" ? "MongoDB Database" : db.databaseType}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDatabase(db.id, db.projectName || db.databaseName || "")}
                          disabled={deletingDatabaseId === db.id}
                          className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          {deletingDatabaseId === db.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Connection Information */}
                      <div className="space-y-3">
                        {/* IP and Port */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {db.databaseIp && (
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                              <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-950/30 flex-shrink-0 mt-0.5">
                                <Network className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  IP Address
                                </Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="font-mono text-sm flex-1 truncate">{db.databaseIp}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 flex-shrink-0"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(db.databaseIp || "")
                                      setCopiedField(`ip-${db.id}`)
                                      toast.success("Đã sao chép IP address")
                                      setTimeout(() => setCopiedField(null), 2000)
                                    }}
                                  >
                                    {copiedField === `ip-${db.id}` ? (
                                      <Check className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {db.databasePort && (
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                              <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-950/30 flex-shrink-0 mt-0.5">
                                <Network className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Port
                                </Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="font-mono text-sm flex-1">{db.databasePort}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 flex-shrink-0"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(String(db.databasePort || ""))
                                      setCopiedField(`port-${db.id}`)
                                      toast.success("Đã sao chép Port")
                                      setTimeout(() => setCopiedField(null), 2000)
                                    }}
                                  >
                                    {copiedField === `port-${db.id}` ? (
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

                        {/* Database Name */}
                        {db.databaseName && (
                          <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                            <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-950/30 flex-shrink-0 mt-0.5">
                              <HardDrive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Database Name
                              </Label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-sm flex-1 truncate">{db.databaseName}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(db.databaseName || "")
                                    setCopiedField(`dbname-${db.id}`)
                                    toast.success("Đã sao chép Database Name")
                                    setTimeout(() => setCopiedField(null), 2000)
                                  }}
                                >
                                  {copiedField === `dbname-${db.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Username and Password */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {db.databaseUsername && (
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                              <div className="p-1.5 rounded-md bg-cyan-100 dark:bg-cyan-950/30 flex-shrink-0 mt-0.5">
                                <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Username
                                </Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="font-mono text-sm flex-1 truncate">{db.databaseUsername}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 flex-shrink-0"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(db.databaseUsername || "")
                                      setCopiedField(`username-${db.id}`)
                                      toast.success("Đã sao chép Username")
                                      setTimeout(() => setCopiedField(null), 2000)
                                    }}
                                  >
                                    {copiedField === `username-${db.id}` ? (
                                      <Check className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {db.databasePassword && (
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-start gap-3">
                              <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-950/30 flex-shrink-0 mt-0.5">
                                <Key className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Password
                                </Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="font-mono text-sm flex-1 truncate">
                                    {showPasswords[db.id] ? db.databasePassword : "••••••••"}
                                  </span>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(db.databasePassword || "")
                                        setCopiedField(`password-${db.id}`)
                                        toast.success("Đã sao chép Password")
                                        setTimeout(() => setCopiedField(null), 2000)
                                      }}
                                    >
                                      {copiedField === `password-${db.id}` ? (
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
                                          [db.id]: !prev[db.id],
                                        }))
                                      }}
                                    >
                                      {showPasswords[db.id] ? (
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
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : databases.length > 0 ? (
            // Fallback hiển thị từ store nếu API chưa có dữ liệu
            <div 
              className="space-y-3 max-h-[600px] overflow-y-auto pr-2"
              style={{ scrollBehavior: 'smooth' }}
            >
              {databases.map((db, index) => (
                <motion.div
                  key={`${db.name}-${index}-${db.type}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border border-border/50 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${
                            db.type === "mysql" 
                              ? "bg-orange-100 dark:bg-orange-950/30" 
                              : "bg-green-100 dark:bg-green-950/30"
                          }`}>
                            <Database className={`w-4 h-4 ${
                              db.type === "mysql"
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-green-600 dark:text-green-400"
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">{db.name}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {db.type === "mysql" ? "MySQL" : "MongoDB"} - Của hệ thống
                            </p>
                            {db.databaseName && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Database: {db.databaseName}
                              </p>
                            )}
                          </div>
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
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/30 mb-3">
                <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Chưa có database nào
              </p>
              <p className="text-xs text-muted-foreground">
                Nhấn "Thêm Database" để bắt đầu
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form thêm database */}
      {showForm ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/30">
                <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-xl">Thêm Database</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">Thông tin cơ bản</Label>
                </div>
                
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">
                    Tên Dự Án Database <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="my-database"
                    disabled={isDeploying}
                    className="mt-1.5"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="type" className="text-sm font-medium">
                    Loại Database <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="type" disabled={isDeploying} className="mt-1.5">
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
              </div>

              {/* Form fields cho Database connection - chỉ hiển thị cho hệ thống */}
              <div className="p-5 bg-muted/50 rounded-lg border border-border/50 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">
                    Thông tin Database của hệ thống
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Nhập thông tin database của bạn muốn tạo
                </p>
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
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-semibold">Upload File (Tùy chọn)</Label>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">
                    Upload file ZIP (nếu không có file SQL, hệ thống sẽ tạo database rỗng với tên mà bạn nhập)
                  </Label>
                  <div
                    className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                      isDeploying 
                        ? "opacity-50 cursor-not-allowed border-muted-foreground/30" 
                        : "cursor-pointer hover:bg-muted/50 hover:border-primary/50 border-border"
                    }`}
                    onClick={() => !isDeploying && document.getElementById("zip-input-db")?.click()}
                  >
                    {zipFile ? (
                      <div className="space-y-3">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/30">
                          <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{zipFile.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(zipFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setZipFile(null)
                            setZipError("")
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
                        <div>
                          <p className="text-sm font-medium">Chọn file hoặc kéo thả vào đây</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            File ZIP, tối đa 100 MB
                          </p>
                        </div>
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
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
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
                <Button type="submit" disabled={isDeploying} className="min-w-[140px]">
                  {isDeploying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang triển khai...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Thêm Database
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full h-12"
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

