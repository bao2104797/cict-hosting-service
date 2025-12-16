import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Info, FolderOpen, FileText, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { HintBox } from "@/apps/user/components/HintBox"
import { useWizardStore } from "@/apps/user/stores/wizard-store"
import { useEffect, useState } from "react"
import { createProject } from "@/lib/project-api"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

// Schema validation
const projectInfoSchema = z.object({
  projectName: z.string().min(1, "Tên project không được để trống"),
  description: z.string().optional(),
})

type FormData = z.infer<typeof projectInfoSchema>

/**
 * Step 1: Thông tin Project (Tên và Mô tả)
 */
export function StepProjectInfo() {
  const { projectName, description, projectId, setProjectName, setDescription, setProjectId, setCurrentStep } = useWizardStore()
  const { user } = useAuth()
  const [isCreating, setIsCreating] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(projectInfoSchema),
    defaultValues: {
      projectName: projectName || "",
      description: description || "",
    },
  })

  // Sync form với store khi store thay đổi
  useEffect(() => {
    setValue("projectName", projectName)
    setValue("description", description)
  }, [projectName, description, setValue])

  // Watch để auto-save vào store
  const watchedProjectName = watch("projectName")
  const watchedDescription = watch("description")

  useEffect(() => {
    if (watchedProjectName !== projectName) {
      setProjectName(watchedProjectName || "")
    }
  }, [watchedProjectName, projectName, setProjectName])

  useEffect(() => {
    if (watchedDescription !== description) {
      setDescription(watchedDescription || "")
    }
  }, [watchedDescription, description, setDescription])

  const onSubmit = async (data: FormData) => {
    if (!user?.username) {
      toast.error("Bạn chưa đăng nhập")
      return
    }

    if (projectId) {
      // Project đã được tạo rồi, chỉ cần chuyển sang bước tiếp theo
      setCurrentStep(1)
      return
    }

    setIsCreating(true)
    const loadingToast = toast.loading("Đang tạo project...", {
      description: "Vui lòng đợi trong giây lát",
    })

    try {
      const response = await createProject({
        projectName: data.projectName.trim(),
        description: data.description?.trim() || undefined,
        username: user.username,
      })

      // Lưu projectId vào store
      setProjectId(response.id)
      
      // Lưu projectId vào localStorage
      try {
        localStorage.setItem("currentProjectId", String(response.id))
      } catch (error) {
        console.error("Lỗi lưu projectId vào localStorage:", error)
      }

      toast.dismiss(loadingToast)
      toast.success("Tạo project thành công!")
      
      // Tự động chuyển sang bước tiếp theo
      setCurrentStep(1)
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi tạo project")
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <FolderOpen className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Bước 1/5 — Thông tin Project
          </h2>
          <p className="text-muted-foreground mt-1">
            Nhập tên và mô tả cho project của bạn
          </p>
        </div>
      </div>

      {/* Hướng dẫn */}
      <HintBox title="Hướng dẫn">
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Tên project nên ngắn gọn, dễ nhớ sẽ được dùng để hiển thị trong danh sách</li>
          <li>Mô tả là tùy chọn, nhưng nên điền để dễ quản lý sau này</li>
        </ul>
      </HintBox>

      {/* Form */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-xl">Thông tin Project</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {projectId && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Project đã được tạo thành công!
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Bạn có thể tiếp tục với các bước tiếp theo.
                </p>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="projectName" className="text-sm font-semibold flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                Tên Project <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectName"
                {...register("projectName")}
                placeholder="my-awesome-project"
                className={errors.projectName ? "border-destructive" : ""}
                disabled={isCreating || !!projectId}
              />
              {errors.projectName && (
                <p className="text-sm text-destructive mt-1">
                  {errors.projectName.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Tên project sẽ được dùng làm identifier cho project
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Mô tả (tùy chọn)
              </Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Mô tả về project của bạn..."
                rows={4}
                disabled={isCreating || !!projectId}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mô tả ngắn gọn về mục đích và chức năng của project
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-border/50">
              <Button
                type="submit"
                disabled={isCreating || !!projectId}
                className="min-w-[140px]"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang tạo...
                  </>
                ) : projectId ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Đã tạo project
                  </>
                ) : (
                  "Xác nhận"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

