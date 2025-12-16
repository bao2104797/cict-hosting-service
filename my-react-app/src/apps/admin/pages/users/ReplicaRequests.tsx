import { useEffect, useMemo, useState } from "react"
import { adminAPI } from "@/lib/admin-api"
import type { AdminReplicaRequest } from "@/types/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, RefreshCcw, ShieldCheck, ShieldX } from "lucide-react"

type RequestType = "BACKEND" | "FRONTEND"

const STATUS_OPTIONS = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]

export function ReplicaRequests() {
  const [activeTab, setActiveTab] = useState<RequestType>("BACKEND")
  const [statusFilter, setStatusFilter] = useState<string>("PENDING")

  const getStatusLabel = (value: string) => {
    if (value === "ALL") return "Tất cả"
    return value
  }
  const [backendRequests, setBackendRequests] = useState<AdminReplicaRequest[]>([])
  const [frontendRequests, setFrontendRequests] = useState<AdminReplicaRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [rejectDialog, setRejectDialog] = useState<{
    type: RequestType
    request: AdminReplicaRequest
  } | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [submittingAction, setSubmittingAction] = useState(false)

  const loadRequests = async () => {
    try {
      setLoading(true)
      const normalizedStatus = statusFilter === "ALL" ? undefined : statusFilter
      const [backendData, frontendData] = await Promise.all([
        adminAPI.getBackendReplicaRequests(normalizedStatus),
        adminAPI.getFrontendReplicaRequests(normalizedStatus),
      ])
      setBackendRequests(backendData)
      setFrontendRequests(frontendData)
    } catch (error) {
      console.error("Error loading replica requests:", error)
      toast.error("Không thể tải danh sách yêu cầu replicas")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const handleApprove = async (type: RequestType, requestId: number) => {
    setSubmittingAction(true)
    try {
      if (type === "BACKEND") {
        await adminAPI.approveBackendReplicaRequest(requestId)
      } else {
        await adminAPI.approveFrontendReplicaRequest(requestId)
      }
      toast.success("Đã phê duyệt yêu cầu điều chỉnh replicas")
      await loadRequests()
    } catch (error) {
      console.error("Approve replica request failed:", error)
      toast.error("Không thể phê duyệt yêu cầu")
    } finally {
      setSubmittingAction(false)
    }
  }

  const openRejectDialog = (type: RequestType, request: AdminReplicaRequest) => {
    setRejectReason("")
    setRejectDialog({ type, request })
  }

  const handleReject = async () => {
    if (!rejectDialog) return
    if (!rejectReason.trim()) {
      toast.error("Vui lòng nhập lý do từ chối")
      return
    }
    setSubmittingAction(true)
    try {
      if (rejectDialog.type === "BACKEND") {
        await adminAPI.rejectBackendReplicaRequest(rejectDialog.request.id, rejectReason.trim())
      } else {
        await adminAPI.rejectFrontendReplicaRequest(rejectDialog.request.id, rejectReason.trim())
      }
      toast.success("Đã từ chối yêu cầu điều chỉnh replicas")
      setRejectDialog(null)
      await loadRequests()
    } catch (error) {
      console.error("Reject replica request failed:", error)
      toast.error("Không thể từ chối yêu cầu")
    } finally {
      setSubmittingAction(false)
    }
  }

  const requestsByTab = useMemo(() => {
    return activeTab === "BACKEND" ? backendRequests : frontendRequests
  }, [activeTab, backendRequests, frontendRequests])

  const formatDate = (date?: string) => {
    if (!date) return "-"
    const value = new Date(date)
    if (Number.isNaN(value.getTime())) return date
    return value.toLocaleString("vi-VN")
  }

  const statusBadgeClass = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
      case "CANCELLED":
        return "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200"
      default:
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
    }
  }

  const renderTable = (type: RequestType) => {
    const data = type === "BACKEND" ? backendRequests : frontendRequests
    if (!loading && data.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          Không có yêu cầu nào cho bộ lọc hiện tại.
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Component</TableHead>
              <TableHead>Người dùng</TableHead>
              <TableHead>Replica cũ</TableHead>
              <TableHead>Replica mới</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((request) => (
              <TableRow key={`${type}-${request.id}`}>
                <TableCell className="font-medium">{request.projectName || "-"}</TableCell>
                <TableCell>{request.componentName || "-"}</TableCell>
                <TableCell>{request.username || "-"}</TableCell>
                <TableCell>{request.oldReplicas ?? "-"}</TableCell>
                <TableCell>{request.newReplicas ?? "-"}</TableCell>
                <TableCell>
                  <Badge className={statusBadgeClass(request.status)}>
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(request.createdAt)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApprove(type, request.id)}
                    disabled={
                      request.status !== "PENDING" || submittingAction || loading
                    }
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Phê duyệt
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => openRejectDialog(type, request)}
                    disabled={
                      request.status !== "PENDING" || submittingAction || loading
                    }
                  >
                    <ShieldX className="w-4 h-4 mr-2" />
                    Từ chối
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Yêu cầu điều chỉnh replicas</h1>
          <p className="text-muted-foreground">
            Quản lý và phê duyệt các yêu cầu tăng/giảm replicas của backend & frontend.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue>{getStatusLabel(statusFilter)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "ALL" ? "Tất cả" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadRequests} disabled={loading}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách yêu cầu</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RequestType)}>
            <TabsList>
              <TabsTrigger value="BACKEND">Backend</TabsTrigger>
              <TabsTrigger value="FRONTEND">Frontend</TabsTrigger>
            </TabsList>
            <TabsContent value="BACKEND">
              {loading && activeTab === "BACKEND" ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải dữ liệu...
                </div>
              ) : (
                renderTable("BACKEND")
              )}
            </TabsContent>
            <TabsContent value="FRONTEND">
              {loading && activeTab === "FRONTEND" ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải dữ liệu...
                </div>
              ) : (
                renderTable("FRONTEND")
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối yêu cầu</DialogTitle>
            <DialogDescription>
              Vui lòng nhập lý do từ chối yêu cầu điều chỉnh replicas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Input
              placeholder="Nhập lý do"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectDialog(null)} disabled={submittingAction}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={submittingAction}>
              {submittingAction ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                "Xác nhận từ chối"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

