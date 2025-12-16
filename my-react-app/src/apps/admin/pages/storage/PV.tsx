import { useEffect, useMemo, useState } from "react";
import { ResourceTable } from "../../components/ResourceTable";
import { adminAPI } from "@/lib/admin-api";
import type { PV, PVDetail } from "@/types/admin";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Trash2, RefreshCw, Search, FileText, Plus } from "lucide-react";
import { toast } from "sonner";

export function PVList() {
  const [pvs, setPvs] = useState<PV[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storageClassFilter, setStorageClassFilter] = useState("all");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailPV, setDetailPV] = useState<PV | null>(null);
  const [pvDetail, setPvDetail] = useState<PVDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [yamlEditDialogOpen, setYamlEditDialogOpen] = useState(false);
  const [editingYamlPV, setEditingYamlPV] = useState<PV | null>(null);
  const [yamlEditContent, setYamlEditContent] = useState("");
  const [isSavingYaml, setIsSavingYaml] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("form");
  const [yamlContent, setYamlContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Lần đầu vào trang: hiển thị loading cho cả bảng
    loadPVs(true);
  }, []);

  const loadPVs = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const data = await adminAPI.getPVs();
      setPvs(data);
    } catch {
      toast.error("Không thể tải danh sách PV");
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
        toast.success("Đã làm mới danh sách PV");
      }
    }
  };

  const filteredPVs = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return pvs.filter((pv) => {
      const matchSearch =
        !search ||
        pv.name.toLowerCase().includes(search) ||
        pv.storageClass.toLowerCase().includes(search) ||
        pv.claim?.name?.toLowerCase().includes(search);
      const matchStatus = statusFilter === "all" || pv.status === statusFilter;
      const matchStorageClass =
        storageClassFilter === "all" || pv.storageClass === storageClassFilter;
      return matchSearch && matchStatus && matchStorageClass;
    });
  }, [pvs, searchTerm, statusFilter, storageClassFilter]);

  const totalCount = pvs.length;
  const filteredCount = filteredPVs.length;
  const tableTitle =
    filteredCount === totalCount
      ? `Danh sách PersistentVolumes (${totalCount})`
      : `Danh sách PersistentVolumes (${filteredCount}/${totalCount})`;

  const storageClassOptions = useMemo(() => {
    const set = new Set(pvs.map((pv) => pv.storageClass).filter(Boolean));
    return Array.from(set).sort();
  }, [pvs]);

  const handleView = async (pv: PV) => {
    setDetailPV(pv);
    setDetailDialogOpen(true);
    setLoadingDetail(true);
    setPvDetail(null);
    try {
      const detail = await adminAPI.getPVDetail(pv.id);
      setPvDetail(detail);
    } catch {
      toast.error("Không thể tải chi tiết PV");
      setDetailDialogOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async (pv: PV) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa PV "${pv.name}"?`)) return;
    try {
      await adminAPI.deletePV(pv.id);
      toast.success("Xóa PV thành công");
      loadPVs();
    } catch {
      toast.error("Không thể xóa PV");
    }
  };

  const handleYamlEdit = async (pv: PV) => {
    setEditingYamlPV(pv);
    setYamlEditDialogOpen(true);
    setYamlEditContent("");
    setLoadingDetail(true);
    try {
      const detail = await adminAPI.getPVDetail(pv.id);
      setYamlEditContent(detail.yaml || "");
    } catch {
      toast.error("Không thể tải YAML của PV");
      setYamlEditDialogOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleYamlEditSubmit = async () => {
    if (!editingYamlPV || !yamlEditContent.trim()) {
      toast.error("YAML không được để trống");
      return;
    }
    try {
      setIsSavingYaml(true);
      await adminAPI.updatePVFromYaml(editingYamlPV.id, yamlEditContent);
      toast.success("Cập nhật PV từ YAML thành công");
      setYamlEditDialogOpen(false);
      setEditingYamlPV(null);
      setYamlEditContent("");
      loadPVs();
    } catch {
      toast.error("Không thể cập nhật PV từ YAML");
    } finally {
      setIsSavingYaml(false);
    }
  };

  const handleYamlCreate = async () => {
    if (!yamlContent.trim()) {
      toast.error("Vui lòng nhập YAML");
      return;
    }
    try {
      setIsSubmitting(true);
      await adminAPI.createPVFromYaml(yamlContent);
      toast.success("Tạo PV thành công từ YAML");
      setIsCreateDialogOpen(false);
      setYamlContent("");
      loadPVs();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo PV từ YAML");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const capacity = formData.get("capacity") as string;
    const accessModesInput = formData.get("accessModes") as string;
    const reclaimPolicyInput = formData.get("reclaimPolicy") as string || "Retain";
    const storageClass = formData.get("storageClass") as string || "";
    const volumeMode = formData.get("volumeMode") as string || "";
    const sourceType = formData.get("sourceType") as string || "";
    const labelsInput = formData.get("labels") as string || "";

    if (!name || !capacity) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    const accessModes = accessModesInput
      ? accessModesInput.split(",").map(m => m.trim()).filter(m => m)
      : ["ReadWriteOnce"];

    // Validate and cast reclaimPolicy to the correct type
    const reclaimPolicy: "Retain" | "Delete" | "Recycle" = 
      (reclaimPolicyInput === "Retain" || reclaimPolicyInput === "Delete" || reclaimPolicyInput === "Recycle")
        ? reclaimPolicyInput
        : "Retain";

    const labels: Record<string, string> = {};
    if (labelsInput) {
      labelsInput.split(",").forEach(pair => {
        const [key, value] = pair.trim().split("=");
        if (key && value) labels[key] = value;
      });
    }

    const source = sourceType ? {
      type: sourceType,
      nfsServer: formData.get("nfsServer") as string || "",
      nfsPath: formData.get("nfsPath") as string || "",
      hostPath: formData.get("hostPath") as string || "",
      localPath: formData.get("localPath") as string || "",
    } : undefined;

    try {
      setIsSubmitting(true);
      const requestData: any = {
        name,
        capacity,
        accessModes,
        reclaimPolicy,
      };
      if (storageClass) requestData.storageClass = storageClass;
      if (volumeMode) requestData.volumeMode = volumeMode;
      if (source) requestData.source = source;
      if (Object.keys(labels).length > 0) requestData.labels = labels;
      
      await adminAPI.createPV(requestData);
      toast.success("Tạo PV thành công");
      setIsCreateDialogOpen(false);
      (e.target as HTMLFormElement).reset();
      loadPVs();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo PV");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Tên",
    },
    {
      key: "capacity",
      label: "Capacity",
      align: "center" as const,
    },
    {
      key: "accessModes",
      label: "Access Modes",
      render: (pv: PV) => (
        <div className="flex flex-wrap gap-1">
          {pv.accessModes.map((mode, index) => (
            <Badge key={`${mode}-${index}`} variant="secondary">
              {mode}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "reclaimPolicy",
      label: "Reclaim Policy",
    },
    {
      key: "status",
      label: "Status",
      render: (pv: PV) => (
        <Badge
          variant={
            pv.status === "available"
              ? "success"
              : pv.status === "bound"
              ? "secondary"
              : "warning"
          }
        >
          {pv.status}
        </Badge>
      ),
    },
    {
      key: "claim",
      label: "Claim",
      render: (pv: PV) =>
        pv.claim ? `${pv.claim.namespace}/${pv.claim.name}` : "-",
    },
    {
      key: "storageClass",
      label: "StorageClass",
    },
    {
      key: "age",
      label: "Age",
      align: "center" as const,
    },
  ];

  const renderCustomActions = (pv: PV) => (
    <>
      <DropdownMenuItem onClick={() => handleView(pv)}>
        <Eye className="mr-2 h-4 w-4" />
        Xem
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleYamlEdit(pv)}>
        <FileText className="mr-2 h-4 w-4" />
        YAML
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDelete(pv)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Xóa
      </DropdownMenuItem>
    </>
  );

  const getStatusLabel = (value: string) => {
    switch (value) {
      case "all":
        return "Tất cả trạng thái";
      case "available":
        return "Available";
      case "bound":
        return "Bound";
      case "released":
        return "Released";
      default:
        return value;
    }
  };

  const getStorageClassLabel = (value: string) => {
    if (value === "all") return "Tất cả StorageClass";
    return value || "-";
  };

  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm PV..."
          className="pl-9"
        />
      </div>
      <div className="w-full sm:w-48">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue>{getStatusLabel(statusFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="bound">Bound</SelectItem>
            <SelectItem value="released">Released</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-full sm:w-48">
        <Select value={storageClassFilter} onValueChange={setStorageClassFilter}>
          <SelectTrigger>
            <SelectValue>{getStorageClassLabel(storageClassFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả StorageClass</SelectItem>
            {storageClassOptions.map((sc) => (
              <SelectItem key={sc} value={sc}>
                {sc || "-"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={() => loadPVs(false)}
        disabled={isRefreshing}
      >
        {isRefreshing ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Đang làm mới...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Làm mới
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <ResourceTable
        title={tableTitle}
        columns={columns}
        data={filteredPVs}
        loading={loading}
        onAdd={() => setIsCreateDialogOpen(true)}
        customActions={renderCustomActions}
        hideSearch
        toolbarContent={filterToolbar}
        emptyMessage="Không tìm thấy PV phù hợp"
      />

      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        pv={detailPV}
        detail={pvDetail}
        loading={loadingDetail}
      />

      {/* YAML Edit Dialog */}
      <Dialog open={yamlEditDialogOpen} onOpenChange={setYamlEditDialogOpen}>
        <DialogContent className="w-[75vw] h-[90vh] max-w-[75vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa YAML: {editingYamlPV?.name}</DialogTitle>
            <DialogDescription>Chỉnh sửa manifest PersistentVolume trực tiếp</DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-4">
              <Textarea
                value={yamlEditContent}
                onChange={(e) => setYamlEditContent(e.target.value)}
                className="flex-1 font-mono text-xs min-h-[500px]"
                placeholder="YAML content..."
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setYamlEditDialogOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleYamlEditSubmit} disabled={isSavingYaml}>
                  {isSavingYaml ? "Đang lưu..." : "Lưu"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Thêm mới PV</DialogTitle>
            <DialogDescription>Tạo PersistentVolume mới từ form hoặc YAML</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col flex-grow overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-grow overflow-hidden">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="form">Form</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
              </TabsList>
              <TabsContent value="form" className="flex-1 flex flex-col overflow-hidden mt-4">
                <form onSubmit={handleFormSubmit} className="flex flex-col flex-grow overflow-hidden">
                  <div className="flex-grow overflow-y-auto space-y-4">
                <div>
                  <Label htmlFor="name">Tên *</Label>
                  <Input id="name" name="name" required placeholder="my-pv" />
                </div>
                <div>
                  <Label htmlFor="capacity">Capacity *</Label>
                  <Input id="capacity" name="capacity" required placeholder="1Gi" />
                </div>
                <div>
                  <Label htmlFor="accessModes">Access Modes (phân cách bằng dấu phẩy)</Label>
                  <Input id="accessModes" name="accessModes" placeholder="ReadWriteOnce,ReadOnlyMany,ReadWriteMany" />
                  <p className="text-xs text-muted-foreground mt-1">Mặc định: ReadWriteOnce</p>
                </div>
                <div>
                  <Label htmlFor="reclaimPolicy">Reclaim Policy</Label>
                  <Select onValueChange={(value) => {
                    const input = document.getElementById("reclaimPolicy") as HTMLInputElement;
                    if (input) input.value = value;
                  }} defaultValue="Retain">
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn reclaim policy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Retain">Retain</SelectItem>
                      <SelectItem value="Delete">Delete</SelectItem>
                      <SelectItem value="Recycle">Recycle</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" id="reclaimPolicy" name="reclaimPolicy" defaultValue="Retain" />
                </div>
                <div>
                  <Label htmlFor="storageClass">Storage Class</Label>
                  <Input id="storageClass" name="storageClass" placeholder="nfs-storage" />
                </div>
                <div>
                  <Label htmlFor="volumeMode">Volume Mode</Label>
                  <Select onValueChange={(value) => {
                    const input = document.getElementById("volumeMode") as HTMLInputElement;
                    if (input) input.value = value;
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn volume mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Filesystem">Filesystem</SelectItem>
                      <SelectItem value="Block">Block</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" id="volumeMode" name="volumeMode" />
                </div>
                <div>
                  <Label htmlFor="sourceType">Source Type</Label>
                  <Select onValueChange={(value) => {
                    const input = document.getElementById("sourceType") as HTMLInputElement;
                    if (input) input.value = value;
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn source type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Không có</SelectItem>
                      <SelectItem value="NFS">NFS</SelectItem>
                      <SelectItem value="HostPath">HostPath</SelectItem>
                      <SelectItem value="Local">Local</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" id="sourceType" name="sourceType" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nfsServer">NFS Server</Label>
                    <Input id="nfsServer" name="nfsServer" placeholder="192.168.1.100" />
                  </div>
                  <div>
                    <Label htmlFor="nfsPath">NFS Path</Label>
                    <Input id="nfsPath" name="nfsPath" placeholder="/srv/nfs/k8s" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="hostPath">Host Path</Label>
                  <Input id="hostPath" name="hostPath" placeholder="/data" />
                </div>
                <div>
                  <Label htmlFor="localPath">Local Path</Label>
                  <Input id="localPath" name="localPath" placeholder="/mnt/local" />
                </div>
                <div>
                  <Label htmlFor="labels">Labels (key=value, phân cách bằng dấu phẩy)</Label>
                  <Input id="labels" name="labels" placeholder="app=nginx,env=prod" />
                </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Hủy
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Đang tạo..." : "Tạo"}
                    </Button>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="yaml" className="flex-1 flex flex-col overflow-hidden mt-4">
                <div className="flex-1 flex flex-col space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Nhập YAML manifest để tạo PV. YAML sẽ được parse và tạo PV tương ứng.
                  </div>
                  <Textarea
                    id="yaml-content"
                    value={yamlContent}
                    onChange={(e) => setYamlContent(e.target.value)}
                    placeholder="apiVersion: v1&#10;kind: PersistentVolume&#10;metadata:&#10;  name: my-pv&#10;spec:&#10;  capacity:&#10;    storage: 1Gi&#10;  accessModes:&#10;    - ReadWriteOnce&#10;  persistentVolumeReclaimPolicy: Retain"
                    className="flex-1 font-mono text-xs min-h-[400px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Hủy
                    </Button>
                    <Button onClick={handleYamlCreate} disabled={isSubmitting}>
                      {isSubmitting ? "Đang tạo..." : "Tạo từ YAML"}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DetailDialog = ({
  open,
  onOpenChange,
  pv,
  detail,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pv: PV | null;
  detail: PVDetail | null;
  loading: boolean;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] min-h-[70vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Chi tiết PV: {pv?.name}</DialogTitle>
        <DialogDescription>Thông tin PersistentVolume</DialogDescription>
      </DialogHeader>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      ) : detail ? (
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="source">Source</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="yaml">YAML</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-auto mt-4">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <OverviewItem label="Capacity" value={detail.capacity || "-"} />
                <OverviewItem label="StorageClass" value={detail.storageClass || "-"} />
                <OverviewItem
                  label="Access Modes"
                  value={detail.accessModes?.join(", ") || "-"}
                />
                <OverviewItem label="Reclaim Policy" value={detail.reclaimPolicy || "-"} />
                <OverviewItem label="Status" value={detail.status || "-"} />
                <OverviewItem
                  label="Claim"
                  value={
                    detail.claim
                      ? `${detail.claim.namespace}/${detail.claim.name}`
                      : "-"
                  }
                />
                <OverviewItem label="Volume Mode" value={detail.volumeMode || "-"} />
                <OverviewItem label="Age" value={detail.age || "-"} />
              </div>
            </TabsContent>

            <TabsContent value="source" className="space-y-4">
              {detail.source ? (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{detail.source.type || "-"}</p>
                  <Label className="text-muted-foreground">Details</Label>
                  <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                    {detail.source.details
                      ? Object.entries(detail.source.details).map(([key, value]) => (
                          <p key={key}>
                            <span className="font-medium">{key}:</span>{" "}
                            {typeof value === "string"
                              ? value
                              : JSON.stringify(value)}
                          </p>
                        ))
                      : "Không có thông tin"}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Không có thông tin nguồn</p>
              )}
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              {detail.events && detail.events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>First</TableHead>
                      <TableHead>Last</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.events.map((event, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{event.type || "-"}</TableCell>
                        <TableCell>{event.reason || "-"}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {event.message || "-"}
                        </TableCell>
                        <TableCell>{event.count || 0}</TableCell>
                        <TableCell>{event.firstTimestamp || "-"}</TableCell>
                        <TableCell>{event.lastTimestamp || "-"} </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">Không có events</p>
              )}
            </TabsContent>

            <TabsContent value="yaml" className="space-y-4">
              <Textarea
                value={detail.yaml || ""}
                readOnly
                className="font-mono text-xs min-h-[400px]"
              />
            </TabsContent>

            <TabsContent value="metadata" className="space-y-4">
              <MetadataSection title="Labels" data={detail.labels} />
              <MetadataSection title="Annotations" data={detail.annotations} />
              <OverviewItem label="UID" value={detail.uid || "-"} />
              <OverviewItem
                label="Resource Version"
                value={detail.resourceVersion || "-"}
              />
              <OverviewItem
                label="Creation Timestamp"
                value={detail.creationTimestamp || "-"}
              />
            </TabsContent>

            <TabsContent value="conditions" className="space-y-4">
              {detail.conditions && detail.conditions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Last Probe</TableHead>
                      <TableHead>Last Transition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.conditions.map((condition, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{condition.type || "-"}</TableCell>
                        <TableCell>{condition.status || "-"}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {condition.message || "-"}
                        </TableCell>
                        <TableCell>{condition.lastProbeTime || "-"}</TableCell>
                        <TableCell>{condition.lastTransitionTime || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">Không có conditions</p>
              )}
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <p className="text-muted-foreground">Không có dữ liệu</p>
      )}
    </DialogContent>
  </Dialog>
);

const MetadataSection = ({
  title,
  data,
}: {
  title: string;
  data?: Record<string, string>;
}) => (
  <div>
    <Label className="text-muted-foreground">{title}</Label>
    {data && Object.keys(data).length > 0 ? (
      <div className="mt-2 space-y-1">
        {Object.entries(data).map(([key, value]) => (
          <p key={key} className="text-sm">
            <span className="font-medium">{key}:</span> {value}
          </p>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">-</p>
    )}
  </div>
);

const OverviewItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <Label className="text-muted-foreground">{label}</Label>
    <p className="font-medium">{value}</p>
  </div>
);

