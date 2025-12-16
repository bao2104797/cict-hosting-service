import { useEffect, useMemo, useState } from "react";
import { ResourceTable } from "../../components/ResourceTable";
import { Badge } from "@/components/ui/badge";
import { adminAPI } from "@/lib/admin-api";
import type { Service, ServiceDetail } from "@/types/admin";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { RefreshCw, Search, Eye, Trash2, FileText } from "lucide-react";
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
 * Trang quản lý Services
 */
export function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"yaml" | "form">("form");
  const [yamlContent, setYamlContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailService, setDetailService] = useState<Service | null>(null);
  const [serviceDetail, setServiceDetail] = useState<ServiceDetail | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [yamlEditDialogOpen, setYamlEditDialogOpen] = useState(false);
  const [editingYamlService, setEditingYamlService] = useState<Service | null>(null);
  const [yamlEditContent, setYamlEditContent] = useState("");
  const [isSavingYaml, setIsSavingYaml] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formType, setFormType] = useState<Service["type"]>("ClusterIP");
  const [formProtocol, setFormProtocol] = useState<string>("TCP");
  const [portCount, setPortCount] = useState(1);

  const getNamespaceLabel = (value: string) => {
    if (value === "all") return "Tất cả namespace";
    return value;
  };

  const getTypeLabel = (value: string) => {
    if (value === "all") return "Tất cả loại";
    return value;
  };

  useEffect(() => {
    // Lần đầu vào trang: hiển thị loading cho cả bảng
    loadServices(true);
  }, []);

  const loadServices = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const data = await adminAPI.getServices();
      setServices(data);
    } catch (error) {
      toast.error("Không thể tải danh sách services");
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
        toast.success("Đã làm mới danh sách services");
      }
    }
  };

  const clearDialogState = () => {
    setCreateMode("yaml");
    setYamlContent("");
    setIsSubmitting(false);
    setPortCount(1);
    setFormType("ClusterIP");
    setFormProtocol("TCP");
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

  const handleDelete = async (service: Service) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa service "${service.name}"?`)) return;
    try {
      await adminAPI.deleteService(service.id);
      toast.success("Xóa service thành công");
      loadServices();
    } catch (error) {
      toast.error("Không thể xóa service");
    }
  };

  const handleView = async (service: Service) => {
    setDetailService(service);
    setIsDetailDialogOpen(true);
    setLoadingDetail(true);
    setServiceDetail(null);

    try {
      // Use explicit namespace and name instead of parsing from ID to avoid issues with special characters
      const detail = await adminAPI.getServiceDetail(service.id, service.namespace, service.name);
      setServiceDetail(detail);
    } catch (error: any) {
      const errorMessage = error.message || "Không thể tải chi tiết service";
      toast.error(errorMessage);
      console.error("Error loading service detail:", {
        serviceId: service.id,
        serviceName: service.name,
        namespace: service.namespace,
        error,
      });
    } finally {
      setLoadingDetail(false);
    }
  };


  const handleYamlEdit = async (service: Service) => {
    setEditingYamlService(service);
    setYamlEditDialogOpen(true);
    setYamlEditContent("");
    setLoadingDetail(true);
    try {
      // Use explicit namespace and name to avoid parsing issues with special characters
      const detail = await adminAPI.getServiceDetail(service.id, service.namespace, service.name);
      setYamlEditContent(detail.yaml || "");
    } catch {
      toast.error("Không thể tải YAML của service");
      setYamlEditDialogOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleYamlEditSubmit = async () => {
    if (!editingYamlService || !yamlEditContent.trim()) {
      toast.error("YAML không được để trống");
      return;
    }
    try {
      setIsSavingYaml(true);
      await adminAPI.updateServiceFromYaml(editingYamlService.id, yamlEditContent);
      toast.success("Cập nhật service từ YAML thành công");
      setYamlEditDialogOpen(false);
      setEditingYamlService(null);
      setYamlEditContent("");
      loadServices();
    } catch {
      toast.error("Không thể cập nhật service từ YAML");
    } finally {
      setIsSavingYaml(false);
    }
  };

  const renderCustomActions = (service: Service) => (
    <>
      <DropdownMenuItem onClick={() => handleView(service)}>
        <Eye className="mr-2 h-4 w-4" />
        Xem
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleYamlEdit(service)}>
        <FileText className="mr-2 h-4 w-4" />
        YAML
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDelete(service)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Xóa
      </DropdownMenuItem>
    </>
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const selectorInput = (formData.get("selector") as string) || "";
    const labelsInput = (formData.get("labels") as string) || "";
    const externalIPsInput = (formData.get("externalIPs") as string) || "";

    // Parse ports
    const ports = [];
    for (let i = 0; i < portCount; i++) {
      const port = formData.get(`port-${i}-port`) as string;
      const targetPort = formData.get(`port-${i}-targetPort`) as string;
      const name = formData.get(`port-${i}-name`) as string;
      const protocolInput = document.querySelector(`input[name="port-${i}-protocol"]`) as HTMLInputElement;
      const protocol = (protocolInput?.value || formData.get(`port-${i}-protocol`) as string || "TCP");
      
      if (port && targetPort) {
        ports.push({
          name: name || undefined,
          port: parseInt(port) || 80,
          targetPort: parseInt(targetPort) || 8080,
          protocol: protocol || "TCP",
        });
      }
    }

    if (ports.length === 0) {
      toast.error("Vui lòng nhập ít nhất một port");
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

    // Parse externalIPs
    const externalIPs = externalIPsInput ? externalIPsInput.split(",").map(ip => ip.trim()).filter(Boolean) : [];

    const typeValue = (formData.get("type") as Service["type"]) || "ClusterIP";
    const data = {
      name: formData.get("name") as string,
      namespace: formData.get("namespace") as string,
      type: typeValue,
      clusterIP: formData.get("clusterIP") as string || undefined,
      externalIPs: externalIPs.length > 0 ? externalIPs : undefined,
      ports,
      selector: Object.keys(selector).length > 0 ? selector : undefined,
      labels: Object.keys(labels).length > 0 ? labels : undefined,
    };

    try {
      setIsSubmitting(true);
      await adminAPI.createService(data);
      toast.success("Tạo service thành công");
      closeDialog();
      loadServices();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo service");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleYamlCreate = async () => {
    if (!yamlContent.trim()) {
      toast.error("Vui lòng nhập YAML");
      return;
    }
    try {
      setIsSubmitting(true);
      await adminAPI.createServiceFromYaml(yamlContent);
      toast.success("Tạo service từ YAML thành công");
      closeDialog();
      loadServices();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tạo service từ YAML");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Tên",
      render: (service: Service) => <TruncatedText text={service.name} maxLength={25} />,
    },
    {
      key: "namespace",
      label: "Namespace",
      render: (service: Service) => <TruncatedText text={service.namespace} maxLength={20} />,
    },
    {
      key: "type",
      label: "Type",
      align: "center" as const,
      render: (service: Service) => (
        <Badge variant="secondary">{service.type}</Badge>
      ),
    },
    {
      key: "clusterIP",
      label: "Cluster IP",
      align: "center" as const,
      render: (service: Service) => <span className="font-mono text-sm">{service.clusterIP}</span>,
    },
    {
      key: "externalIP",
      label: "External IP",
      align: "center" as const,
      render: (service: Service) => (
        <TruncatedText text={service.externalIP || "-"} maxLength={20} />
      ),
    },
    {
      key: "ports",
      label: "Ports",
      render: (service: Service) => (
        <div className="text-sm space-y-1">
          {service.ports.map((p, i) => (
            <div key={i} className="font-mono">
              {p.port}:{p.targetPort}/{p.protocol}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "selector",
      label: "Selectors",
      render: (service: Service) =>
        service.selector && Object.keys(service.selector).length > 0 ? (
          <TruncatedText
            text={Object.entries(service.selector)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}
            maxLength={30}
          />
        ) : (
          "-"
        ),
    },
    {
      key: "age",
      label: "Age",
      align: "center" as const,
    },
  ];

  const namespaceOptions = useMemo(
    () => Array.from(new Set(services.map((service) => service.namespace))).sort(),
    [services]
  );

  const filteredServices = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();
    return services.filter((service) => {
      const matchSearch =
        !searchValue ||
        service.name.toLowerCase().includes(searchValue) ||
        service.namespace.toLowerCase().includes(searchValue);
      const matchNamespace = namespaceFilter === "all" || service.namespace === namespaceFilter;
      const matchType = typeFilter === "all" || service.type === typeFilter;
      return matchSearch && matchNamespace && matchType;
    });
  }, [namespaceFilter, searchTerm, services, typeFilter]);

  const totalCount = services.length;
  const filteredCount = filteredServices.length;
  const tableTitle =
    filteredCount === totalCount
      ? `Danh sách Services (${totalCount})`
      : `Danh sách Services (${filteredCount}/${totalCount})`;

  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm service..."
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue>{getTypeLabel(typeFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            <SelectItem value="ClusterIP">ClusterIP</SelectItem>
            <SelectItem value="NodePort">NodePort</SelectItem>
            <SelectItem value="LoadBalancer">LoadBalancer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={() => loadServices(false)}
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
          <Input id="name" name="name" defaultValue="" required placeholder="my-service" />
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
        <Label htmlFor="type">Type *</Label>
        <input type="hidden" name="type" value={formType} />
        <Select value={formType} onValueChange={(value) => setFormType(value as Service["type"])}>
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ClusterIP">ClusterIP</SelectItem>
            <SelectItem value="NodePort">NodePort</SelectItem>
            <SelectItem value="LoadBalancer">LoadBalancer</SelectItem>
            <SelectItem value="ExternalName">ExternalName</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="clusterIP">Cluster IP (tùy chọn)</Label>
        <Input
          id="clusterIP"
          name="clusterIP"
          placeholder="10.96.0.1"
          defaultValue=""
        />
        <p className="text-xs text-muted-foreground mt-1">
          Để trống để tự động gán
        </p>
      </div>
      <div>
        <Label htmlFor="externalIPs">External IPs (comma separated, tùy chọn)</Label>
        <Input
          id="externalIPs"
          name="externalIPs"
          placeholder="192.168.1.100, 192.168.1.101"
          defaultValue=""
        />
      </div>
      <div>
        <Label htmlFor="selector">Selector (key=value, comma separated)</Label>
        <Input
          id="selector"
          name="selector"
          placeholder="app=my-app,tier=backend"
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
          <Label>Ports</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPortCount(portCount + 1)}
          >
            + Thêm Port
          </Button>
        </div>
        {Array.from({ length: portCount }).map((_, index) => (
          <div key={index} className="border rounded-lg p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Port {index + 1}</Label>
              {portCount > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPortCount(portCount - 1)}
                >
                  Xóa
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`port-${index}-name`}>Name (tùy chọn)</Label>
                <Input
                  id={`port-${index}-name`}
                  name={`port-${index}-name`}
                  placeholder="http"
                  defaultValue=""
                />
              </div>
              <div>
                <Label htmlFor={`port-${index}-protocol`}>Protocol</Label>
                <input type="hidden" name={`port-${index}-protocol`} defaultValue="TCP" />
                <Select defaultValue="TCP" onValueChange={(value) => {
                  const input = document.querySelector(`input[name="port-${index}-protocol"]`) as HTMLInputElement;
                  if (input) input.value = value;
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TCP">TCP</SelectItem>
                    <SelectItem value="UDP">UDP</SelectItem>
                    <SelectItem value="SCTP">SCTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`port-${index}-port`}>Port *</Label>
                <Input
                  id={`port-${index}-port`}
                  name={`port-${index}-port`}
                  type="number"
                  defaultValue={index === 0 ? "80" : ""}
                  required
                  placeholder="80"
                />
              </div>
              <div>
                <Label htmlFor={`port-${index}-targetPort`}>Target Port *</Label>
                <Input
                  id={`port-${index}-targetPort`}
                  name={`port-${index}-targetPort`}
                  type="number"
                  defaultValue={index === 0 ? "8080" : ""}
                  required
                  placeholder="8080"
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
        data={filteredServices}
        loading={loading}
        onAdd={handleAdd}
        customActions={renderCustomActions}
        hideSearch
        toolbarContent={filterToolbar}
        emptyMessage="Không tìm thấy service phù hợp"
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
            <DialogTitle>Tạo Service mới</DialogTitle>
            <DialogDescription>
              Tạo service mới bằng form hoặc YAML manifest.
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
                    Dán YAML Service để hệ thống tạo tự động.
                  </div>
                  <Textarea
                    placeholder="apiVersion: v1&#10;kind: Service&#10;metadata:..."
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

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] min-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chi tiết Service: {detailService?.name}</DialogTitle>
            <DialogDescription>Thông tin chi tiết của service</DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : serviceDetail ? (
            <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-auto mt-4">
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Tên</Label>
                      <p className="font-medium">{serviceDetail.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Namespace</Label>
                      <p>{serviceDetail.namespace}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <Badge variant="secondary">{serviceDetail.type}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Cluster IP</Label>
                      <p className="font-mono text-sm">{serviceDetail.clusterIP}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">External IP</Label>
                      <p>{serviceDetail.externalIP || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Age</Label>
                      <p>{serviceDetail.age}</p>
                    </div>
                  </div>
                  {serviceDetail.ports && serviceDetail.ports.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Ports</Label>
                      <div className="mt-2 space-y-2">
                        {serviceDetail.ports.map((port, idx) => (
                          <div key={idx} className="border rounded p-2 text-sm font-mono">
                            {port.port}:{port.targetPort}/{port.protocol}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {serviceDetail.selector && Object.keys(serviceDetail.selector).length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Selectors</Label>
                      <div className="mt-2 space-y-1">
                        {Object.entries(serviceDetail.selector).map(([key, value]) => (
                          <p key={key} className="text-sm">
                            <span className="font-medium">{key}:</span> {value}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="endpoints" className="space-y-4">
                  {serviceDetail.endpoints && serviceDetail.endpoints.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>IP</TableHead>
                          <TableHead>Ports</TableHead>
                          <TableHead>Target Kind</TableHead>
                          <TableHead>Target Name</TableHead>
                          <TableHead>Target Namespace</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceDetail.endpoints.map((endpoint, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{endpoint.ip || "-"}</TableCell>
                            <TableCell>
                              {endpoint.ports && endpoint.ports.length > 0
                                ? endpoint.ports.join(", ")
                                : "-"}
                            </TableCell>
                            <TableCell>{endpoint.targetRefKind || "-"}</TableCell>
                            <TableCell>{endpoint.targetRefName || "-"}</TableCell>
                            <TableCell>{endpoint.targetRefNamespace || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground">Không có endpoints</p>
                  )}
                </TabsContent>
                <TabsContent value="events" className="space-y-4">
                  {serviceDetail.events && serviceDetail.events.length > 0 ? (
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
                        {serviceDetail.events.map((event, idx) => (
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
                    value={serviceDetail.yaml || ""}
                    readOnly
                    className="font-mono text-xs min-h-[400px]"
                  />
                </TabsContent>
                <TabsContent value="metadata" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">UID</Label>
                      <p className="font-mono text-sm">{serviceDetail.uid || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Resource Version</Label>
                      <p className="font-mono text-sm">{serviceDetail.resourceVersion || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Creation Timestamp</Label>
                      <p>{serviceDetail.creationTimestamp || "-"}</p>
                    </div>
                    {serviceDetail.labels && Object.keys(serviceDetail.labels).length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Labels</Label>
                        <div className="mt-2 space-y-1">
                          {Object.entries(serviceDetail.labels).map(([key, value]) => (
                            <p key={key} className="text-sm">
                              <span className="font-medium">{key}:</span> {value}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {serviceDetail.annotations && Object.keys(serviceDetail.annotations).length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Annotations</Label>
                        <div className="mt-2 space-y-1">
                          {Object.entries(serviceDetail.annotations).map(([key, value]) => (
                            <p key={key} className="text-sm">
                              <span className="font-medium">{key}:</span> {value}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="status" className="space-y-4">
                  {serviceDetail.status && (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">Endpoint Count</Label>
                        <p>{serviceDetail.status.endpointCount || 0}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Load Balancer Status</Label>
                        <p>{serviceDetail.status.loadBalancerStatus || "-"}</p>
                      </div>
                    </div>
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
            <DialogTitle>Chỉnh sửa YAML: {editingYamlService?.name}</DialogTitle>
            <DialogDescription>Chỉnh sửa manifest Service trực tiếp</DialogDescription>
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
