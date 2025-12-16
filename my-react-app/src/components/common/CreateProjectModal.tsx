import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FolderPlus, Layers } from "lucide-react"
import { createProject } from "@/lib/project-api"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

interface CreateProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated?: () => void
}

/**
 * Modal tạo project với 2 lựa chọn: Project rỗng hoặc Fullstack
 */
export function CreateProjectModal({
  open,
  onOpenChange,
  onProjectCreated,
}: CreateProjectModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [createMode, setCreateMode] = useState<"empty" | "fullstack" | null>(null)
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleClose = () => {
    onOpenChange(false)
    // Reset state khi đóng
    setTimeout(() => {
      setCreateMode(null)
      setProjectName("")
      setProjectDescription("")
    }, 200)
  }

  const handleCreateEmpty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) {
      toast.error("Vui lòng nhập tên project")
      return
    }

    if (!user?.username) {
      toast.error("Bạn chưa đăng nhập")
      return
    }

    setIsCreating(true)
    try {
      const newProject = await createProject({
        projectName: projectName.trim(),
        description: projectDescription.trim() || undefined,
        username: user.username,
      })
      toast.success("Tạo project thành công!")
      handleClose()
      // Callback để reload danh sách
      if (onProjectCreated) {
        onProjectCreated()
      }
      // Navigate to detail
      navigate(`/projects/${newProject.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi tạo project")
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateFullstack = () => {
    handleClose()
    navigate("/projects/new")
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={createMode === "empty" ? "max-w-6xl w-[90vw] duration-0" : "max-w-2xl"}>
        <DialogHeader>
          <DialogTitle>Tạo Project Mới</DialogTitle>
          <DialogDescription>
            {createMode === "empty" 
              ? "Nhập thông tin project của bạn"
              : "Chọn loại project bạn muốn tạo"}
          </DialogDescription>
        </DialogHeader>

        {!createMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setCreateMode("empty")}
            >
              <CardHeader>
                <FolderPlus className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Tạo Project Rỗng</CardTitle>
                <CardDescription>
                  Tạo project chỉ với tên và mô tả. Bạn có thể thêm components sau.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={handleCreateFullstack}
            >
              <CardHeader>
                <Layers className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Tạo Project Fullstack</CardTitle>
                <CardDescription>
                  Tạo project với đầy đủ thành phần: Database, Backend, Frontend
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <form onSubmit={handleCreateEmpty} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="empty-project-name">
                Tên Project <span className="text-destructive">*</span>
              </Label>
              <Input
                id="empty-project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="my-project"
                disabled={isCreating}
              />
            </div>
            <div>
              <Label htmlFor="empty-project-description">Mô tả (tùy chọn)</Label>
              <Textarea
                id="empty-project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Mô tả ngắn gọn về project..."
                rows={3}
                disabled={isCreating}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateMode(null)
                  setProjectName("")
                  setProjectDescription("")
                }}
                disabled={isCreating}
              >
                Quay lại
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Đang tạo..." : "Tạo Project"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

