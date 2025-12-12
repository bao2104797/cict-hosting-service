import { useEffect, useMemo, useState } from "react";
import { ResourceTable } from "../../components/ResourceTable";
import { Badge } from "@/components/ui/badge";
import { adminAPI } from "@/lib/admin-api";
import type { Namespace, Pod } from "@/types/admin";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, Search, Plus, X, FileText, Eye, Trash } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Trang quản lý Namespaces
 */
export function Namespaces() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [namespaceDetail, setNamespaceDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createLabels, setCreateLabels] = useState<Record<string, string>>({});
  const [createAnnotations, setCreateAnnotations] = useState<Record<string, string>>({});
  const [createMode, setCreateMode] = useState<"form" | "yaml">("form");
  const [yamlContent, setYamlContent] = useState("");
  const [yamlEditDialogOpen, setYamlEditDialogOpen] = useState(false);
  const [editingYamlNamespace, setEditingYamlNamespace] = useState<Namespace | null>(null);
  const [yamlEditContent, setYamlEditContent] = useState("");
  const [isSavingYaml, setIsSavingYaml] = useState(false);
  const [namespacePods, setNamespacePods] = useState<Pod[]>([]);
  const [loadingPods, setLoadingPods] = useState(false);

  const getStatusLabel = (value: string) => {
    switch (value) {
      case "all":
        return "Tất cả trạng thái";
      case "active":
        return "Active";
      case "terminating":
        return "Terminating";
      default:
        return "Tất cả trạng thái";
    }
  };

  useEffect(() => {
    // Lần đầu vào trang: hiển thị trạng thái loading cho cả bảng
    loadNamespaces({ initial: true });
  }, []);

  const loadNamespaces = async (options?: { initial?: boolean }) => {
    const isInitial = options?.initial ?? false;
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const data = await adminAPI.getNamespaces();
      setNamespaces(data);
    } catch (error) {
      toast.error("Không thể tải danh sách namespaces");
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
        toast.success("Đã làm mới danh sách namespaces");
      }
    }
  };

  const handleAdd = () => {
    setIsDialogOpen(true);
    setCreateMode("form");
    setCreateLabels({});
    setCreateAnnotations({});
    setYamlContent("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string)?.trim();
    
    if (!name) {
      toast.error("Tên namespace không được để trống");
      return;
    }

    // Lọc bỏ các labels và annotations có key hoặc value rỗng
    const validLabels = Object.fromEntries(
      Object.entries(createLabels).filter(([k, v]) => k && v)
    );
    const validAnnotations = Object.fromEntries(
      Object.entries(createAnnotations).filter(([k, v]) => k && v)
    );

    const data = {
      name,
      status: "active" as const,
      labels: validLabels,
    };

    try {
      setIsSubmitting(true);
      // Tạo namespace mới
      const created = await adminAPI.createNamespace(data);
      // Nếu có annotations thì cập nhật thêm
      if (Object.keys(validAnnotations).length > 0) {
        await adminAPI.updateNamespace(name, {
          annotations: validAnnotations,
        });
      }

      // Optimistic update: thêm namespace mới vào danh sách hiện tại
      setNamespaces((prev) => [...prev, created]);

      toast.success("Tạo namespace thành công");
      setIsDialogOpen(false);
      setCreateLabels({});
      setCreateAnnotations({});
      loadNamespaces();
    } catch (error) {
      toast.error("Không thể tạo namespace");
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
      
      // Gọi endpoint mới để tạo namespace trực tiếp từ YAML
      await adminAPI.createNamespaceFromYaml(yamlContent);
      
      toast.success("Tạo namespace thành công từ YAML");
      setIsDialogOpen(false);
      setYamlContent("");
      loadNamespaces();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "Không thể tạo namespace từ YAML";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCreateLabel = () => {
    setCreateLabels({ ...createLabels, "": "" });
  };

  const removeCreateLabel = (key: string) => {
    const newLabels = { ...createLabels };
    delete newLabels[key];
    setCreateLabels(newLabels);
  };

  const updateCreateLabel = (oldKey: string, newKey: string, value: string) => {
    const newLabels = { ...createLabels };
    if (oldKey !== newKey) {
      delete newLabels[oldKey];
    }
    if (newKey && value) {
      newLabels[newKey] = value;
    } else if (!newKey || !value) {
      delete newLabels[newKey || oldKey];
    }
    setCreateLabels(newLabels);
  };

  const addCreateAnnotation = () => {
    setCreateAnnotations({ ...createAnnotations, "": "" });
  };

  const removeCreateAnnotation = (key: string) => {
    const newAnnotations = { ...createAnnotations };
    delete newAnnotations[key];
    setCreateAnnotations(newAnnotations);
  };

  const updateCreateAnnotation = (oldKey: string, newKey: string, value: string) => {
    const newAnnotations = { ...createAnnotations };
    if (oldKey !== newKey) {
      delete newAnnotations[oldKey];
    }
    if (newKey && value) {
      newAnnotations[newKey] = value;
    } else if (!newKey || !value) {
      delete newAnnotations[newKey || oldKey];
    }
    setCreateAnnotations(newAnnotations);
  };

  const handleDelete = async (namespace: Namespace) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa namespace "${namespace.name}"?`)) {
      return;
    }

    try {
      await adminAPI.deleteNamespace(namespace.id);

      // Optimistic update: loại bỏ namespace khỏi danh sách hiện tại
      setNamespaces((prev) => prev.filter((ns) => ns.id !== namespace.id));

      toast.success("Xóa namespace thành công");
    } catch (error) {
      toast.error("Không thể xóa namespace");
    }
  };

  const handleView = async (namespace: Namespace) => {
    setSelectedNamespace(namespace);
    setDetailDialogOpen(true);
    setLoadingDetail(true);
    setNamespaceDetail(null);
    setNamespacePods([]);

    try {
      const detail = await adminAPI.getNamespace(namespace.name);
      setNamespaceDetail(detail);
      
      // Load pods cho namespace này
      loadNamespacePods(namespace.name);
    } catch (error) {
      toast.error("Không thể tải chi tiết namespace");
      setNamespaceDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadNamespacePods = async (namespaceName: string) => {
    try {
      setLoadingPods(true);
      const allPods = await adminAPI.getPods();
      // Filter pods theo namespace
      const filteredPods = allPods.filter((pod) => pod.namespace === namespaceName);
      setNamespacePods(filteredPods);
    } catch (error) {
      toast.error("Không thể tải danh sách pods");
      setNamespacePods([]);
    } finally {
      setLoadingPods(false);
    }
  };

  const handleYamlEdit = async (namespace: Namespace) => {
    setEditingYamlNamespace(namespace);
    setYamlEditDialogOpen(true);
    setYamlEditContent("");
    setLoadingDetail(true);
    try {
      const detail = await adminAPI.getNamespace(namespace.name);
      setYamlEditContent(detail.yaml || "");
    } catch {
      toast.error("Không thể tải YAML của namespace");
      setYamlEditDialogOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleYamlEditSubmit = async () => {
    if (!editingYamlNamespace || !yamlEditContent.trim()) {
      toast.error("YAML không được để trống");
      return;
    }
    try {
      setIsSavingYaml(true);
      await adminAPI.updateNamespaceFromYaml(editingYamlNamespace.name, yamlEditContent);
      toast.success("Cập nhật namespace từ YAML thành công");
      setYamlEditDialogOpen(false);
      setEditingYamlNamespace(null);
      setYamlEditContent("");
      loadNamespaces();
    } catch {
      toast.error("Không thể cập nhật namespace từ YAML");
    } finally {
      setIsSavingYaml(false);
    }
  };

  const renderCustomActions = (namespace: Namespace) => (
    <>
      <DropdownMenuItem onClick={() => handleView(namespace)}>
        <Eye className="mr-2 h-4 w-4" />
        Xem
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleYamlEdit(namespace)}>
        <FileText className="mr-2 h-4 w-4" />
        YAML
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDelete(namespace)}
        className="text-destructive focus:text-destructive"
      >
        <Trash className="mr-2 h-4 w-4" />
        Xóa
      </DropdownMenuItem>
    </>
  );

  const columns = [
    {
      key: "name",
      label: "Tên",
    },
    {
      key: "status",
      label: "Status",
      align: "center" as const,
      render: (ns: Namespace) => (
        <Badge variant={ns.status === "active" ? "success" : "warning"}>
          {ns.status === "active" ? "Active" : "Terminating"}
        </Badge>
      ),
    },
    {
      key: "pods",
      label: "Pods",
      align: "center" as const,
      render: (ns: Namespace) => ns.podCount ?? 0,
    },
    {
      key: "cpu",
      label: "CPU",
      align: "center" as const,
      render: (ns: Namespace) => ns.cpu || "0m",
    },
    {
      key: "memory",
      label: "RAM",
      align: "center" as const,
      render: (ns: Namespace) => ns.memory || "0",
    },
    {
      key: "age",
      label: "Age",
      align: "center" as const,
    },
  ];

  const filteredNamespaces = useMemo(() => {
    const searchValue = searchTerm.toLowerCase().trim();
    return namespaces.filter((ns) => {
      const matchSearch = !searchValue || ns.name.toLowerCase().includes(searchValue);
      const matchStatus = statusFilter === "all" || ns.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [namespaces, searchTerm, statusFilter]);

  const totalCount = namespaces.length;
  const filteredCount = filteredNamespaces.length;
  const tableTitle =
    filteredCount === totalCount
      ? `Danh sách Namespaces (${totalCount})`
      : `Danh sách Namespaces (${filteredCount}/${totalCount})`;

  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm namespace..."
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="terminating">Terminating</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => loadNamespaces({ initial: false })}
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
        data={filteredNamespaces}
        loading={loading}
        onAdd={handleAdd}
        customActions={renderCustomActions}
        hideSearch
        toolbarContent={filterToolbar}
        emptyMessage="Không tìm thấy namespace phù hợp"
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tạo Namespace mới</DialogTitle>
            <DialogDescription>
              Tạo namespace mới bằng form hoặc YAML manifest.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col flex-grow overflow-hidden">
            <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as "form" | "yaml")} className="flex flex-col flex-grow overflow-hidden">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="form">Form</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
              </TabsList>
              
              <TabsContent value="form" className="flex-1 flex flex-col overflow-hidden mt-4">
          <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
            <div className="flex-grow overflow-y-auto space-y-6">
              <div>
                <Label htmlFor="name">Tên namespace *</Label>
                <Input 
                  id="name" 
                  name="name" 
                  required 
                  placeholder="Ví dụ: my-namespace"
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold">Labels (tùy chọn)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCreateLabel}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Thêm Label
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(createLabels).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <Input
                          placeholder="Key"
                          value={key}
                          onChange={(e) => updateCreateLabel(key, e.target.value, value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Value"
                          value={value}
                          onChange={(e) => updateCreateLabel(key, key, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeCreateLabel(key)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {Object.keys(createLabels).length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                        Không có labels. Nhấn "Thêm Label" để thêm mới.
                      </div>
                    )}
                  </div>
                </div>

            <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold">Annotations (tùy chọn)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCreateAnnotation}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Thêm Annotation
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(createAnnotations).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Key"
                            value={key}
                            onChange={(e) => updateCreateAnnotation(key, e.target.value, value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeCreateAnnotation(key)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Value"
                          value={value}
                          onChange={(e) => updateCreateAnnotation(key, key, e.target.value)}
                          className="min-h-[60px]"
                        />
                      </div>
                    ))}
                    {Object.keys(createAnnotations).length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                        Không có annotations. Nhấn "Thêm Annotation" để thêm mới.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setCreateLabels({});
                  setCreateAnnotations({});
                }}
                disabled={isSubmitting}
              >
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
                    Nhập YAML manifest để tạo namespace. YAML sẽ được parse và tạo namespace tương ứng.
                  </div>
                  <Textarea
                    value={yamlContent}
                    onChange={(e) => setYamlContent(e.target.value)}
                    className="flex-1 font-mono text-xs min-h-[400px]"
                    placeholder={`apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
  labels:
    environment: production
    team: backend
  annotations:
    description: "My production namespace"`}
                  />
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setYamlContent("");
                      }}
                      disabled={isSubmitting}
                    >
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

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] min-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chi tiết namespace {selectedNamespace?.name}</DialogTitle>
            <DialogDescription>
              Thông tin metadata, labels, annotations, finalizers và YAML manifest.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Đang tải...</div>
            </div>
          ) : namespaceDetail ? (
            <div className="flex-grow overflow-y-auto max-h-[calc(90vh-140px)]">
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="pods">Pods ({namespaceDetail.podCount ?? 0})</TabsTrigger>
                  <TabsTrigger value="labels-annotations">Labels & Annotations</TabsTrigger>
                  <TabsTrigger value="finalizers">Finalizers & Conditions</TabsTrigger>
                  <TabsTrigger value="yaml">YAML</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-2">Status</div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Status: </span>
                          <Badge variant={namespaceDetail.status === "active" ? "success" : "warning"}>
                            {namespaceDetail.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phase: </span>
                          {namespaceDetail.phase || "Unknown"}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-2">Pods</div>
                      <div className="text-sm">
                        <span className="text-2xl font-semibold">{namespaceDetail.podCount ?? 0}</span>
                        <span className="text-muted-foreground ml-2">pods</span>
                      </div>
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-2">CPU</div>
                      <div className="text-sm">
                        <span className="text-2xl font-semibold">{namespaceDetail.cpu || "0m"}</span>
                      </div>
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-muted-foreground uppercase mb-2">RAM</div>
                      <div className="text-sm">
                        <span className="text-2xl font-semibold">{namespaceDetail.memory || "0"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-xs text-muted-foreground uppercase mb-2">Metadata</div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name: </span>
                        <code className="text-xs">{namespaceDetail.name}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Age: </span>
                        {namespaceDetail.age || "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">UID: </span>
                        <code className="text-xs">{namespaceDetail.uid || "-"}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resource Version: </span>
                        <code className="text-xs">{namespaceDetail.resourceVersion || "-"}</code>
                      </div>
                      {namespaceDetail.creationTimestamp && (
                        <div>
                          <span className="text-muted-foreground">Created: </span>
                          {new Date(namespaceDetail.creationTimestamp).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="pods" className="space-y-4">
                  {loadingPods ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-muted-foreground">Đang tải danh sách pods...</div>
                    </div>
                  ) : namespacePods.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-2 text-left">Tên</th>
                            <th className="px-4 py-2 text-center">Ready</th>
                            <th className="px-4 py-2 text-center">Status</th>
                            <th className="px-4 py-2 text-center">Restarts</th>
                            <th className="px-4 py-2 text-left">Node</th>
                            <th className="px-4 py-2 text-left">IP</th>
                            <th className="px-4 py-2 text-center">Age</th>
                            <th className="px-4 py-2 text-center">CPU</th>
                            <th className="px-4 py-2 text-center">Memory</th>
                          </tr>
                        </thead>
                        <tbody>
                          {namespacePods.map((pod) => (
                            <tr key={pod.id} className="border-t hover:bg-muted/50">
                              <td className="px-4 py-2 font-medium">
                                <code className="text-xs">{pod.name}</code>
                              </td>
                              <td className="px-4 py-2 text-center">
                                {pod.ready.ready}/{pod.ready.total}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Badge
                                  variant={
                                    pod.status === "running"
                                      ? "success"
                                      : pod.status === "pending"
                                      ? "warning"
                                      : pod.status === "failed"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {pod.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-center">{pod.restarts}</td>
                              <td className="px-4 py-2">
                                <code className="text-xs">{pod.node || "-"}</code>
                              </td>
                              <td className="px-4 py-2">
                                <code className="text-xs">{pod.ip || "-"}</code>
                              </td>
                              <td className="px-4 py-2 text-center">{pod.age}</td>
                              <td className="px-4 py-2 text-center">{pod.cpu || "0m"}</td>
                              <td className="px-4 py-2 text-center">{pod.memory || "0"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                      Không có pods trong namespace này
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="labels-annotations" className="space-y-6">
                  <div>
                    <div className="text-sm font-semibold mb-3">Labels</div>
                    {namespaceDetail.labels && Object.keys(namespaceDetail.labels).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(namespaceDetail.labels).map(([key, value]) => (
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
                    {namespaceDetail.annotations && Object.keys(namespaceDetail.annotations).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(namespaceDetail.annotations).map(([key, value]) => (
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

                <TabsContent value="finalizers" className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold mb-2">Finalizers</div>
                    {namespaceDetail.finalizers && namespaceDetail.finalizers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {namespaceDetail.finalizers.map((finalizer: string, index: number) => (
                          <Badge key={index} variant="secondary">
                            {finalizer}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Không có finalizers</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-2">Conditions</div>
                    {namespaceDetail.conditions && namespaceDetail.conditions.length > 0 ? (
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
                            {namespaceDetail.conditions.map((condition: any, index: number) => (
                              <tr key={index} className="border-t">
                                <td className="px-4 py-2 font-medium">{condition.type || "-"}</td>
                                <td className="px-4 py-2">{condition.status || "-"}</td>
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
                    ) : (
                      <div className="text-sm text-muted-foreground">Không có conditions</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="yaml">
                  <div className="rounded-md border bg-muted/40 p-4">
                    <pre className="max-h-96 overflow-auto text-xs">
                      {namespaceDetail.yaml || "Chưa có YAML"}
                    </pre>
                  </div>
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

      {/* YAML Edit Dialog */}
      <Dialog open={yamlEditDialogOpen} onOpenChange={setYamlEditDialogOpen}>
        <DialogContent className="w-[75vw] h-[90vh] max-w-[75vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa YAML: {editingYamlNamespace?.name}</DialogTitle>
            <DialogDescription>Chỉnh sửa manifest Namespace trực tiếp</DialogDescription>
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

