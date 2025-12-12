import { useEffect, useMemo, useState } from "react";
import { ResourceTable } from "../../components/ResourceTable";
import { adminAPI } from "@/lib/admin-api";
import type { Deployment, DeploymentDetail } from "@/types/admin";
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
import { RefreshCw, Search, Eye, Trash2, FileText, Copy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
 * Trang quản lý Deployments
 */
export function Deployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"yaml" | "form">("form");
  const [yamlContent, setYamlContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailDeployment, setDetailDeployment] = useState<Deployment | null>(null);
  const [deploymentDetail, setDeploymentDetail] = useState<DeploymentDetail | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());
  const [loadingTabs, setLoadingTabs] = useState<Set<string>>(new Set());
  const [scalingDeployment, setScalingDeployment] = useState<Deployment | null>(null);
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [scaleValue, setScaleValue] = useState(1);
  const [isScaling, setIsScaling] = useState(false);
  const [yamlEditDialogOpen, setYamlEditDialogOpen] = useState(false);
  const [editingYamlDeployment, setEditingYamlDeployment] = useState<Deployment | null>(null);
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
      case "pending":
        return "Pending";
      case "error":
        return "Error";
      default:
        return "Tất cả trạng thái";
    }
  };

  useEffect(() => {
    // Lần đầu vào trang: hiển thị trạng thái loading cho cả bảng
    loadDeployments(true);
  }, []);

  const loadDeployments = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const data = await adminAPI.getDeployments();
      setDeployments(data);
    } catch (error) {
      toast.error("Không thể tải danh sách deployments");
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
        toast.success("Đã làm mới danh sách deployments");
      }
    }
  };

  const clearDialogState = () => {
    setCreateMode("yaml");
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
    setIsDialogOpen(true);
  };

  const handleDelete = async (deployment: Deployment) => {
    if (!confirm(`Bạn có chắc muốn xóa deployment "${deployment.name}"?`)) return;
    try {
      await adminAPI.deleteDeployment(deployment.id);
      toast.success("Xóa deployment thành công");
      loadDeployments();
    } catch (error) {
      toast.error("Không thể xóa deployment");
    }
  };

  const handleView = async (deployment: Deployment) => {
    setDetailDeployment(deployment);
    setIsDetailDialogOpen(true);
    setLoadingDetail(true);
    setDeploymentDetail(null);
    setLoadedTabs(new Set()); // Reset loaded tabs
    setLoadingTabs(new Set());

    try {
      // Load overview data (basic info) first
      const detail = await adminAPI.getDeploymentDetail(deployment.id);
      setDeploymentDetail(detail);
      setLoadedTabs(new Set(["overview", "metadata"])); // Overview và metadata luôn có sẵn
    } catch (error) {
      toast.error("Không thể tải chi tiết deployment");
      setDeploymentDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Load data for specific tab when clicked
  const handleTabChange = async (tabValue: string) => {
    if (!detailDeployment || loadedTabs.has(tabValue)) {
      return; // Already loaded or no deployment selected
    }

    // These tabs don't need additional API calls (data already loaded)
    if (["overview", "metadata"].includes(tabValue)) {
      return;
    }

    // If data is already available in deploymentDetail, mark as loaded
    if (deploymentDetail) {
      if (tabValue === "pods" && deploymentDetail.pods && deploymentDetail.pods.length >= 0) {
        setLoadedTabs(prev => new Set([...prev, tabValue]));
        return;
      }
      if (tabValue === "replicasets" && deploymentDetail.replicaSets && deploymentDetail.replicaSets.length >= 0) {
        setLoadedTabs(prev => new Set([...prev, tabValue]));
        return;
      }
      if (tabValue === "events" && deploymentDetail.events && deploymentDetail.events.length >= 0) {
        setLoadedTabs(prev => new Set([...prev, tabValue]));
        return;
      }
      if (tabValue === "yaml" && deploymentDetail.yaml) {
        setLoadedTabs(prev => new Set([...prev, tabValue]));
        return;
      }
    }

    // For tabs that might need refresh or additional data, reload full detail
    // Note: With current backend API, we still need to load all data at once
    // But we can optimize by only showing loading indicator for that specific tab
    setLoadingTabs(prev => new Set([...prev, tabValue]));
    
    try {
      const detail = await adminAPI.getDeploymentDetail(detailDeployment.id);
      setDeploymentDetail(detail);
      setLoadedTabs(prev => new Set([...prev, tabValue]));
    } catch (error) {
      toast.error(`Không thể tải dữ liệu cho tab ${tabValue}`);
    } finally {
      setLoadingTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(tabValue);
        return newSet;
      });
    }
  };

  const handleScale = (deployment: Deployment) => {
    setScalingDeployment(deployment);
    setScaleValue(deployment.replicas.desired || 1);
    setScaleDialogOpen(true);
  };

  const handleScaleSubmit = async () => {
    if (!scalingDeployment) return;
    try {
      setIsScaling(true);
      await adminAPI.scaleDeployment(scalingDeployment.id, scaleValue);
      toast.success(`Đã scale deployment ${scalingDeployment.name} về ${scaleValue} replicas`);
      setScaleDialogOpen(false);
      setScalingDeployment(null);
      loadDeployments();
    } catch (error) {
      toast.error("Không thể scale deployment");
    } finally {
      setIsScaling(false);
    }
  };

  const handleYamlEdit = async (deployment: Deployment) => {
    setEditingYamlDeployment(deployment);
    setYamlEditDialogOpen(true);
    setYamlEditContent("");
    setLoadingDetail(true);
    try {
      const detail = await adminAPI.getDeploymentDetail(deployment.id);
      setYamlEditContent(detail.yaml || "");
    } catch {
      toast.error("Không thể tải YAML của deployment");
      setYamlEditDialogOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleYamlEditSubmit = async () => {
    if (!editingYamlDeployment || !yamlEditContent.trim()) {
      toast.error("YAML không được để trống");
      return;
    }
    try {
      setIsSavingYaml(true);
      await adminAPI.updateDeploymentFromYaml(editingYamlDeployment.id, yamlEditContent);
      toast.success("Cập nhật deployment từ YAML thành công");
      setYamlEditDialogOpen(false);
      setEditingYamlDeployment(null);
      setYamlEditContent("");
      loadDeployments();
    } catch {
      toast.error("Không thể cập nhật deployment từ YAML");
    } finally {
      setIsSavingYaml(false);
    }
  };

  const renderCustomActions = (deployment: Deployment) => (
    <>
      <DropdownMenuItem onClick={() => handleView(deployment)}>
        <Eye className="mr-2 h-4 w-4" />
        Xem
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleYamlEdit(deployment)}>
        <FileText className="mr-2 h-4 w-4" />
        YAML
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleScale(deployment)}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Scale
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDelete(deployment)}
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
      await adminAPI.createDeploymentFromYaml(yamlContent);
      toast.success("Tạo deployment thành công từ YAML");
      closeDialog();
      loadDeployments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo deployment từ YAML");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const replicas = parseInt(formData.get("replicas") as string) || 1;
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
          // Chỉ có port
          return {
            containerPort: parseInt(parts[0]) || 80,
            protocol: "TCP",
          };
        } else if (parts.length === 2) {
          // port:protocol hoặc name:port
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
          // name:port:protocol
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
      namespace: (formData.get("namespace") as string) || "default",
      replicas,
      containers,
      selector: Object.keys(selector).length > 0 ? selector : undefined,
      labels: Object.keys(labels).length > 0 ? labels : undefined,
    };

    try {
      setIsSubmitting(true);
      await adminAPI.createDeployment(data);
      toast.success("Tạo deployment thành công");
      closeDialog();
      loadDeployments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo deployment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "NAME",
      render: (deployment: Deployment) => (
        <TruncatedText text={deployment.name} maxLength={25} />
      ),
    },
    {
      key: "namespace",
      label: "NAMESPACE",
      render: (deployment: Deployment) => (
        <TruncatedText text={deployment.namespace} maxLength={20} />
      ),
    },
    {
      key: "ready",
      label: "READY",
      align: "center" as const,
      render: (deployment: Deployment) => {
        const { ready, desired } = deployment.replicas;
        let variant: "default" | "secondary" | "destructive" | "outline" = "default";
        let className = "";
        
        if (ready === desired && desired > 0) {
          // Tất cả replicas đã sẵn sàng - màu xanh
          variant = "default";
          className = "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
        } else if (ready === 0 && desired > 0) {
          // Không có replicas nào sẵn sàng - màu đỏ
          variant = "destructive";
        } else if (ready > 0 && ready < desired) {
          // Một số replicas chưa sẵn sàng - màu vàng
          variant = "secondary";
          className = "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
        } else {
          // Trường hợp khác (desired = 0)
          variant = "secondary";
        }
        
        return (
          <Badge variant={variant} className={className}>
            {ready}/{desired}
          </Badge>
        );
      },
    },
    {
      key: "upToDate",
      label: "UP-TO-DATE",
      align: "center" as const,
      render: (deployment: Deployment) => (
        <span className="text-sm">
          {deployment.replicas.updated}
        </span>
      ),
    },
    {
      key: "available",
      label: "AVAILABLE",
      align: "center" as const,
      render: (deployment: Deployment) => (
        <span className="text-sm">
          {deployment.replicas.available}
        </span>
      ),
    },
    {
      key: "age",
      label: "AGE",
      align: "center" as const,
      render: (deployment: Deployment) => (
        <span className="text-sm">{deployment.age || "-"}</span>
      ),
    },
    {
      key: "cpu",
      label: "CPU",
      align: "center" as const,
      render: (deployment: Deployment) => (
        <span className="text-sm font-mono">{deployment.cpu || "0m"}</span>
      ),
    },
    {
      key: "memory",
      label: "RAM",
      align: "center" as const,
      render: (deployment: Deployment) => (
        <span className="text-sm font-mono">{deployment.memory || "0"}</span>
      ),
    },
  ];

  const namespaceOptions = useMemo(
    () => Array.from(new Set(deployments.map((item) => item.namespace))).sort(),
    [deployments]
  );

  const filteredDeployments = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();
    return deployments.filter((deployment) => {
      const matchSearch = !searchValue || deployment.name.toLowerCase().includes(searchValue);
      const matchNamespace = namespaceFilter === "all" || deployment.namespace === namespaceFilter;
      const matchStatus = statusFilter === "all" || deployment.status === statusFilter;
      return matchSearch && matchNamespace && matchStatus;
    });
  }, [deployments, namespaceFilter, searchTerm, statusFilter]);

  const totalCount = deployments.length;
  const filteredCount = filteredDeployments.length;
  const tableTitle =
    filteredCount === totalCount
      ? `Danh sách Deployments (${totalCount})`
      : `Danh sách Deployments (${filteredCount}/${totalCount})`;

  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm deployment..."
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
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={() => loadDeployments(false)}
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
      <div className="grid grid-cols-2 gap-4">
      <div>
          <Label htmlFor="name">Tên *</Label>
        <Input
          id="name"
          name="name"
          defaultValue=""
          required
            placeholder="my-deployment"
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
        <Label htmlFor="replicas">Replicas *</Label>
        <Input
          id="replicas"
          name="replicas"
          type="number"
          min="0"
          defaultValue={1}
          required
        />
      </div>
        <div>
        <Label htmlFor="selector">Selector (key=value, comma separated)</Label>
          <Input
          id="selector"
          name="selector"
          placeholder="app=my-app,version=v1"
          defaultValue=""
          />
        <p className="text-xs text-muted-foreground mt-1">
          Nếu để trống, sẽ tự động tạo selector app={"{name}"}
        </p>
        </div>
        <div>
        <Label htmlFor="labels">Labels (key=value, comma separated)</Label>
          <Input
          id="labels"
          name="labels"
          placeholder="env=prod,team=backend"
          defaultValue=""
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
        <Button
          type="button"
          variant="outline"
          onClick={closeDialog}
          disabled={isSubmitting}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Đang tạo..." : "Tạo"}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <ResourceTable
        title={tableTitle}
        columns={columns}
        data={filteredDeployments}
        loading={loading}
        onAdd={handleAdd}
        customActions={renderCustomActions}
        hideSearch
        toolbarContent={filterToolbar}
        emptyMessage="Không tìm thấy deployment phù hợp"
      />

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
            <DialogTitle>Tạo Deployment mới</DialogTitle>
            <DialogDescription>
              Tạo deployment mới bằng form hoặc YAML manifest.
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
                    Dán YAML Deployment để hệ thống tạo tự động.
                  </div>
                  <Textarea
                    placeholder="apiVersion: apps/v1&#10;kind: Deployment&#10;metadata:..."
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] min-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chi tiết deployment {detailDeployment?.name}</DialogTitle>
            <DialogDescription>
              Thông tin chi tiết về deployment, pods, replicasets, events và YAML manifest.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Đang tải...</div>
            </div>
          ) : deploymentDetail ? (
            <div className="flex-grow overflow-y-auto max-h-[calc(90vh-140px)]">
              <Tabs defaultValue="overview" onValueChange={handleTabChange} className="space-y-4">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="pods" className="flex items-center gap-1">
                    Pods
                    {loadingTabs.has("pods") && <RefreshCw className="h-3 w-3 animate-spin" />}
                  </TabsTrigger>
                  <TabsTrigger value="replicasets" className="flex items-center gap-1">
                    ReplicaSet
                    {loadingTabs.has("replicasets") && <RefreshCw className="h-3 w-3 animate-spin" />}
                  </TabsTrigger>
                  <TabsTrigger value="events" className="flex items-center gap-1">
                    Events
                    {loadingTabs.has("events") && <RefreshCw className="h-3 w-3 animate-spin" />}
                  </TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                  <TabsTrigger value="yaml" className="flex items-center gap-1">
                    YAML
                    {loadingTabs.has("yaml") && <RefreshCw className="h-3 w-3 animate-spin" />}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-2">Status</div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Status: </span>
                          <Badge variant={deploymentDetail.status === "running" ? "success" : deploymentDetail.status === "error" ? "destructive" : "warning"}>
                            {deploymentDetail.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Namespace: </span>
                          {deploymentDetail.namespace}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-2">Replicas</div>
                      <div className="text-sm">
                        <span className="text-2xl font-semibold">
                          {deploymentDetail.replicas.ready}/{deploymentDetail.replicas.desired}
                        </span>
                        <span className="text-muted-foreground ml-2">ready</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Updated: {deploymentDetail.replicas.updated} | Available: {deploymentDetail.replicas.available}
                      </div>
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-2">CPU</div>
                      <div className="text-sm">
                        <span className="text-2xl font-semibold">{deploymentDetail.cpu || "0m"}</span>
                      </div>
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-2">RAM</div>
                      <div className="text-sm">
                        <span className="text-2xl font-semibold">{deploymentDetail.memory || "0"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-xs text-muted-foreground uppercase mb-2">Containers & Images</div>
                    {deploymentDetail.containers && deploymentDetail.containers.length > 0 ? (
                      <div className="space-y-2 text-sm">
                        {deploymentDetail.containers.map((container, idx) => {
                          const image = deploymentDetail.images && deploymentDetail.images[idx] 
                            ? deploymentDetail.images[idx] 
                            : null;
                          return (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="font-medium min-w-[120px]">{container}:</span>
                              {image ? (
                                <span className="text-muted-foreground font-mono text-xs break-all">
                                  {image}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">No image</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">
                        No containers found
                      </div>
                    )}
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-xs text-muted-foreground uppercase mb-2">Metadata</div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name: </span>
                        <code className="text-xs">{deploymentDetail.name}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Age: </span>
                        {deploymentDetail.age || "-"}
                      </div>
                      {deploymentDetail.uid && (
                        <div>
                          <span className="text-muted-foreground">UID: </span>
                          <code className="text-xs">{deploymentDetail.uid}</code>
                        </div>
                      )}
                      {deploymentDetail.resourceVersion && (
                        <div>
                          <span className="text-muted-foreground">Resource Version: </span>
                          <code className="text-xs">{deploymentDetail.resourceVersion}</code>
                        </div>
                      )}
                      {deploymentDetail.creationTimestamp && (
                        <div>
                          <span className="text-muted-foreground">Created: </span>
                          {new Date(deploymentDetail.creationTimestamp).toLocaleString()}
                        </div>
                      )}
                      {deploymentDetail.selector && (
                        <div>
                          <span className="text-muted-foreground">Selector: </span>
                          <code className="text-xs">{deploymentDetail.selector}</code>
                        </div>
                      )}
                    </div>
                  </div>
                  {deploymentDetail.conditions && deploymentDetail.conditions.length > 0 && (
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-2">Conditions</div>
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">Status</th>
                              <th className="px-4 py-2 text-left">Reason</th>
                              <th className="px-4 py-2 text-left">Message</th>
                              <th className="px-4 py-2 text-left">Last Transition</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deploymentDetail.conditions.map((condition: any, index: number) => (
                              <tr key={index} className="border-t">
                                <td className="px-4 py-2 font-medium">{condition.type || "-"}</td>
                                <td className="px-4 py-2">
                                  <Badge variant={condition.status === "True" ? "success" : "destructive"}>
                                    {condition.status || "-"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2">{condition.reason || "-"}</td>
                                <td className="px-4 py-2">{condition.message || "-"}</td>
                                <td className="px-4 py-2 text-muted-foreground text-xs">
                                  {condition.lastTransitionTime
                                    ? new Date(condition.lastTransitionTime).toLocaleString()
                                    : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pods" className="space-y-4">
                  {loadingTabs.has("pods") ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-muted-foreground">Đang tải pods...</span>
                    </div>
                  ) : deploymentDetail.pods && deploymentDetail.pods.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-4 py-2 text-left">Tên</th>
                              <th className="px-4 py-2 text-left">Ready</th>
                              <th className="px-4 py-2 text-left">Status</th>
                              <th className="px-4 py-2 text-left">Restarts</th>
                              <th className="px-4 py-2 text-left">IP</th>
                              <th className="px-4 py-2 text-left">Node</th>
                              <th className="px-4 py-2 text-left">Age</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deploymentDetail.pods.map((pod) => (
                              <tr key={pod.name} className="border-t">
                                <td className="px-4 py-2 font-medium">{pod.name}</td>
                                <td className="px-4 py-2">{pod.ready || "-"}</td>
                                <td className="px-4 py-2">
                                  <Badge variant={pod.status === "Running" ? "success" : pod.status === "Pending" ? "warning" : "destructive"} className="capitalize">
                                    {pod.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2">{pod.restarts ?? 0}</td>
                                <td className="px-4 py-2">{pod.ip || "-"}</td>
                                <td className="px-4 py-2">{pod.node || "-"}</td>
                                <td className="px-4 py-2">{pod.age || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                      Không có pods
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="replicasets" className="space-y-4">
                  {loadingTabs.has("replicasets") ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-muted-foreground">Đang tải replicasets...</span>
                    </div>
                  ) : deploymentDetail.replicaSets && deploymentDetail.replicaSets.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-4 py-2 text-left">Tên</th>
                              <th className="px-4 py-2 text-left">Replicas</th>
                              <th className="px-4 py-2 text-left">Ready</th>
                              <th className="px-4 py-2 text-left">Image</th>
                              <th className="px-4 py-2 text-left">Age</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deploymentDetail.replicaSets.map((rs) => (
                              <tr key={rs.name} className="border-t">
                                <td className="px-4 py-2 font-medium">{rs.name}</td>
                                <td className="px-4 py-2">{rs.replicas}</td>
                                <td className="px-4 py-2">{rs.readyReplicas}</td>
                                <td className="px-4 py-2">
                                  <TruncatedText text={rs.image || "-"} maxLength={40} />
                                </td>
                                <td className="px-4 py-2">{rs.age || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                      Không có replicasets
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="events" className="space-y-4">
                  {loadingTabs.has("events") ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-muted-foreground">Đang tải events...</span>
                    </div>
                  ) : deploymentDetail.events && deploymentDetail.events.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">Reason</th>
                              <th className="px-4 py-2 text-left">Message</th>
                              <th className="px-4 py-2 text-left">Count</th>
                              <th className="px-4 py-2 text-left">First Seen</th>
                              <th className="px-4 py-2 text-left">Last Seen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deploymentDetail.events.map((event, index) => (
                              <tr key={index} className="border-t">
                                <td className="px-4 py-2">
                                  <Badge variant={event.type === "Warning" ? "destructive" : "secondary"}>
                                    {event.type || "Normal"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2">{event.reason || "-"}</td>
                                <td className="px-4 py-2">{event.message || "-"}</td>
                                <td className="px-4 py-2">{event.count || 1}</td>
                                <td className="px-4 py-2 text-muted-foreground text-xs">
                                  {event.firstTimestamp
                                    ? new Date(event.firstTimestamp).toLocaleString()
                                    : "-"}
                                </td>
                                <td className="px-4 py-2 text-muted-foreground text-xs">
                                  {event.lastTimestamp
                                    ? new Date(event.lastTimestamp).toLocaleString()
                                    : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                      Không có events
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="metadata" className="space-y-6">
                  <div>
                    <div className="text-sm font-semibold mb-3">Labels</div>
                    {deploymentDetail.labels && Object.keys(deploymentDetail.labels).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(deploymentDetail.labels).map(([key, value]) => (
                          <Badge key={key} variant="secondary">
                            {key}: {String(value)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                        Không có labels
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-3">Annotations</div>
                    {deploymentDetail.annotations && Object.keys(deploymentDetail.annotations).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(deploymentDetail.annotations).map(([key, value]) => (
                          <div key={key} className="rounded-md border p-3">
                            <div className="text-xs text-muted-foreground uppercase mb-1">{key}</div>
                            <div className="text-sm font-mono break-all">{String(value)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                        Không có annotations
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="yaml">
                  {loadingTabs.has("yaml") ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-muted-foreground">Đang tải YAML...</span>
                    </div>
                  ) : (
                    <div className="rounded-md border bg-muted/40 p-4">
                      <pre className="max-h-96 overflow-auto text-xs">
                        {deploymentDetail.yaml || "Chưa có YAML"}
                      </pre>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Không có dữ liệu</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={scaleDialogOpen} onOpenChange={(open) => {
        setScaleDialogOpen(open);
        if (!open) {
          setScalingDeployment(null);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scale Deployment</DialogTitle>
            <DialogDescription>
              Đặt lại số lượng replicas cho deployment {scalingDeployment?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="scale-replicas">Replicas</Label>
            <Input
              id="scale-replicas"
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
                  setScalingDeployment(null);
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
            <DialogTitle>Chỉnh sửa YAML: {editingYamlDeployment?.name}</DialogTitle>
            <DialogDescription>Chỉnh sửa manifest Deployment trực tiếp</DialogDescription>
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

