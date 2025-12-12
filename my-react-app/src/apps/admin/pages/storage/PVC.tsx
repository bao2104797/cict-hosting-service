import { useEffect, useMemo, useState } from "react";
import { ResourceTable } from "../../components/ResourceTable";
import { Badge } from "@/components/ui/badge";
import { adminAPI } from "@/lib/admin-api";
import type { PVC, PVCDetail } from "@/types/admin";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { RefreshCw, Search, Eye, FileText, Trash2, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TruncatedText = ({ text, maxLength = 30 }: { text: string; maxLength?: number }) => {
  const truncated = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  const needsTooltip = text.length > maxLength;

  if (!needsTooltip) {
    return <span className="truncate block">{text}</span>;
  }

  return (
    <Tooltip content={text}>
      <span className="truncate block cursor-help">{truncated}</span>
    </Tooltip>
  );
};

export function PVCList() {
  const [pvcs, setPvcs] = useState<PVC[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailPVC, setDetailPVC] = useState<PVC | null>(null);
  const [pvcDetail, setPvcDetail] = useState<PVCDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [yamlEditDialogOpen, setYamlEditDialogOpen] = useState(false);
  const [editingYamlPVC, setEditingYamlPVC] = useState<PVC | null>(null);
  const [yamlEditContent, setYamlEditContent] = useState("");
  const [isSavingYaml, setIsSavingYaml] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("form");
  const [yamlContent, setYamlContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Lần đầu vào trang: hiển thị loading cho cả bảng
    loadPVCs(true);
  }, []);

  const loadPVCs = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const data = await adminAPI.getPVCs();
      setPvcs(data);
    } catch {
      toast.error("Không thể tải danh sách PVC");
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
        toast.success("Đã làm mới danh sách PVC");
      }
    }
  };

  const handleView = async (pvc: PVC) => {
    setDetailPVC(pvc);
    setDetailDialogOpen(true);
    setLoadingDetail(true);
    setPvcDetail(null);
    try {
      const detail = await adminAPI.getPVCDetail(pvc.id);
      setPvcDetail(detail);
    } catch {
      toast.error("Không thể tải chi tiết PVC");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleYamlEdit = async (pvc: PVC) => {
    setEditingYamlPVC(pvc);
    setYamlEditDialogOpen(true);
    setYamlEditContent("");
    setLoadingDetail(true);
    try {
      const detail = await adminAPI.getPVCDetail(pvc.id);
      setYamlEditContent(detail.yaml || "");
    } catch {
      toast.error("Không thể tải YAML của PVC");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleYamlEditSubmit = async () => {
    if (!editingYamlPVC || !yamlEditContent.trim()) {
      toast.error("YAML không được để trống");
      return;
    }
    try {
      setIsSavingYaml(true);
      await adminAPI.updatePVCFromYaml(editingYamlPVC.id, yamlEditContent);
      toast.success("Cập nhật PVC từ YAML thành công");
      setYamlEditDialogOpen(false);
      setEditingYamlPVC(null);
      setYamlEditContent("");
      loadPVCs();
    } catch {
      toast.error("Không thể cập nhật PVC từ YAML");
    } finally {
      setIsSavingYaml(false);
    }
  };

  const handleDelete = async (pvc: PVC) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa PVC "${pvc.name}"?`)) return;
    try {
      await adminAPI.deletePVC(pvc.id);
      toast.success("Xóa PVC thành công");
      loadPVCs();
    } catch {
      toast.error("Không thể xóa PVC");
    }
  };

  const handleYamlCreate = async () => {
    if (!yamlContent.trim()) {
      toast.error("Vui lòng nhập YAML");
      return;
    }
    try {
      setIsSubmitting(true);
      await adminAPI.createPVCFromYaml(yamlContent);
      toast.success("Tạo PVC thành công từ YAML");
      setIsCreateDialogOpen(false);
      setYamlContent("");
      loadPVCs();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo PVC từ YAML");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const namespace = formData.get("namespace") as string;
    const capacity = formData.get("capacity") as string;
    const accessModesInput = formData.get("accessModes") as string;
    const storageClass = formData.get("storageClass") as string || "";
    const volumeMode = formData.get("volumeMode") as string || "";
    const labelsInput = formData.get("labels") as string || "";

    if (!name || !namespace || !capacity) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    const accessModes = accessModesInput
      ? accessModesInput.split(",").map(m => m.trim()).filter(m => m)
      : ["ReadWriteOnce"];

    const labels: Record<string, string> = {};
    if (labelsInput) {
      labelsInput.split(",").forEach(pair => {
        const [key, value] = pair.trim().split("=");
        if (key && value) labels[key] = value;
      });
    }

    try {
      setIsSubmitting(true);
      const requestData: any = {
        name,
        namespace,
        capacity,
        accessModes,
      };
      if (storageClass) requestData.storageClass = storageClass;
      if (volumeMode) requestData.volumeMode = volumeMode;
      if (Object.keys(labels).length > 0) requestData.labels = labels;
      
      await adminAPI.createPVC(requestData);
      toast.success("Tạo PVC thành công");
      setIsCreateDialogOpen(false);
      (e.target as HTMLFormElement).reset();
      loadPVCs();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo PVC");
    } finally {
      setIsSubmitting(false);
    }
  };

  const namespaceOptions = useMemo(
    () => Array.from(new Set(pvcs.map((item) => item.namespace))).sort(),
    [pvcs]
  );

  const filteredPVCs = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();
    return pvcs.filter((item) => {
      const matchSearch =
        !searchValue ||
        item.name.toLowerCase().includes(searchValue) ||
        item.namespace.toLowerCase().includes(searchValue);
      const matchNamespace = namespaceFilter === "all" || item.namespace === namespaceFilter;
      return matchSearch && matchNamespace;
    });
  }, [pvcs, namespaceFilter, searchTerm]);

  const totalCount = pvcs.length;
  const filteredCount = filteredPVCs.length;
  const tableTitle =
    filteredCount === totalCount
      ? `Danh sách PVC (${totalCount})`
      : `Danh sách PVC (${filteredCount}/${totalCount})`;

  const getNamespaceLabel = (value: string) => {
    if (value === "all") return "Tất cả namespace";
    return value;
  };

  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm PVC..."
          className="pl-9"
        />
      </div>
      <div className="w-full sm:w-48">
        <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
          <SelectTrigger>
            <SelectValue>{getNamespaceLabel(namespaceFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả namespace</SelectItem>
            {namespaceOptions.map((ns) => (
              <SelectItem key={ns} value={ns}>
                {ns}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={() => loadPVCs(false)}
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

  const columns = [
    {
      key: "name",
      label: "Tên",
      render: (pvc: PVC) => <TruncatedText text={pvc.name} maxLength={25} />,
    },
    {
      key: "namespace",
      label: "Namespace",
      render: (pvc: PVC) => <TruncatedText text={pvc.namespace} maxLength={20} />,
    },
    {
      key: "status",
      label: "Status",
      align: "center" as const,
      render: (pvc: PVC) => {
        const statusLower = pvc.status?.toLowerCase() || "pending";
        const variant = 
          statusLower === "bound" ? "success" 
          : statusLower === "lost" ? "destructive" 
          : "warning";
        const displayText = pvc.status || "Pending";
        return <Badge variant={variant}>{displayText}</Badge>;
      },
    },
    {
      key: "volume",
      label: "Volume",
      render: (pvc: PVC) => pvc.volume || "-",
    },
    {
      key: "capacity",
      label: "Capacity",
      align: "center" as const,
    },
    {
      key: "accessModes",
      label: "Access Modes",
      render: (pvc: PVC) =>
        pvc.accessModes.length > 0 ? pvc.accessModes.join(", ") : "-",
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

  const renderCustomActions = (pvc: PVC) => (
    <>
      <DropdownMenuItem onClick={() => handleView(pvc)}>
        <Eye className="mr-2 h-4 w-4" />
        Xem
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleYamlEdit(pvc)}>
        <FileText className="mr-2 h-4 w-4" />
        YAML
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDelete(pvc)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Xóa
      </DropdownMenuItem>
    </>
  );

  return (
    <div className="space-y-6">
      <ResourceTable
        title={tableTitle}
        columns={columns}
        data={filteredPVCs}
        loading={loading}
        onAdd={() => setIsCreateDialogOpen(true)}
        customActions={renderCustomActions}
        hideSearch
        toolbarContent={filterToolbar}
        emptyMessage="Không tìm thấy PVC phù hợp"
      />

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] min-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chi tiết PVC: {detailPVC?.name}</DialogTitle>
            <DialogDescription>Xem thông tin và trạng thái PVC</DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : pvcDetail ? (
            <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="pods">Pods</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-auto mt-4">
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Namespace</Label>
                      <p>{pvcDetail.namespace}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge
                        variant={
                          pvcDetail.status?.toLowerCase() === "bound"
                            ? "success"
                            : pvcDetail.status?.toLowerCase() === "lost"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {pvcDetail.status || "-"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Volume</Label>
                      <p>{pvcDetail.volume || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Capacity</Label>
                      <p>{pvcDetail.capacity || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Access Modes</Label>
                      <p>{pvcDetail.accessModes?.join(", ") || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">StorageClass</Label>
                      <p>{pvcDetail.storageClass || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">VolumeMode</Label>
                      <p>{pvcDetail.volumeMode || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Age</Label>
                      <p>{pvcDetail.age}</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="pods" className="space-y-4">
                  {pvcDetail.pods && pvcDetail.pods.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Namespace</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Node</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pvcDetail.pods.map((pod, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{pod.name}</TableCell>
                            <TableCell>{pod.namespace}</TableCell>
                            <TableCell>{pod.status || "-"}</TableCell>
                            <TableCell>{pod.node || "-"}</TableCell>
                            <TableCell>{pod.age || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground">Không có pod nào đang sử dụng PVC</p>
                  )}
                </TabsContent>
                <TabsContent value="events" className="space-y-4">
                  {pvcDetail.events && pvcDetail.events.length > 0 ? (
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
                        {pvcDetail.events.map((event, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{event.type || "-"}</TableCell>
                            <TableCell>{event.reason || "-"}</TableCell>
                            <TableCell className="max-w-md truncate">{event.message || "-"}</TableCell>
                            <TableCell>{event.count || 0}</TableCell>
                            <TableCell>{event.firstTimestamp || "-"}</TableCell>
                            <TableCell>{event.lastTimestamp || "-"}</TableCell>
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
                    value={pvcDetail.yaml || ""}
                    readOnly
                    className="font-mono text-xs min-h-[400px]"
                  />
                </TabsContent>
                <TabsContent value="metadata" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">UID</Label>
                      <p className="font-mono text-sm">{pvcDetail.uid || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Resource Version</Label>
                      <p className="font-mono text-sm">{pvcDetail.resourceVersion || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Creation Timestamp</Label>
                      <p>{pvcDetail.creationTimestamp || "-"}</p>
                    </div>
                    {pvcDetail.labels && Object.keys(pvcDetail.labels).length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Labels</Label>
                        <div className="mt-2 space-y-1">
                          {Object.entries(pvcDetail.labels).map(([key, value]) => (
                            <p key={key} className="text-sm">
                              <span className="font-medium">{key}:</span> {value}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {pvcDetail.annotations && Object.keys(pvcDetail.annotations).length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Annotations</Label>
                        <div className="mt-2 space-y-1">
                          {Object.entries(pvcDetail.annotations).map(([key, value]) => (
                            <p key={key} className="text-sm">
                              <span className="font-medium">{key}:</span> {value}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="conditions" className="space-y-4">
                  {pvcDetail.conditions && pvcDetail.conditions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Last Transition</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pvcDetail.conditions.map((condition, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{condition.type || "-"}</TableCell>
                            <TableCell>{condition.status || "-"}</TableCell>
                            <TableCell>{condition.reason || "-"}</TableCell>
                            <TableCell className="max-w-md truncate">{condition.message || "-"}</TableCell>
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

      {/* YAML Edit Dialog */}
      <Dialog open={yamlEditDialogOpen} onOpenChange={setYamlEditDialogOpen}>
        <DialogContent className="w-[75vw] h-[90vh] max-w-[75vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa YAML: {editingYamlPVC?.name}</DialogTitle>
            <DialogDescription>Chỉnh sửa manifest PVC trực tiếp</DialogDescription>
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
            <DialogTitle>Thêm mới PVC</DialogTitle>
            <DialogDescription>Tạo PersistentVolumeClaim mới từ form hoặc YAML</DialogDescription>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Tên *</Label>
                    <Input id="name" name="name" required placeholder="my-pvc" />
                  </div>
                  <div>
                    <Label htmlFor="namespace">Namespace *</Label>
                    <Input id="namespace" name="namespace" required placeholder="default" />
                  </div>
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
                    Nhập YAML manifest để tạo PVC. YAML sẽ được parse và tạo PVC tương ứng.
                  </div>
                  <Textarea
                    id="yaml-content"
                    value={yamlContent}
                    onChange={(e) => setYamlContent(e.target.value)}
                    placeholder="apiVersion: v1&#10;kind: PersistentVolumeClaim&#10;metadata:&#10;  name: my-pvc&#10;  namespace: default&#10;spec:&#10;  accessModes:&#10;    - ReadWriteOnce&#10;  resources:&#10;    requests:&#10;      storage: 1Gi"
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


