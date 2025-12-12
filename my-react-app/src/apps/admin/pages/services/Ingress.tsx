import { useEffect, useMemo, useState } from "react";
import { ResourceTable } from "../../components/ResourceTable";
import { adminAPI } from "@/lib/admin-api";
import type { Ingress } from "@/types/admin";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { RefreshCw, Search, FileText, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Trang quản lý Ingress
 */
export function IngressList() {
  const [ingress, setIngress] = useState<Ingress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIngress, setEditingIngress] = useState<Ingress | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailIngress, setDetailIngress] = useState<Ingress | null>(null);
  const [ingressDetail, setIngressDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [yamlEditDialogOpen, setYamlEditDialogOpen] = useState(false);
  const [editingYamlIngress, setEditingYamlIngress] = useState<Ingress | null>(null);
  const [yamlEditContent, setYamlEditContent] = useState("");
  const [isSavingYaml, setIsSavingYaml] = useState(false);
  const [loadingYamlDetail, setLoadingYamlDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");

  useEffect(() => {
    // Lần đầu vào trang: hiển thị loading cho cả bảng
    loadIngress(true);
  }, []);

  const loadIngress = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const data = await adminAPI.getIngress();
      setIngress(data);
    } catch (error) {
      toast.error("Không thể tải danh sách ingress");
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
        toast.success("Đã làm mới danh sách ingress");
      }
    }
  };

  const handleAdd = () => {
    setEditingIngress(null);
    setIsDialogOpen(true);
  };

  const handleView = async (ing: Ingress) => {
    setDetailIngress(ing);
    setDetailDialogOpen(true);
    setLoadingDetail(true);
    setIngressDetail(null);
    try {
      const detail = await adminAPI.getIngressDetail(ing.id);
      setIngressDetail(detail);
    } catch {
      toast.error("Không thể tải chi tiết ingress");
      setIngressDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleEdit = (ing: Ingress) => {
    setEditingIngress(ing);
    setIsDialogOpen(true);
  };

  const handleDelete = async (ing: Ingress) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa ingress "${ing.name}"?`)) return;
    try {
      await adminAPI.deleteIngress(ing.id);
      toast.success("Xóa ingress thành công");
      loadIngress();
    } catch (error) {
      toast.error("Không thể xóa ingress");
    }
  };

  const handleYamlEdit = async (ing: Ingress) => {
    setEditingYamlIngress(ing);
    setYamlEditDialogOpen(true);
    setYamlEditContent("");
    setLoadingYamlDetail(true);
    try {
      const detail = await adminAPI.getIngressDetail(ing.id);
      setYamlEditContent(detail.yaml || "");
    } catch {
      toast.error("Không thể tải YAML của ingress");
      setYamlEditDialogOpen(false);
    } finally {
      setLoadingYamlDetail(false);
    }
  };

  const handleYamlEditSubmit = async () => {
    if (!editingYamlIngress || !yamlEditContent.trim()) {
      toast.error("YAML không được để trống");
      return;
    }
    try {
      setIsSavingYaml(true);
      await adminAPI.updateIngressFromYaml(editingYamlIngress.id, yamlEditContent);
      toast.success("Cập nhật ingress từ YAML thành công");
      setYamlEditDialogOpen(false);
      setEditingYamlIngress(null);
      setYamlEditContent("");
      loadIngress();
    } catch {
      toast.error("Không thể cập nhật ingress từ YAML");
    } finally {
      setIsSavingYaml(false);
    }
  };

  const renderCustomActions = (ing: Ingress) => (
    <>
      <DropdownMenuItem onClick={() => handleView(ing)}>
        <Eye className="mr-2 h-4 w-4" />
        Xem
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleYamlEdit(ing)}>
        <FileText className="mr-2 h-4 w-4" />
        YAML
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDelete(ing)}
        className="text-destructive focus:text-destructive"
      >
        Xóa
      </DropdownMenuItem>
    </>
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const hosts = (formData.get("hosts") as string)
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    const portsInput = (formData.get("ports") as string) || "80,443";
    const ports = portsInput
      .split(",")
      .map((p) => parseInt(p.trim(), 10))
      .filter((p) => !Number.isNaN(p));
    const data = {
      name: formData.get("name") as string,
      namespace: formData.get("namespace") as string,
      ingressClass: (formData.get("ingressClass") as string) || "nginx",
      hosts,
      address: formData.get("address") as string,
      ports: ports.length > 0 ? ports : [80, 443],
    };

    try {
      if (editingIngress) {
        await adminAPI.updateIngress(editingIngress.id, data);
        toast.success("Cập nhật ingress thành công");
      } else {
        await adminAPI.createIngress(data);
        toast.success("Tạo ingress thành công");
      }
      setIsDialogOpen(false);
      setEditingIngress(null);
      loadIngress();
    } catch (error) {
      toast.error("Không thể lưu ingress");
    }
  };

  const columns = [
    {
      key: "name",
      label: "NAME",
    },
    {
      key: "ingressClass",
      label: "CLASS",
      render: (ing: Ingress) => ing.ingressClass || "-",
    },
    {
      key: "hosts",
      label: "HOSTS",
      render: (ing: Ingress) => (
        <div className="text-sm">
          {ing.hosts.map((host, i) => (
            <span key={i} className="mr-2">
              {host}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "address",
      label: "ADDRESS",
      render: (ing: Ingress) => ing.address || "-",
    },
    {
      key: "ports",
      label: "PORTS",
      render: (ing: Ingress) => ing.ports.join(", "),
    },
    {
      key: "age",
      label: "AGE",
    },
  ];

  const namespaceOptions = useMemo(
    () => Array.from(new Set(ingress.map((item) => item.namespace))).sort(),
    [ingress]
  );

  const filteredIngress = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();
    return ingress.filter((item) => {
      const matchSearch =
        !searchValue ||
        item.name.toLowerCase().includes(searchValue) ||
        item.hosts.some((host) => host.toLowerCase().includes(searchValue));
      const matchNamespace = namespaceFilter === "all" || item.namespace === namespaceFilter;
      return matchSearch && matchNamespace;
    });
  }, [ingress, namespaceFilter, searchTerm]);

  const totalCount = ingress.length;
  const filteredCount = filteredIngress.length;
  const tableTitle =
    filteredCount === totalCount
      ? `Danh sách Ingress (${totalCount})`
      : `Danh sách Ingress (${filteredCount}/${totalCount})`;

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
          placeholder="Tìm kiếm theo tên hoặc host..."
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
          onClick={() => loadIngress(false)}
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
        data={filteredIngress}
        loading={loading}
        onAdd={handleAdd}
        customActions={renderCustomActions}
        hideSearch
        toolbarContent={filterToolbar}
        emptyMessage="Không tìm thấy ingress phù hợp"
      />

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingIngress(null);
        }}
      >
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingIngress ? "Sửa Ingress" : "Tạo Ingress mới"}</DialogTitle>
            <DialogDescription>
              Tạo ingress mới để quản lý routing và load balancing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
            <div className="flex-grow overflow-y-auto space-y-4">
            <div>
              <Label htmlFor="name">Tên</Label>
              <Input id="name" name="name" defaultValue={editingIngress?.name} required />
            </div>
            <div>
              <Label htmlFor="namespace">Namespace</Label>
              <Input
                id="namespace"
                name="namespace"
                defaultValue={editingIngress?.namespace ?? "default"}
                required
              />
            </div>
            <div>
              <Label htmlFor="ingressClass">Ingress Class</Label>
              <Input
                id="ingressClass"
                name="ingressClass"
                placeholder="nginx"
                defaultValue={editingIngress?.ingressClass ?? "nginx"}
              />
            </div>
            <div>
              <Label htmlFor="hosts">Hosts (phân cách bằng dấu phẩy)</Label>
              <Input
                id="hosts"
                name="hosts"
                placeholder="example.com, www.example.com"
                defaultValue={editingIngress?.hosts.join(", ")}
                required
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="192.168.1.100"
                defaultValue={editingIngress?.address ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="ports">Ports (phân cách bằng dấu phẩy)</Label>
              <Input
                id="ports"
                name="ports"
                placeholder="80,443"
                defaultValue={editingIngress?.ports.join(", ") ?? "80,443"}
              />
            </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingIngress(null);
                }}
              >
                Hủy
              </Button>
              <Button type="submit">{editingIngress ? "Lưu" : "Tạo"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] min-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chi tiết Ingress: {detailIngress?.name}</DialogTitle>
            <DialogDescription>Thông tin chi tiết của ingress</DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : ingressDetail ? (
            <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="rules">Rules</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-auto mt-4">
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Tên</Label>
                      <p className="font-medium">{ingressDetail.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Namespace</Label>
                      <p>{ingressDetail.namespace}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Ingress Class</Label>
                      <p>{ingressDetail.ingressClass || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Address</Label>
                      <p>{ingressDetail.address || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Age</Label>
                      <p>{ingressDetail.age || "-"}</p>
                    </div>
                  </div>
                  {ingressDetail.hosts && ingressDetail.hosts.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Hosts</Label>
                      <div className="mt-2 space-y-1">
                        {ingressDetail.hosts.map((host: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="mr-2">
                            {host}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {ingressDetail.ports && ingressDetail.ports.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Ports</Label>
                      <div className="mt-2 space-y-1">
                        {ingressDetail.ports.map((port: number, idx: number) => (
                          <Badge key={idx} variant="outline" className="mr-2">
                            {port}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="rules" className="space-y-4">
                  {ingressDetail.rules && ingressDetail.rules.length > 0 ? (
                    <div className="space-y-4">
                      {ingressDetail.rules.map((rule: any, idx: number) => (
                        <div key={idx} className="border rounded p-4">
                          <div className="font-medium mb-2">Host: {rule.host || "-"}</div>
                          {rule.http && rule.http.paths && rule.http.paths.length > 0 && (
                            <div className="space-y-2">
                              {rule.http.paths.map((path: any, pathIdx: number) => (
                                <div key={pathIdx} className="text-sm pl-4 border-l-2">
                                  <div>Path: {path.path || "/"}</div>
                                  <div>PathType: {path.pathType || "-"}</div>
                                  {path.backend && (
                                    <div>
                                      Service: {path.backend.service?.name || "-"}:
                                      {path.backend.service?.port?.number || "-"}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Không có rules</p>
                  )}
                </TabsContent>
                <TabsContent value="yaml" className="space-y-4">
                  <Textarea
                    value={ingressDetail.yaml || ""}
                    readOnly
                    className="font-mono text-xs min-h-[400px]"
                  />
                </TabsContent>
                <TabsContent value="metadata" className="space-y-4">
                  {ingressDetail.labels && Object.keys(ingressDetail.labels).length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Labels</Label>
                      <div className="mt-2 space-y-1">
                        {Object.entries(ingressDetail.labels).map(([key, value]) => (
                          <p key={key} className="text-sm">
                            <span className="font-medium">{key}:</span> {String(value)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {ingressDetail.annotations && Object.keys(ingressDetail.annotations).length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Annotations</Label>
                      <div className="mt-2 space-y-1">
                        {Object.entries(ingressDetail.annotations).map(([key, value]) => (
                          <p key={key} className="text-sm">
                            <span className="font-medium">{key}:</span> {String(value)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {ingressDetail.uid && (
                    <div>
                      <Label className="text-muted-foreground">UID</Label>
                      <p className="font-mono text-sm">{ingressDetail.uid}</p>
                    </div>
                  )}
                  {ingressDetail.resourceVersion && (
                    <div>
                      <Label className="text-muted-foreground">Resource Version</Label>
                      <p className="font-mono text-sm">{ingressDetail.resourceVersion}</p>
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
            <DialogTitle>Chỉnh sửa YAML: {editingYamlIngress?.name}</DialogTitle>
            <DialogDescription>Chỉnh sửa manifest Ingress trực tiếp</DialogDescription>
          </DialogHeader>
          {loadingYamlDetail ? (
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

