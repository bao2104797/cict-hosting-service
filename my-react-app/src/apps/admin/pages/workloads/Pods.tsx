import { useEffect, useMemo, useState } from "react";
import { ResourceTable } from "../../components/ResourceTable";
import { Badge } from "@/components/ui/badge";
import { adminAPI } from "@/lib/admin-api";
import type { Pod, PodDetail } from "@/types/admin";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RefreshCw, Search, Eye, FileText, Trash2, Terminal, ScrollText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Trang quản lý Pods
 */
type PodFormState = {
  name: string;
  namespace: string;
  readyReady: number;
  readyTotal: number;
  status: Pod["status"];
  restarts: number;
  age: string;
  ip: string;
  node: string;
  nominatedNode: string;
  readinessGates: string;
};

const defaultFormState: PodFormState = {
  name: "",
  namespace: "default",
  readyReady: 1,
  readyTotal: 1,
  status: "running",
  restarts: 0,
  age: "0m",
  ip: "",
  node: "",
  nominatedNode: "",
  readinessGates: "",
};

export function Pods() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"yaml" | "form">("form");
  const [yamlContent, setYamlContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<PodFormState>(defaultFormState);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [podDetail, setPodDetail] = useState<PodDetail | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yamlEditDialogOpen, setYamlEditDialogOpen] = useState(false);
  const [editingYamlPod, setEditingYamlPod] = useState<Pod | null>(null);
  const [yamlEditContent, setYamlEditContent] = useState("");
  const [isSavingYaml, setIsSavingYaml] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [viewingLogsPod, setViewingLogsPod] = useState<Pod | null>(null);
  const [podLogs, setPodLogs] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [execDialogOpen, setExecDialogOpen] = useState(false);
  const [executingPod, setExecutingPod] = useState<Pod | null>(null);
  const [execCommand, setExecCommand] = useState("");
  const [execOutput, setExecOutput] = useState("");
  const [execContainer, setExecContainer] = useState("");
  const [executing, setExecuting] = useState(false);

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
      case "pending":
        return "Pending";
      case "failed":
        return "Failed";
      case "succeeded":
        return "Succeeded";
      default:
        return value || "Tất cả trạng thái";
    }
  };

  // Get unique statuses from pods for filter dropdown
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    pods.forEach(pod => {
      if (pod.status) {
        statuses.add(pod.status.toLowerCase());
      }
    });
    return Array.from(statuses).sort();
  }, [pods]);

  useEffect(() => {
    // Lần đầu vào trang: hiển thị loading cho cả bảng
    loadPods(true);
  }, []);

  const loadPods = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const data = await adminAPI.getPods();
      setPods(data);
    } catch (error) {
      toast.error("Không thể tải danh sách pods");
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
        toast.success("Đã làm mới danh sách pods");
      }
    }
  };

  const [containerCount, setContainerCount] = useState(1);

  const resetCreateState = () => {
    setCreateMode("form");
    setYamlContent("");
    setFormData(defaultFormState);
    setContainerCount(1);
  };

  const updateFormField = <K extends keyof PodFormState>(key: K, value: PodFormState[K]) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDelete = async (pod: Pod) => {
    if (!confirm(`Bạn có chắc muốn xóa pod "${pod.name}"?`)) return;
    try {
      await adminAPI.deletePod(pod.id);
      toast.success("Xóa pod thành công");
      loadPods();
    } catch (error) {
      toast.error("Không thể xóa pod");
    }
  };

  const handleView = async (pod: Pod) => {
    setSelectedPod(pod);
    setDetailDialogOpen(true);
    setLoadingDetail(true);
    setPodDetail(null);
    setPodLogs("");
    setSelectedContainer("");

    try {
      const detail = await adminAPI.getPodDetail(pod.id);
      setPodDetail(detail);
    } catch (error) {
      toast.error("Không thể tải chi tiết pod");
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadPodLogs = async (podId: string, container?: string) => {
    setLoadingLogs(true);
    try {
      const logs = await adminAPI.getPodLogs(podId, container);
      setPodLogs(logs);
    } catch (error) {
      toast.error("Không thể tải logs của pod");
      setPodLogs("Không thể tải logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleYamlEdit = async (pod: Pod) => {
    setEditingYamlPod(pod);
    setYamlEditDialogOpen(true);
    setYamlEditContent("");
    setLoadingDetail(true);

    try {
      const detail = await adminAPI.getPodDetail(pod.id);
      setYamlEditContent(detail.yaml || "");
    } catch (error) {
      toast.error("Không thể tải YAML của pod");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleYamlEditSubmit = async () => {
    if (!editingYamlPod || !yamlEditContent.trim()) {
      toast.error("YAML không được để trống");
      return;
    }

    try {
      setIsSavingYaml(true);
      await adminAPI.updatePodFromYaml(editingYamlPod.id, yamlEditContent);
      toast.success("Cập nhật pod từ YAML thành công");
      setYamlEditDialogOpen(false);
      setEditingYamlPod(null);
      setYamlEditContent("");
      loadPods();
    } catch (error) {
      toast.error("Không thể cập nhật pod từ YAML");
    } finally {
      setIsSavingYaml(false);
    }
  };

  const handleViewLogs = async (pod: Pod) => {
    setViewingLogsPod(pod);
    setLogsDialogOpen(true);
    setPodLogs("");
    setSelectedContainer("");
    await loadPodLogs(pod.id);
  };

  const handleRefreshLogs = async () => {
    const podId = viewingLogsPod?.id || selectedPod?.id;
    if (!podId) return;
    await loadPodLogs(podId, selectedContainer || undefined);
  };

  const handleExecShell = async (pod: Pod) => {
    setExecutingPod(pod);
    setExecDialogOpen(true);
    setExecCommand("");
    setExecOutput("");
    setExecContainer("");
    
    // Load pod detail để lấy danh sách containers
    try {
      const detail = await adminAPI.getPodDetail(pod.id);
      if (detail.containers && detail.containers.length > 0) {
        setExecContainer(detail.containers[0].name);
      }
    } catch (error) {
      // Bỏ qua lỗi
    }
  };

  const handleExecCommand = async () => {
    if (!executingPod || !execCommand.trim()) {
      toast.error("Vui lòng nhập command");
      return;
    }

    setExecuting(true);
    setExecOutput("");
    try {
      const output = await adminAPI.execPodCommand(
        executingPod.id,
        execCommand.trim(),
        execContainer || undefined
      );
      setExecOutput(output);
    } catch (error: any) {
      setExecOutput(`Error: ${error.message || "Không thể thực thi command"}`);
      toast.error("Không thể thực thi command");
    } finally {
      setExecuting(false);
    }
  };

  const renderCustomActions = (pod: Pod) => (
    <>
      <DropdownMenuItem onClick={() => handleView(pod)}>
        <Eye className="mr-2 h-4 w-4" />
        Xem
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleYamlEdit(pod)}>
        <FileText className="mr-2 h-4 w-4" />
        YAML
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleViewLogs(pod)}>
        <ScrollText className="mr-2 h-4 w-4" />
        Logs
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleExecShell(pod)}>
        <Terminal className="mr-2 h-4 w-4" />
        Exec Shell
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDelete(pod)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Xóa
      </DropdownMenuItem>
    </>
  );

  const handleCreatePod = async () => {
    try {
      setIsSubmitting(true);
      if (createMode === "yaml") {
        if (!yamlContent.trim()) {
          toast.error("Vui lòng nhập nội dung YAML");
          return;
        }
        await adminAPI.createPodFromYaml(yamlContent);
      } else {
        // Tạo form data từ form inputs
        const formElement = document.querySelector('form') as HTMLFormElement;
        if (!formElement) {
          toast.error("Không tìm thấy form");
          return;
        }
        const formDataObj = new FormData(formElement);
        
        const containers = [];
        for (let i = 0; i < containerCount; i++) {
          const name = formDataObj.get(`container-${i}-name`) as string;
          const image = formDataObj.get(`container-${i}-image`) as string;
          if (!name || !image) continue;

          const portsInput = formDataObj.get(`container-${i}-ports`) as string || "";
          const cpuRequest = formDataObj.get(`container-${i}-cpu-request`) as string || "";
          const memoryRequest = formDataObj.get(`container-${i}-memory-request`) as string || "";
          const cpuLimit = formDataObj.get(`container-${i}-cpu-limit`) as string || "";
          const memoryLimit = formDataObj.get(`container-${i}-memory-limit`) as string || "";

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

          containers.push({
            name,
            image,
            imagePullPolicy: formDataObj.get(`container-${i}-pullPolicy`) as string || "IfNotPresent",
            ports: ports.length > 0 ? ports : undefined,
            resources: Object.keys(resources).length > 0 ? resources : undefined,
          });
        }

        if (containers.length === 0) {
          toast.error("Vui lòng nhập ít nhất một container");
          return;
        }

        const labelsInput = formDataObj.get("labels") as string || "";
        const labels: Record<string, string> = {};
        if (labelsInput) {
          labelsInput.split(",").forEach(pair => {
            const [key, value] = pair.trim().split("=").map(s => s.trim());
            if (key && value) labels[key] = value;
          });
        }

        await adminAPI.createPod({
          name: formDataObj.get("name") as string || `pod-${Date.now()}`,
          namespace: formDataObj.get("namespace") as string || "default",
          containers,
          nodeName: formDataObj.get("nodeName") as string || undefined,
          labels: Object.keys(labels).length > 0 ? labels : undefined,
        });
      }
      toast.success("Tạo pod thành công");
      setCreateDialogOpen(false);
      resetCreateState();
      loadPods();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo pod");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusVariant = (status: string) => {
    if (!status) return "default";
    
    const statusLower = status.toLowerCase();
    
    // Running statuses
    if (statusLower === "running") {
      return "success";
    }
    
    // Success statuses
    if (statusLower === "succeeded" || statusLower === "completed") {
      return "secondary";
    }
    
    // Error/Failed statuses
    if (statusLower === "failed" || 
        statusLower === "error" || 
        statusLower === "crashloopbackoff" ||
        statusLower === "imagepullbackoff" ||
        statusLower === "errimagepull" ||
        statusLower === "createcontainererror" ||
        statusLower === "invalidimage" ||
        statusLower.includes("error") ||
        statusLower.includes("failed")) {
      return "destructive";
    }
    
    // Warning/Pending statuses
    if (statusLower === "pending" || 
        statusLower === "unknown" ||
        statusLower === "terminating" ||
        statusLower === "containercreating" ||
        statusLower.includes("waiting") ||
        statusLower.includes("pending")) {
      return "warning";
    }
    
    // Default for other statuses
    return "default";
  };

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

  const columns = [
    {
      key: "name",
      label: "NAME",
      render: (pod: Pod) => <TruncatedText text={pod.name} maxLength={25} />,
    },
    {
      key: "namespace",
      label: "NAMESPACE",
      render: (pod: Pod) => <TruncatedText text={pod.namespace} maxLength={20} />,
    },
    {
      key: "status",
      label: "STATUS",
      align: "center" as const,
      render: (pod: Pod) => (
        <Badge variant={getStatusVariant(pod.status)} className="capitalize">
          {pod.status}
        </Badge>
      ),
    },
    {
      key: "ready",
      label: "READY",
      align: "center" as const,
      render: (pod: Pod) => (
        <span>
          {pod.ready.ready}/{pod.ready.total}
        </span>
      ),
    },
    {
      key: "restarts",
      label: "RESTARTS",
      align: "center" as const,
    },
    {
      key: "cpu",
      label: "CPU",
      align: "center" as const,
      render: (pod: Pod) => pod.cpu || "0m",
    },
    {
      key: "memory",
      label: "RAM",
      align: "center" as const,
      render: (pod: Pod) => pod.memory || "0",
    },
    {
      key: "age",
      label: "AGE",
      align: "center" as const,
    },
    {
      key: "ip",
      label: "IP",
    },
    {
      key: "node",
      label: "NODE",
      render: (pod: Pod) => <TruncatedText text={pod.node} maxLength={20} />,
    },
  ];

  const namespaceOptions = useMemo(
    () => Array.from(new Set(pods.map((item) => item.namespace))).sort(),
    [pods]
  );

  const filteredPods = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();
    return pods.filter((pod) => {
      const matchSearch =
        !searchValue ||
        pod.name.toLowerCase().includes(searchValue) ||
        pod.node.toLowerCase().includes(searchValue);
      const matchNamespace = namespaceFilter === "all" || pod.namespace === namespaceFilter;
      const matchStatus = statusFilter === "all" || pod.status?.toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchNamespace && matchStatus;
    });
  }, [namespaceFilter, pods, searchTerm, statusFilter]);

  const totalCount = pods.length;
  const filteredCount = filteredPods.length;
  const tableTitle =
    filteredCount === totalCount
      ? `Danh sách Pods (${totalCount})`
      : `Danh sách Pods (${filteredCount}/${totalCount})`;

  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm theo tên pod hoặc node..."
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
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            {/* Dynamic status options from actual pods */}
            {statusOptions.filter(s => 
              s !== "running" && 
              s !== "pending" && 
              s !== "failed" && 
              s !== "succeeded"
            ).map(status => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={() => loadPods(false)}
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
        data={filteredPods}
        loading={loading}
        onAdd={() => {
          resetCreateState();
          setCreateDialogOpen(true);
        }}
        customActions={renderCustomActions}
        hideSearch
        toolbarContent={filterToolbar}
        emptyMessage="Không tìm thấy pod phù hợp"
      />

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            resetCreateState();
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tạo Pod mới</DialogTitle>
            <DialogDescription>
              Tạo pod mới bằng form hoặc YAML manifest.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col flex-grow overflow-hidden">
            <Tabs value={createMode} onValueChange={(value) => setCreateMode(value as "yaml" | "form")} className="flex flex-col flex-grow overflow-hidden">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="form">Form</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
              </TabsList>

              <TabsContent value="yaml" className="flex-1 flex flex-col overflow-hidden mt-4">
                <div className="flex-1 flex flex-col space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Dán nội dung YAML Pod của bạn và hệ thống sẽ áp dụng để tạo pod mới.
                  </div>
                  <Textarea
                    placeholder="apiVersion: v1&#10;kind: Pod&#10;metadata:..."
                    value={yamlContent}
                    onChange={(e) => setYamlContent(e.target.value)}
                    className="flex-1 font-mono text-xs min-h-[400px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Hủy
                    </Button>
                    <Button onClick={handleCreatePod} disabled={isSubmitting}>
                      {isSubmitting ? "Đang tạo..." : "Tạo từ YAML"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="form" className="flex-1 flex flex-col overflow-hidden mt-4">
                <form onSubmit={(e) => { e.preventDefault(); handleCreatePod(); }} className="flex flex-col flex-grow overflow-hidden">
                  <div className="flex-grow overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Tên *</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue=""
                      required
                      placeholder="my-pod"
                    />
                  </div>
                  <div>
                    <Label htmlFor="namespace">Namespace *</Label>
                    <Input
                      id="namespace"
                      name="namespace"
                      defaultValue="default"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="nodeName">Node Name (tùy chọn)</Label>
                  <Input
                    id="nodeName"
                    name="nodeName"
                    defaultValue=""
                    placeholder="node-01"
                  />
                </div>
                <div>
                  <Label htmlFor="labels">Labels (key=value, comma separated)</Label>
                  <Input
                    id="labels"
                    name="labels"
                    defaultValue=""
                    placeholder="app=my-app,env=prod"
                  />
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <Label>Containers</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setContainerCount(containerCount + 1)}
                    >
                      + Thêm Container
                    </Button>
                  </div>
                  {Array.from({ length: containerCount }).map((_, index) => (
                    <div key={index} className="border rounded-lg p-4 mb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base">Container {index + 1}</Label>
                        {containerCount > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setContainerCount(containerCount - 1)}
                          >
                            Xóa
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`container-${index}-name`}>Tên Container *</Label>
                          <Input
                            id={`container-${index}-name`}
                            name={`container-${index}-name`}
                            defaultValue={index === 0 ? "app" : ""}
                            required
                            placeholder="app"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`container-${index}-image`}>Image *</Label>
                          <Input
                            id={`container-${index}-image`}
                            name={`container-${index}-image`}
                            defaultValue={index === 0 ? "nginx:latest" : ""}
                            required
                            placeholder="nginx:latest"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`container-${index}-pullPolicy`}>Image Pull Policy</Label>
                        <input type="hidden" name={`container-${index}-pullPolicy`} defaultValue="IfNotPresent" />
                        <Select defaultValue="IfNotPresent" onValueChange={(value) => {
                          const input = document.querySelector(`input[name="container-${index}-pullPolicy"]`) as HTMLInputElement;
                          if (input) input.value = value;
                        }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IfNotPresent">IfNotPresent</SelectItem>
                            <SelectItem value="Always">Always</SelectItem>
                            <SelectItem value="Never">Never</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`container-${index}-ports`}>Ports (name:port:protocol, comma separated)</Label>
                        <Input
                          id={`container-${index}-ports`}
                          name={`container-${index}-ports`}
                          placeholder="http:80:TCP,https:443:TCP"
                          defaultValue=""
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Format: name:port:protocol hoặc port:protocol hoặc port
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`container-${index}-cpu-request`}>CPU Request</Label>
                          <Input
                            id={`container-${index}-cpu-request`}
                            name={`container-${index}-cpu-request`}
                            placeholder="100m"
                            defaultValue=""
                          />
                        </div>
                        <div>
                          <Label htmlFor={`container-${index}-memory-request`}>Memory Request</Label>
                          <Input
                            id={`container-${index}-memory-request`}
                            name={`container-${index}-memory-request`}
                            placeholder="128Mi"
                            defaultValue=""
                          />
                        </div>
                        <div>
                          <Label htmlFor={`container-${index}-cpu-limit`}>CPU Limit</Label>
                          <Input
                            id={`container-${index}-cpu-limit`}
                            name={`container-${index}-cpu-limit`}
                            placeholder="500m"
                            defaultValue=""
                          />
                        </div>
                        <div>
                          <Label htmlFor={`container-${index}-memory-limit`}>Memory Limit</Label>
                          <Input
                            id={`container-${index}-memory-limit`}
                            name={`container-${index}-memory-limit`}
                            placeholder="512Mi"
                            defaultValue=""
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                    <Button variant="outline" type="button" onClick={() => setCreateDialogOpen(false)}>
                      Hủy
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Đang tạo..." : "Tạo"}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pod Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] min-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chi tiết Pod: {selectedPod?.name}</DialogTitle>
            <DialogDescription>Thông tin chi tiết về pod trong cluster</DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : podDetail ? (
            <Tabs value={activeTab} onValueChange={(value) => {
              setActiveTab(value);
              if (value === "logs" && selectedPod && !podLogs && !loadingLogs) {
                loadPodLogs(selectedPod.id, selectedContainer || undefined);
              }
            }} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="containers">Containers</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="flex-1 overflow-auto space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-md border p-4">
                    <div className="text-xs text-muted-foreground uppercase mb-2">Status</div>
                    <div className="text-sm">
                      <Badge variant={getStatusVariant(podDetail.status)} className="capitalize">
                        {podDetail.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-xs text-muted-foreground uppercase mb-2">Ready</div>
                    <div className="text-sm">
                      <span className="text-2xl font-semibold">
                        {podDetail.ready.ready}/{podDetail.ready.total}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-xs text-muted-foreground uppercase mb-2">CPU</div>
                    <div className="text-sm">
                      <span className="text-2xl font-semibold">{podDetail.cpu || "0m"}</span>
                    </div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-xs text-muted-foreground uppercase mb-2">RAM</div>
                    <div className="text-sm">
                      <span className="text-2xl font-semibold">{podDetail.memory || "0"}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span> <span className="font-medium">{podDetail.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Namespace:</span> <span className="font-medium">{podDetail.namespace}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Node:</span> <span className="font-medium">{podDetail.node || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IP:</span> <span className="font-medium">{podDetail.ip || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Restarts:</span> <span className="font-medium">{podDetail.restarts || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Age:</span> <span className="font-medium">{podDetail.age}</span>
                    </div>
                    {podDetail.nominatedNode && (
                      <div>
                        <span className="text-muted-foreground">Nominated Node:</span> <span className="font-medium">{podDetail.nominatedNode}</span>
                      </div>
                    )}
                    {podDetail.uid && (
                      <div>
                        <span className="text-muted-foreground">UID:</span> <span className="font-medium font-mono text-xs">{podDetail.uid}</span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="containers" className="flex-1 overflow-auto mt-4">
                <div className="space-y-4">
                  {podDetail.containers && podDetail.containers.length > 0 ? (
                    podDetail.containers.map((container, idx) => (
                      <div key={idx} className="rounded-md border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{container.name}</h4>
                          <Badge variant={container.ready ? "success" : "destructive"}>
                            {container.ready ? "Ready" : "Not Ready"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Image:</span> <span className="font-medium">{container.image}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span> <span className="font-medium">{container.status || "-"}</span>
                          </div>
                          {container.restartCount !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Restarts:</span> <span className="font-medium">{container.restartCount}</span>
                            </div>
                          )}
                          {container.startedAt && (
                            <div>
                              <span className="text-muted-foreground">Started:</span> <span className="font-medium">{new Date(container.startedAt).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        {container.resources && (
                          <div className="mt-2 pt-2 border-t">
                            <div className="text-xs text-muted-foreground uppercase mb-2">Resources</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>CPU Request: {container.resources.cpuRequest || "-"}</div>
                              <div>CPU Limit: {container.resources.cpuLimit || "-"}</div>
                              <div>Memory Request: {container.resources.memoryRequest || "-"}</div>
                              <div>Memory Limit: {container.resources.memoryLimit || "-"}</div>
                            </div>
                          </div>
                        )}
                        {container.ports && container.ports.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <div className="text-xs text-muted-foreground uppercase mb-2">Ports</div>
                            <div className="space-y-1">
                              {container.ports.map((port, pIdx) => (
                                <div key={pIdx} className="text-sm">
                                  {port.name && `${port.name}: `}{port.containerPort}/{port.protocol || "TCP"}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">Không có container</div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="logs" className="flex-1 overflow-auto mt-4">
                <div className="space-y-2">
                  {podDetail.containers && podDetail.containers.length > 1 && (
                    <div className="flex gap-2">
                      <Select value={selectedContainer} onValueChange={(value) => {
                        setSelectedContainer(value);
                        if (selectedPod) {
                          loadPodLogs(selectedPod.id, value || undefined);
                        }
                      }}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Chọn container" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Tất cả containers</SelectItem>
                          {podDetail.containers.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={handleRefreshLogs} disabled={loadingLogs}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingLogs ? "animate-spin" : ""}`} />
                        Làm mới
                      </Button>
                    </div>
                  )}
                  {loadingLogs ? (
                    <div className="flex items-center justify-center h-64">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="rounded-md border p-4 bg-black text-green-400 font-mono text-xs overflow-auto max-h-[500px]">
                      <pre className="whitespace-pre-wrap">{podLogs || "Chưa có logs. Nhấn 'Làm mới' để tải logs."}</pre>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="events" className="flex-1 overflow-auto mt-4">
                <div className="space-y-2">
                  {podDetail.events && podDetail.events.length > 0 ? (
                    podDetail.events.map((event, idx) => (
                      <div key={idx} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={event.type === "Warning" ? "destructive" : "default"}>{event.type || "Normal"}</Badge>
                          <span className="text-muted-foreground text-xs">{event.lastTimestamp || event.firstTimestamp || "-"}</span>
                        </div>
                        <div className="font-medium mb-1">{event.reason || "-"}</div>
                        <div className="text-muted-foreground">{event.message || "-"}</div>
                        {event.count && event.count > 1 && (
                          <div className="text-xs text-muted-foreground mt-1">Count: {event.count}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">Không có events</div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="yaml" className="flex-1 overflow-auto mt-4">
                <div className="rounded-md border p-4 bg-muted font-mono text-xs overflow-auto max-h-[600px]">
                  <pre className="whitespace-pre-wrap">{podDetail.yaml || "Không có YAML"}</pre>
                </div>
              </TabsContent>

              <TabsContent value="metadata" className="flex-1 overflow-auto mt-4">
                <div className="space-y-4">
                  <div className="rounded-md border p-4">
                    <h4 className="font-semibold mb-3">Labels</h4>
                    {podDetail.labels && Object.keys(podDetail.labels).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(podDetail.labels).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium">{key}:</span> <span className="text-muted-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">Không có labels</div>
                    )}
                  </div>
                  <div className="rounded-md border p-4">
                    <h4 className="font-semibold mb-3">Annotations</h4>
                    {podDetail.annotations && Object.keys(podDetail.annotations).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(podDetail.annotations).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium">{key}:</span> <span className="text-muted-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">Không có annotations</div>
                    )}
                  </div>
                  <div className="rounded-md border p-4">
                    <h4 className="font-semibold mb-3">Metadata</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">UID:</span> <span className="font-mono">{podDetail.uid || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resource Version:</span> <span className="font-mono">{podDetail.resourceVersion || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Creation Timestamp:</span> <span>{podDetail.creationTimestamp ? new Date(podDetail.creationTimestamp).toLocaleString() : "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="conditions" className="flex-1 overflow-auto mt-4">
                <div className="space-y-2">
                  {podDetail.conditions && podDetail.conditions.length > 0 ? (
                    podDetail.conditions.map((condition, idx) => (
                      <div key={idx} className="rounded-md border p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{condition.type || "-"}</div>
                          <Badge variant={condition.status === "True" ? "success" : "destructive"}>
                            {condition.status || "-"}
                          </Badge>
                        </div>
                        {condition.reason && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Reason:</span> <span className="font-medium">{condition.reason}</span>
                          </div>
                        )}
                        {condition.message && (
                          <div className="text-sm text-muted-foreground">{condition.message}</div>
                        )}
                        {condition.lastTransitionTime && (
                          <div className="text-xs text-muted-foreground">
                            Last Transition: {new Date(condition.lastTransitionTime).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">Không có conditions</div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center text-muted-foreground py-8">Không có dữ liệu</div>
          )}
        </DialogContent>
      </Dialog>

      {/* YAML Edit Dialog */}
      <Dialog open={yamlEditDialogOpen} onOpenChange={setYamlEditDialogOpen}>
        <DialogContent className="w-[75vw] h-[90vh] max-w-[75vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa Pod YAML</DialogTitle>
            <DialogDescription>Chỉnh sửa manifest YAML của pod</DialogDescription>
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

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Logs: {viewingLogsPod?.name}</DialogTitle>
            <DialogDescription>Xem logs của pod</DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex flex-col space-y-2">
            {podDetail?.containers && podDetail.containers.length > 1 && (
              <div className="flex gap-2">
                <Select value={selectedContainer} onValueChange={(value) => {
                  setSelectedContainer(value);
                  if (viewingLogsPod) {
                    loadPodLogs(viewingLogsPod.id, value || undefined);
                  }
                }}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Chọn container" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tất cả containers</SelectItem>
                    {podDetail.containers.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleRefreshLogs} disabled={loadingLogs}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingLogs ? "animate-spin" : ""}`} />
                  Làm mới
                </Button>
              </div>
            )}
            {loadingLogs ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="flex-1 rounded-md border p-4 bg-black text-green-400 font-mono text-xs overflow-auto">
                <pre className="whitespace-pre-wrap">{podLogs || "Không có logs"}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Exec Shell Dialog */}
      <Dialog open={execDialogOpen} onOpenChange={setExecDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Exec Shell: {executingPod?.name}</DialogTitle>
            <DialogDescription>Thực thi command trong container của pod</DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex flex-col space-y-4">
            {podDetail?.containers && podDetail.containers.length > 1 && (
              <div>
                <Label htmlFor="exec-container">Container</Label>
                <Select value={execContainer} onValueChange={setExecContainer}>
                  <SelectTrigger id="exec-container" className="w-full">
                    <SelectValue placeholder="Chọn container" />
                  </SelectTrigger>
                  <SelectContent>
                    {podDetail.containers.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="exec-command">Command</Label>
              <div className="flex gap-2">
                <Input
                  id="exec-command"
                  value={execCommand}
                  onChange={(e) => setExecCommand(e.target.value)}
                  placeholder="Nhập command (ví dụ: ls -la, ps aux, /bin/sh)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !executing) {
                      e.preventDefault();
                      handleExecCommand();
                    }
                  }}
                />
                <Button onClick={handleExecCommand} disabled={executing || !execCommand.trim()}>
                  {executing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Đang thực thi...
                    </>
                  ) : (
                    <>
                      <Terminal className="mr-2 h-4 w-4" />
                      Thực thi
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Nhấn Enter để thực thi command. Ví dụ: ls -la, ps aux, cat /etc/os-release
              </p>
            </div>
            <div className="flex-1 flex flex-col">
              <Label>Output</Label>
              <div className="flex-1 rounded-md border p-4 bg-black text-green-400 font-mono text-xs overflow-auto min-h-[300px]">
                <pre className="whitespace-pre-wrap">
                  {executing ? (
                    <span className="text-yellow-400">Đang thực thi command...</span>
                  ) : execOutput ? (
                    execOutput
                  ) : (
                    <span className="text-muted-foreground">Output sẽ hiển thị ở đây sau khi thực thi command</span>
                  )}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

