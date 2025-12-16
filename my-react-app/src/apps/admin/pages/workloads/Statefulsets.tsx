import { useEffect, useMemo, useState } from "react";
import { ResourceTable } from "../../components/ResourceTable";
import { adminAPI } from "@/lib/admin-api";
import type { Statefulset, StatefulsetDetail } from "@/types/admin";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { RefreshCw, Search, Eye, Pencil, Trash2, FileText } from "lucide-react";
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

/**
 * Component helper để truncate text và hiển thị tooltip khi hover
 */
const TruncatedText = ({ text, maxLength = 30 }: { text: string; maxLength?: number }) => {
  const truncated = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
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

/**
 * Trang quản lý Statefulsets
 */
export function Statefulsets() {
  const [statefulsets, setStatefulsets] = useState<Statefulset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStatefulset, setEditingStatefulset] = useState<Statefulset | null>(null);
  const [createMode, setCreateMode] = useState<"yaml" | "form">("form");
  const [yamlContent, setYamlContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailStatefulset, setDetailStatefulset] = useState<Statefulset | null>(null);
  const [statefulsetDetail, setStatefulsetDetail] = useState<StatefulsetDetail | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [scalingStatefulset, setScalingStatefulset] = useState<Statefulset | null>(null);
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [scaleValue, setScaleValue] = useState(1);
  const [isScaling, setIsScaling] = useState(false);
  const [yamlEditDialogOpen, setYamlEditDialogOpen] = useState(false);
  const [editingYamlStatefulset, setEditingYamlStatefulset] = useState<Statefulset | null>(null);
  const [yamlEditContent, setYamlEditContent] = useState("");
  const [isSavingYaml, setIsSavingYaml] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [containerCount, setContainerCount] = useState(1);

  const getNamespaceLabel = (value: string) => {
    if (value === "all") return "Tất cả namespace";
    return value;
  };

  const getStatusLabel = (value: string) => {
    switch (value) {
      case "all":
        return "Tất cả trạng thái";
      case "running":
        return "Running";
      case "error":
        return "Error";
      default:
        return "Tất cả trạng thái";
    }
  };

  useEffect(() => {
    // Lần đầu vào trang: hiển thị loading cho cả bảng
    loadStatefulsets(true);
  }, []);

  const loadStatefulsets = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const data = await adminAPI.getStatefulsets();
      setStatefulsets(data);
    } catch (error) {
      toast.error("Không thể tải danh sách statefulsets");
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
        toast.success("Đã làm mới danh sách statefulsets");
      }
    }
  };

  const clearDialogState = () => {
    setEditingStatefulset(null);
    setCreateMode("form");
    setYamlContent("");
    setIsSubmitting(false);
    setContainerCount(1);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    clearDialogState();
  };

  const handleAdd = () => {
    setCreateMode("form");
    setYamlContent("");
    setEditingStatefulset(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (sts: Statefulset) => {
    setEditingStatefulset(sts);
    setCreateMode("form");
    setIsDialogOpen(true);
  };

  const handleDelete = async (sts: Statefulset) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa statefulset "${sts.name}"?`)) return;
    try {
      await adminAPI.deleteStatefulset(sts.id);
      toast.success("Xóa statefulset thành công");
      loadStatefulsets();
    } catch (error) {
      toast.error("Không thể xóa statefulset");
    }
  };

  const handleView = async (sts: Statefulset) => {
    setDetailStatefulset(sts);
    setIsDetailDialogOpen(true);
    setLoadingDetail(true);
    setStatefulsetDetail(null);

    try {
      const detail = await adminAPI.getStatefulsetDetail(sts.id);
      setStatefulsetDetail(detail);
    } catch (error) {
      toast.error("Không thể tải chi tiết statefulset");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleScale = (sts: Statefulset) => {
    setScalingStatefulset(sts);
    setScaleValue(sts.replicas.desired || 1);
    setScaleDialogOpen(true);
  };

  const handleScaleSubmit = async () => {
    if (!scalingStatefulset) return;
    try {
      setIsScaling(true);
      await adminAPI.scaleStatefulset(scalingStatefulset.id, scaleValue);
      toast.success(`Đã scale statefulset ${scalingStatefulset.name} về ${scaleValue}`);
      setScaleDialogOpen(false);
      setScalingStatefulset(null);
      loadStatefulsets();
    } catch (error) {
      toast.error("Không thể scale statefulset");
    } finally {
      setIsScaling(false);
    }
  };


  const handleYamlEdit = async (sts: Statefulset) => {
    setEditingYamlStatefulset(sts);
    setYamlEditDialogOpen(true);
    setYamlEditContent("");
    setLoadingDetail(true);
    try {
      const detail = await adminAPI.getStatefulsetDetail(sts.id);
      setYamlEditContent(detail.yaml || "");
    } catch {
      toast.error("Không thể tải YAML của statefulset");
      setYamlEditDialogOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleYamlEditSubmit = async () => {
    if (!editingYamlStatefulset || !yamlEditContent.trim()) {
      toast.error("YAML không được để trống");
      return;
    }
    try {
      setIsSavingYaml(true);
      await adminAPI.updateStatefulsetFromYaml(editingYamlStatefulset.id, yamlEditContent);
      toast.success("Cập nhật statefulset từ YAML thành công");
      setYamlEditDialogOpen(false);
      setEditingYamlStatefulset(null);
      setYamlEditContent("");
      loadStatefulsets();
    } catch {
      toast.error("Không thể cập nhật statefulset từ YAML");
    } finally {
      setIsSavingYaml(false);
    }
  };

  const renderCustomActions = (sts: Statefulset) => (
    <>
      <DropdownMenuItem onClick={() => handleView(sts)}>
        <Eye className="mr-2 h-4 w-4" />
        Xem
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleYamlEdit(sts)}>
        <FileText className="mr-2 h-4 w-4" />
        YAML
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleScale(sts)}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Scale
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDelete(sts)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Xóa
      </DropdownMenuItem>
    </>
  );

  const handleYamlCreate = async () => {
    if (!yamlContent.trim()) {
      toast.error("Vui lòng nhập YAML");
      return;
    }
    try {
      setIsSubmitting(true);
      await adminAPI.createStatefulsetFromYaml(yamlContent);
      toast.success("Tạo statefulset thành công từ YAML");
      closeDialog();
      loadStatefulsets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo statefulset từ YAML");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const replicas = parseInt(formData.get("replicas") as string) || 1;
    const serviceName = formData.get("serviceName") as string || "";
    const selectorInput = (formData.get("selector") as string) || "";
    const labelsInput = (formData.get("labels") as string) || "";

    // Tạo containers array từ form
    const containers = [];
    for (let i = 0; i < containerCount; i++) {
      const name = formData.get(`container-${i}-name`) as string;
      const image = formData.get(`container-${i}-image`) as string;
      if (!name || !image) continue;

      const portsInput = formData.get(`container-${i}-ports`) as string || "";
      const cpuRequest = formData.get(`container-${i}-cpu-request`) as string || "";
      const memoryRequest = formData.get(`container-${i}-memory-request`) as string || "";
      const cpuLimit = formData.get(`container-${i}-cpu-limit`) as string || "";
      const memoryLimit = formData.get(`container-${i}-memory-limit`) as string || "";

      const ports = portsInput ? portsInput.split(",").map(p => {
        const parts = p.trim().split(":");
        if (parts.length === 1) {
          return {
            containerPort: parseInt(parts[0]) || 80,
            protocol: "TCP",
          };
        } else if (parts.length === 2) {
          const portNum = parseInt(parts[1]) || parseInt(parts[0]);
          if (!isNaN(portNum)) {
            return {
              name: isNaN(parseInt(parts[0])) ? parts[0] : undefined,
              containerPort: portNum,
              protocol: parts[1] || "TCP",
            };
          }
          return {
            containerPort: parseInt(parts[0]) || 80,
            protocol: parts[1] || "TCP",
          };
        } else {
          return {
            name: parts[0] || undefined,
            containerPort: parseInt(parts[1]) || 80,
            protocol: parts[2] || "TCP",
          };
        }
      }).filter(p => p.containerPort) : [];

      const resources: any = {};
      if (cpuRequest || memoryRequest) {
        resources.requests = {};
        if (cpuRequest) resources.requests.cpu = cpuRequest;
        if (memoryRequest) resources.requests.memory = memoryRequest;
      }
      if (cpuLimit || memoryLimit) {
        resources.limits = {};
        if (cpuLimit) resources.limits.cpu = cpuLimit;
        if (memoryLimit) resources.limits.memory = memoryLimit;
      }

      const pullPolicyInput = document.querySelector(`input[name="container-${i}-pullPolicy"]`) as HTMLInputElement;
      containers.push({
        name,
        image,
        imagePullPolicy: (pullPolicyInput?.value || formData.get(`container-${i}-pullPolicy`) as string || "IfNotPresent"),
        ports: ports.length > 0 ? ports : undefined,
        resources: Object.keys(resources).length > 0 ? resources : undefined,
      });
    }

    if (containers.length === 0) {
      toast.error("Vui lòng nhập ít nhất một container");
      return;
    }

    // Parse selector
    const selector: Record<string, string> = {};
    if (selectorInput) {
      selectorInput.split(",").forEach(pair => {
        const [key, value] = pair.trim().split("=").map(s => s.trim());
        if (key && value) selector[key] = value;
      });
    }
    if (Object.keys(selector).length === 0) {
      selector.app = formData.get("name") as string || "app";
    }

    // Parse labels
    const labels: Record<string, string> = {};
    if (labelsInput) {
      labelsInput.split(",").forEach(pair => {
        const [key, value] = pair.trim().split("=").map(s => s.trim());
        if (key && value) labels[key] = value;
      });
    }

    const data = {
      name: formData.get("name") as string,
      namespace: formData.get("namespace") as string,
      replicas,
      serviceName: serviceName || undefined,
      containers,
      selector: Object.keys(selector).length > 0 ? selector : undefined,
      labels: Object.keys(labels).length > 0 ? labels : undefined,
    };

    try {
      setIsSubmitting(true);
      if (editingStatefulset) {
        await adminAPI.updateStatefulset(editingStatefulset.id, data);
        toast.success("Cập nhật statefulset thành công");
      } else {
        await adminAPI.createStatefulset(data);
        toast.success("Tạo statefulset thành công");
      }
      closeDialog();
      loadStatefulsets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể lưu statefulset");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Tên",
      render: (sts: Statefulset) => <TruncatedText text={sts.name} maxLength={25} />,
    },
    {
      key: "namespace",
      label: "Namespace",
      render: (sts: Statefulset) => <TruncatedText text={sts.namespace} maxLength={20} />,
    },
    {
      key: "replicas",
      label: "Replicas",
      align: "center" as const,
      render: (sts: Statefulset) => (
        <span>
          {sts.replicas.ready} / {sts.replicas.desired}
        </span>
      ),
    },
    {
      key: "image",
      label: "Image",
      render: (sts: Statefulset) => (
        <TruncatedText text={sts.images.length > 0 ? sts.images[0] : "-"} maxLength={30} />
      ),
    },
    {
      key: "cpu",
      label: "CPU",
      align: "center" as const,
      render: (sts: Statefulset) => <span>{sts.cpu || "0m"}</span>,
    },
    {
      key: "memory",
      label: "RAM",
      align: "center" as const,
      render: (sts: Statefulset) => <span>{sts.memory || "0"}</span>,
    },
    {
      key: "age",
      label: "Age",
      align: "center" as const,
    },
  ];

  const namespaceOptions = useMemo(
    () => Array.from(new Set(statefulsets.map((item) => item.namespace))).sort(),
    [statefulsets]
  );

  const filteredStatefulsets = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();
    return statefulsets.filter((sts) => {
      const matchSearch = !searchValue || sts.name.toLowerCase().includes(searchValue);
      const matchNamespace = namespaceFilter === "all" || sts.namespace === namespaceFilter;
      const matchStatus = statusFilter === "all" || sts.status === statusFilter;
      return matchSearch && matchNamespace && matchStatus;
    });
  }, [namespaceFilter, searchTerm, statefulsets, statusFilter]);

  const totalCount = statefulsets.length;
  const filteredCount = filteredStatefulsets.length;
  const tableTitle =
    filteredCount === totalCount
      ? `Danh sách Statefulsets (${totalCount})`
      : `Danh sách Statefulsets (${filteredCount}/${totalCount})`;

  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm statefulset..."
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
      <div className="w-full sm:w-48">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue>{getStatusLabel(statusFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={() => loadStatefulsets(false)}
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

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
      <div className="flex-grow overflow-y-auto space-y-4">
        <div>
          <Label htmlFor="name">Tên</Label>
          <Input id="name" name="name" defaultValue={editingStatefulset?.name ?? ""} required />
        </div>
        <div>
          <Label htmlFor="namespace">Namespace</Label>
          <Input
            id="namespace"
            name="namespace"
            defaultValue={editingStatefulset?.namespace ?? "default"}
            required
          />
        </div>
        <div>
          <Label htmlFor="replicas">Replicas</Label>
          <Input
            id="replicas"
            name="replicas"
            type="number"
            min="1"
            defaultValue={editingStatefulset?.replicas.desired ?? 1}
            required
          />
        </div>
        <div>
          <Label htmlFor="service">Service</Label>
          <Input
            id="service"
            name="service"
            defaultValue={editingStatefulset?.service ?? ""}
            required
          />
        </div>
        <div>
          <Label htmlFor="containers">Containers (phân cách bằng dấu phẩy)</Label>
          <Input
            id="containers"
            name="containers"
            placeholder="mysql, backup"
            defaultValue={editingStatefulset?.containers.join(", ") ?? ""}
            required
          />
        </div>
        <div>
          <Label htmlFor="images">Images (phân cách bằng dấu phẩy)</Label>
          <Input
            id="images"
            name="images"
            placeholder="mysql:8.0, alpine:3.18"
            defaultValue={editingStatefulset?.images.join(", ") ?? ""}
            required
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <Button variant="outline" type="button" onClick={closeDialog} disabled={isSubmitting}>
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Đang lưu..." : editingStatefulset ? "Lưu" : "Tạo"}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <ResourceTable
        title={tableTitle}
        columns={columns}
        data={filteredStatefulsets}
        loading={loading}
        onAdd={handleAdd}
        customActions={renderCustomActions}
        hideSearch
        toolbarContent={filterToolbar}
        emptyMessage="Không tìm thấy statefulset phù hợp"
      />

      {/* Create/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            clearDialogState();
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingStatefulset ? "Sửa Statefulset" : "Tạo Statefulset mới"}</DialogTitle>
            <DialogDescription>
              Tạo statefulset mới bằng form hoặc YAML manifest.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col flex-grow overflow-hidden">
            {editingStatefulset ? (
              renderForm()
            ) : (
              <Tabs value={createMode} onValueChange={(value) => setCreateMode(value as "yaml" | "form")} className="flex flex-col flex-grow overflow-hidden">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="form">Form</TabsTrigger>
                  <TabsTrigger value="yaml">YAML</TabsTrigger>
                </TabsList>
                <TabsContent value="yaml" className="flex-1 flex flex-col overflow-hidden mt-4">
                  <div className="flex-1 flex flex-col space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Dán YAML Statefulset để hệ thống tạo tự động.
                    </div>
                    <Textarea
                      placeholder="apiVersion: apps/v1&#10;kind: StatefulSet&#10;metadata:..."
                      className="flex-1 font-mono text-xs min-h-[400px]"
                      value={yamlContent}
                      onChange={(e) => setYamlContent(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                        Hủy
                      </Button>
                      <Button onClick={handleYamlCreate} disabled={isSubmitting}>
                        {isSubmitting ? "Đang tạo..." : "Tạo từ YAML"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="form" className="flex-1 flex flex-col overflow-hidden mt-4">
                  {renderForm()}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] min-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chi tiết Statefulset: {detailStatefulset?.name}</DialogTitle>
            <DialogDescription>Thông tin chi tiết của statefulset</DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : statefulsetDetail ? (
            <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="pods">Pods</TabsTrigger>
                <TabsTrigger value="pvcs">PVCs</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-auto mt-4">
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Tên</Label>
                      <p className="font-medium">{statefulsetDetail.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Namespace</Label>
                      <p>{statefulsetDetail.namespace}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Replicas</Label>
                      <p>
                        {statefulsetDetail.replicas?.ready || 0} / {statefulsetDetail.replicas?.desired || 0}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge variant={statefulsetDetail.status === "running" ? "default" : "destructive"}>
                        {statefulsetDetail.status}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Service</Label>
                      <p>{statefulsetDetail.service || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Age</Label>
                      <p>{statefulsetDetail.age}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">CPU</Label>
                      <p>{statefulsetDetail.cpu || "0m"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Memory</Label>
                      <p>{statefulsetDetail.memory || "0"}</p>
                    </div>
                  </div>
                  {statefulsetDetail.images && statefulsetDetail.images.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Images</Label>
                      <div className="mt-1 space-y-1">
                        {statefulsetDetail.images.map((img, idx) => (
                          <p key={idx} className="text-sm font-mono">{img}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {statefulsetDetail.volumeClaimTemplates && statefulsetDetail.volumeClaimTemplates.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Volume Claim Templates</Label>
                      <div className="mt-2 space-y-2">
                        {statefulsetDetail.volumeClaimTemplates.map((vct, idx) => (
                          <div key={idx} className="border rounded p-2 text-sm">
                            <p><strong>Name:</strong> {vct.name || "-"}</p>
                            <p><strong>Storage Class:</strong> {vct.storageClass || "-"}</p>
                            <p><strong>Access Mode:</strong> {vct.accessMode || "-"}</p>
                            <p><strong>Size:</strong> {vct.size || "-"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="pods" className="space-y-4">
                  {statefulsetDetail.pods && statefulsetDetail.pods.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Namespace</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ready</TableHead>
                          <TableHead>Restarts</TableHead>
                          <TableHead>Node</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statefulsetDetail.pods.map((pod, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{pod.name}</TableCell>
                            <TableCell>{pod.namespace}</TableCell>
                            <TableCell>
                              <Badge variant={pod.status === "Running" ? "default" : "destructive"}>
                                {pod.status || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell>{pod.ready || "-"}</TableCell>
                            <TableCell>{pod.restarts || 0}</TableCell>
                            <TableCell>{pod.node || "-"}</TableCell>
                            <TableCell>{pod.ip || "-"}</TableCell>
                            <TableCell>{pod.age || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground">Không có pods</p>
                  )}
                </TabsContent>
                <TabsContent value="pvcs" className="space-y-4">
                  {statefulsetDetail.pvcs && statefulsetDetail.pvcs.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Namespace</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Volume</TableHead>
                          <TableHead>Capacity</TableHead>
                          <TableHead>Storage Class</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statefulsetDetail.pvcs.map((pvc, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{pvc.name}</TableCell>
                            <TableCell>{pvc.namespace}</TableCell>
                            <TableCell>
                              <Badge variant={pvc.status === "Bound" ? "default" : "secondary"}>
                                {pvc.status || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell>{pvc.volume || "-"}</TableCell>
                            <TableCell>{pvc.capacity || "-"}</TableCell>
                            <TableCell>{pvc.storageClass || "-"}</TableCell>
                            <TableCell>{pvc.age || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground">Không có PVCs</p>
                  )}
                </TabsContent>
                <TabsContent value="events" className="space-y-4">
                  {statefulsetDetail.events && statefulsetDetail.events.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Count</TableHead>
                          <TableHead>First Timestamp</TableHead>
                          <TableHead>Last Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statefulsetDetail.events.map((event, idx) => (
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
                    value={statefulsetDetail.yaml || ""}
                    readOnly
                    className="font-mono text-xs min-h-[400px]"
                  />
                </TabsContent>
                <TabsContent value="metadata" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">UID</Label>
                      <p className="font-mono text-sm">{statefulsetDetail.uid || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Resource Version</Label>
                      <p className="font-mono text-sm">{statefulsetDetail.resourceVersion || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Creation Timestamp</Label>
                      <p>{statefulsetDetail.creationTimestamp || "-"}</p>
                    </div>
                    {statefulsetDetail.labels && Object.keys(statefulsetDetail.labels).length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Labels</Label>
                        <div className="mt-2 space-y-1">
                          {Object.entries(statefulsetDetail.labels).map(([key, value]) => (
                            <p key={key} className="text-sm">
                              <span className="font-medium">{key}:</span> {value}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {statefulsetDetail.annotations && Object.keys(statefulsetDetail.annotations).length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Annotations</Label>
                        <div className="mt-2 space-y-1">
                          {Object.entries(statefulsetDetail.annotations).map(([key, value]) => (
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
                  {statefulsetDetail.conditions && statefulsetDetail.conditions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Last Transition Time</TableHead>
                          <TableHead>Last Update Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statefulsetDetail.conditions.map((condition, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{condition.type || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={condition.status === "True" ? "default" : "destructive"}>
                                {condition.status || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell>{condition.reason || "-"}</TableCell>
                            <TableCell className="max-w-md truncate">{condition.message || "-"}</TableCell>
                            <TableCell>{condition.lastTransitionTime || "-"}</TableCell>
                            <TableCell>{condition.lastUpdateTime || "-"}</TableCell>
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

      {/* Scale Dialog */}
      <Dialog
        open={scaleDialogOpen}
        onOpenChange={(open) => {
          setScaleDialogOpen(open);
          if (!open) {
            setScalingStatefulset(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scale Statefulset</DialogTitle>
            <DialogDescription>
              Đặt lại số lượng replicas cho statefulset {scalingStatefulset?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="sts-scale">Replicas</Label>
            <Input
              id="sts-scale"
              type="number"
              min={1}
              value={scaleValue}
              onChange={(e) => setScaleValue(Math.max(1, Number(e.target.value)))}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setScaleDialogOpen(false);
                  setScalingStatefulset(null);
                }}
                disabled={isScaling}
              >
                Hủy
              </Button>
              <Button onClick={handleScaleSubmit} disabled={isScaling}>
                {isScaling ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* YAML Edit Dialog */}
      <Dialog open={yamlEditDialogOpen} onOpenChange={setYamlEditDialogOpen}>
        <DialogContent className="w-[75vw] h-[90vh] max-w-[75vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa YAML: {editingYamlStatefulset?.name}</DialogTitle>
            <DialogDescription>Chỉnh sửa manifest Statefulset trực tiếp</DialogDescription>
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

    </div>
  );
}
