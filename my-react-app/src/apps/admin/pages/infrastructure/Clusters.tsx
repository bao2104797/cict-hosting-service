import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { adminAPI } from "@/lib/admin-api";
import type { Server } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, RefreshCw, Loader2, Plus, Trash2, Edit, Server as ServerIcon, Users, Network, Activity, Settings, User, Lock, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

/**
 * Trang quản lý Cluster - chỉ hiển thị danh sách server trong cluster
 * Có nút gán server vào cluster qua modal
 */
export function Clusters() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // States cho modal gán server
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set());
  const [serverRoles, setServerRoles] = useState<Record<string, string>>({});
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  // States cho cập nhật role và gỡ server
  const [updatingRoleServerId, setUpdatingRoleServerId] = useState<string | null>(null);
  const [removingServerId, setRemovingServerId] = useState<string | null>(null);

  // States cho dialog sửa server
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("connection");
  const [formData, setFormData] = useState({
    name: "",
    ipAddress: "",
    port: "22",
    username: "",
    password: "",
    role: "WORKER",
    serverStatus: "RUNNING",
    clusterStatus: "UNAVAILABLE",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Chỉ lấy danh sách servers, không gọi getCluster() để tránh timeout
      const serversData = await adminAPI.getServers();
      setServers(serversData);
    } catch (error) {
      toast.error("Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  // Chỉ lấy servers trong cluster (clusterStatus = "AVAILABLE") và có role MASTER hoặc WORKER
  const serversInCluster = servers.filter((s) => 
    s.clusterStatus === "AVAILABLE" && 
    (s.role === "MASTER" || s.role === "WORKER")
  );

  // Servers chưa trong cluster (cho modal) - hiển thị tất cả
  const serversNotInCluster = servers.filter(
    (s) => s.clusterStatus !== "AVAILABLE"
  );

  // Filter servers trong cluster theo search query
  const filteredServersInCluster = useMemo(() => {
    if (!searchQuery) return serversInCluster;
    const query = searchQuery.toLowerCase();
    return serversInCluster.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.ipAddress.toLowerCase().includes(query) ||
        (s.role && s.role.toLowerCase().includes(query))
    );
  }, [serversInCluster, searchQuery]);

  // Filter servers chưa trong cluster cho modal - hiển thị tất cả
  const filteredAvailableServers = useMemo(() => {
    if (!modalSearchQuery) return serversNotInCluster;
    const query = modalSearchQuery.toLowerCase();
    return serversNotInCluster.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.ipAddress.toLowerCase().includes(query) ||
        (s.role && s.role.toLowerCase().includes(query))
    );
  }, [serversNotInCluster, modalSearchQuery]);

  // Tất cả servers đều có thể gán vào cluster với bất kỳ role nào
  const canAssignToCluster = (server: Server) => {
    return true;
  };

  // Handle mở modal gán server
  const handleOpenAssignModal = () => {
    setShowAssignModal(true);
    setSelectedServers(new Set());
    setServerRoles({});
    setModalSearchQuery("");
  };

  // Handle đóng modal
  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setSelectedServers(new Set());
    setServerRoles({});
    setModalSearchQuery("");
  };

  // Kiểm tra server có thể được gán vào cluster không (chỉ MASTER hoặc WORKER)
  const canAssignServerToCluster = (server: Server) => {
    const role = server.role?.toUpperCase() || "";
    return role === "MASTER" || role === "WORKER";
  };

  // Handle toggle chọn server trong modal
  const handleToggleServer = (serverId: string, checked: boolean) => {
    const server = serversNotInCluster.find((s) => s.id === serverId);
    if (!server) return;

    // Chỉ cho phép chọn server có role MASTER hoặc WORKER
    if (!canAssignServerToCluster(server)) {
      toast.error(`Server ${server.name} có role ${server.role} không thể được gán vào cluster. Chỉ có MASTER và WORKER mới được phép.`);
      return;
    }

    const newSelected = new Set(selectedServers);
    if (checked) {
      newSelected.add(serverId);
      // Chỉ cho phép MASTER hoặc WORKER, mặc định là WORKER
      if (!serverRoles[serverId]) {
        const currentRole = server?.role?.toUpperCase() || "WORKER";
        const defaultRole = (currentRole === "MASTER" || currentRole === "WORKER") 
          ? currentRole 
          : "WORKER";
        setServerRoles((prev) => ({ ...prev, [serverId]: defaultRole }));
      }
    } else {
      newSelected.delete(serverId);
    }
    setSelectedServers(newSelected);
  };

  // Handle chọn tất cả servers trong modal
  const handleSelectAllServers = (checked: boolean) => {
    if (checked) {
      // Chỉ chọn các server có role MASTER hoặc WORKER
      const assignableServers = filteredAvailableServers.filter((s) => canAssignServerToCluster(s));
      const allIds = new Set(assignableServers.map((s) => s.id));
      setSelectedServers(allIds);
      // Khởi tạo roles cho tất cả, chỉ giữ MASTER hoặc WORKER, mặc định là WORKER
      const roles: Record<string, string> = { ...serverRoles };
      assignableServers.forEach((s) => {
        if (!roles[s.id]) {
          const currentRole = s.role?.toUpperCase() || "WORKER";
          const role = (currentRole === "MASTER" || currentRole === "WORKER") 
            ? currentRole 
            : "WORKER";
          roles[s.id] = role;
        }
      });
      setServerRoles(roles);
    } else {
      setSelectedServers(new Set());
    }
  };

  // Handle thay đổi role của server trong modal
  const handleRoleChange = (serverId: string, role: string) => {
    // Chỉ cho phép MASTER hoặc WORKER khi gán vào cluster
    const roleUpper = role.toUpperCase();
    if (roleUpper !== "MASTER" && roleUpper !== "WORKER") {
      toast.error("Chỉ có thể gán server với role MASTER hoặc WORKER vào cluster");
      return;
    }
    setServerRoles((prev) => ({ ...prev, [serverId]: roleUpper }));
  };

  // Handle cập nhật role cho một server
  const handleUpdateServerRole = async (serverId: string, newRole: string) => {
    const server = serversInCluster.find((s) => s.id === serverId);
    if (!server) return;

    // Kiểm tra nếu role không thay đổi thì không cần cập nhật
    const currentRole = server.role?.toUpperCase() || "WORKER";
    if (currentRole === newRole.toUpperCase()) {
      return;
    }

    // Chỉ cho phép đổi giữa MASTER và WORKER trong cluster
    const newRoleUpper = newRole.toUpperCase();
    if (newRoleUpper !== "MASTER" && newRoleUpper !== "WORKER") {
      toast.error("Chỉ có thể đổi role giữa MASTER và WORKER trong cluster. Để đổi sang DOCKER hoặc ANSIBLE, vui lòng gỡ server khỏi cluster trước.");
      return;
    }

    // Kiểm tra nếu đang đổi tất cả MASTER thành role khác
    const currentMasterCount = serversInCluster.filter((s) => s.role === "MASTER").length;
    if (server.role === "MASTER" && newRoleUpper !== "MASTER" && currentMasterCount === 1) {
      toast.error("Phải có ít nhất 1 server với role MASTER trong cluster");
      return;
    }

    try {
      setUpdatingRoleServerId(serverId);
      await adminAPI.updateServerRoles([{ serverId, role: newRole }]);
      toast.success(`Đã cập nhật role của ${server.name} thành ${newRole}`);
      await loadData();
    } catch (error: any) {
      const errorMessage = error.message || "Không thể cập nhật role";
      toast.error(errorMessage);
    } finally {
      setUpdatingRoleServerId(null);
    }
  };

  // Handle sửa server
  const handleEdit = async (server: Server) => {
    try {
      // Load đầy đủ thông tin server từ backend
      const fullServer = await adminAPI.getServer(server.id);
      setEditingServer(fullServer);
      // Load form data từ server
      setFormData({
        name: fullServer.name || "",
        ipAddress: fullServer.ipAddress || "",
        port: String(fullServer.port || 22),
        username: fullServer.username || "",
        password: "", // Không load password khi edit
        role: fullServer.role || "WORKER",
        serverStatus: fullServer.serverStatus || (fullServer.status === "online" ? "RUNNING" : "STOPPED") || "RUNNING",
        clusterStatus: fullServer.clusterStatus || "UNAVAILABLE",
      });
      setIsEditDialogOpen(true);
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          "Không thể tải thông tin server";
      toast.error(errorMessage);
      // Fallback: dùng thông tin từ list nếu load detail thất bại
      setEditingServer(server);
      setFormData({
        name: server.name || "",
        ipAddress: server.ipAddress || "",
        port: String(server.port || 22),
        username: server.username || "",
        password: "",
        role: server.role || "WORKER",
        serverStatus: server.serverStatus || (server.status === "online" ? "RUNNING" : "STOPPED") || "RUNNING",
        clusterStatus: server.clusterStatus || "UNAVAILABLE",
      });
      setIsEditDialogOpen(true);
    }
  };

  // Handle submit form sửa server
  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!editingServer) return;

    try {
      setIsSubmitting(true);
      // Khi sửa server: chỉ cập nhật các trường cấu hình (không cần test SSH)
      const data: any = {
        name: formData.name,
        role: formData.role || "WORKER",
        serverStatus: formData.serverStatus || "RUNNING",
        clusterStatus: formData.clusterStatus || "UNAVAILABLE",
      };
      
      // Chỉ gửi thông tin kết nối nếu người dùng thực sự thay đổi
      const connectionChanged = 
        formData.ipAddress !== editingServer.ipAddress ||
        parseInt(formData.port) !== editingServer.port ||
        formData.username !== editingServer.username;
      
      if (connectionChanged) {
        data.ipAddress = formData.ipAddress;
        data.port = parseInt(formData.port) || 22;
        data.username = formData.username;
      }
      
      // Chỉ gửi password nếu có giá trị mới
      if (formData.password && formData.password.trim() !== "") {
        data.password = formData.password;
      }
      
      await adminAPI.updateServer(editingServer.id, data);
      toast.success("Cập nhật server thành công");
      setIsEditDialogOpen(false);
      await loadData();
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Không thể cập nhật server";
      toast.error(errorMessage);
      console.error("Error updating server:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle gỡ server khỏi cluster
  const handleRemoveServer = async (serverId: string) => {
    const server = serversInCluster.find((s) => s.id === serverId);
    if (!server) return;

    // Kiểm tra nếu đang xóa tất cả MASTER
    const currentMasterCount = serversInCluster.filter((s) => s.role === "MASTER").length;
    if (server.role === "MASTER" && currentMasterCount === 1) {
      toast.error("Không thể bỏ server MASTER này. Phải có ít nhất 1 MASTER trong cluster.");
      return;
    }

    if (!confirm(`Bạn có chắc muốn gỡ server "${server.name}" khỏi cluster?`)) {
      return;
    }

    try {
      setRemovingServerId(serverId);
      await adminAPI.unassignServersFromCluster([serverId]);
      toast.success(`Đã gỡ server ${server.name} khỏi cluster`);
      await loadData();
    } catch (error: any) {
      const errorMessage = error.message || "Không thể gỡ server khỏi cluster";
      toast.error(errorMessage);
    } finally {
      setRemovingServerId(null);
    }
  };

  // Handle gán servers vào cluster
  const handleAssignServers = async () => {
    if (selectedServers.size === 0) {
      toast.error("Vui lòng chọn ít nhất một server");
      return;
    }

    // Kiểm tra phải có ít nhất 1 MASTER
    const masterCount = Array.from(selectedServers).filter(
      (id) => serverRoles[id] === "MASTER"
    ).length;
    
    // Nếu chưa có MASTER nào trong cluster và không có MASTER nào được chọn
    const existingMasterCount = serversInCluster.filter((s) => s.role === "MASTER").length;
    if (existingMasterCount === 0 && masterCount === 0) {
      toast.error("Phải có ít nhất 1 server với role MASTER");
      return;
    }

    try {
      setIsAssigning(true);
      const serverIds = Array.from(selectedServers);
      
      const updates = serverIds.map((id) => {
        // Ưu tiên role từ serverRoles, đảm bảo chỉ là MASTER hoặc WORKER
        const server = serversNotInCluster.find((s) => s.id === id);
        const selectedRole = serverRoles[id] || server?.role?.toUpperCase() || "WORKER";
        // Chỉ chấp nhận MASTER hoặc WORKER
        const role = (selectedRole === "MASTER" || selectedRole === "WORKER") 
          ? selectedRole 
          : "WORKER";
        return {
          serverId: id,
          role,
        };
      });

      await adminAPI.assignServersToCluster(updates);
      toast.success(`Đã gán ${serverIds.length} server vào cluster`);
      
      handleCloseAssignModal();
      await loadData();
    } catch (error: any) {
      const errorMessage = error.message || "Không thể gán servers vào cluster";
      toast.error(errorMessage);
    } finally {
      setIsAssigning(false);
    }
  };

  // Tính toán stats
  const stats = useMemo(() => {
    const masterCount = serversInCluster.filter((s) => s.role === "MASTER").length;
    const workerCount = serversInCluster.filter((s) => s.role === "WORKER").length;
    const dockerCount = serversInCluster.filter((s) => s.role === "DOCKER").length;
    const ansibleCount = serversInCluster.filter((s) => s.role === "ANSIBLE").length;
    const onlineCount = serversInCluster.filter((s) => s.status === "online").length;
    
    return {
      total: serversInCluster.length,
      master: masterCount,
      worker: workerCount,
      docker: dockerCount,
      ansible: ansibleCount,
      online: onlineCount,
      offline: serversInCluster.length - onlineCount,
    };
  }, [serversInCluster]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Network className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Quản lý Cluster</h2>
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
          </div>
        </div>
        <div className="border rounded-lg p-8 text-center">
          <div className="animate-pulse flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Đang tải...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
            <Network className="h-6 w-6 text-primary" />
          </div>
        <div>
            <h2 className="text-2xl font-bold">Quản lý Cluster</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gán servers vào cluster, để tiến hành cài đặt và quản lý cluster.
          </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {serversInCluster.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Tổng số</p>
                  <p className="text-lg font-bold">{stats.total}</p>
                </div>
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <ServerIcon className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-yellow-500/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">MASTER</p>
                  <p className="text-lg font-bold text-yellow-600 dark:text-yellow-500">{stats.master}</p>
                </div>
                <div className="h-8 w-8 rounded-md bg-yellow-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-blue-500/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">WORKER</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-500">{stats.worker}</p>
                </div>
                <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-green-500/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Online</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-500">{stats.online}</p>
                </div>
                <div className="h-8 w-8 rounded-md bg-green-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-green-600 dark:text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Servers trong Cluster Card */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ServerIcon className="h-4 w-4 text-green-600 dark:text-green-500" />
              </div>
              <CardTitle className="text-lg font-semibold">
                Servers trong cluster
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({serversInCluster.length})
                </span>
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm theo tên, IP hoặc role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
              <Button onClick={handleOpenAssignModal} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Gán vào cluster
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {serversInCluster.length === 0 ? (
            <div className="p-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <ServerIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-2">Chưa có server nào trong cluster</p>
              <p className="text-sm text-muted-foreground mb-4">
                Nhấn nút "Gán vào cluster" để thêm servers vào cluster
              </p>
              <Button onClick={handleOpenAssignModal} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Gán servers vào cluster
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                  <tr>
                      <th className="p-4 text-left text-sm font-semibold">Tên</th>
                      <th className="p-4 text-left text-sm font-semibold">IP Address</th>
                      <th className="p-4 text-left text-sm font-semibold">Username</th>
                      <th className="p-4 text-left text-sm font-semibold">Role</th>
                      <th className="p-4 text-left text-sm font-semibold">Status</th>
                      <th className="p-4 text-left text-sm font-semibold">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServersInCluster.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="p-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="h-8 w-8 text-muted-foreground" />
                            <p className="text-muted-foreground">Không tìm thấy server nào</p>
                          </div>
                      </td>
                    </tr>
                  ) : (
                    filteredServersInCluster.map((server) => (
                        <tr key={server.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-4 font-medium">{server.name}</td>
                          <td className="p-4 font-mono text-sm">{server.ipAddress}</td>
                          <td className="p-4">{server.username || "-"}</td>
                          <td className="p-4">
                          <select
                            value={server.role?.toUpperCase() || "WORKER"}
                            onChange={(e) => handleUpdateServerRole(server.id, e.target.value)}
                              className={`flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs font-medium ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[120px] ${
                                server.role === "MASTER" 
                                  ? "border-yellow-500/50 bg-yellow-500/5"
                                  : server.role === "WORKER"
                                  ? "border-blue-500/50 bg-blue-500/5"
                                  : ""
                              }`}
                            disabled={updatingRoleServerId === server.id}
                          >
                            <option value="MASTER">MASTER</option>
                            <option value="WORKER">WORKER</option>
                          </select>
                        </td>
                          <td className="p-4">
                            {server.status === "online" ? (
                              <Badge variant="success" className="font-medium">Online</Badge>
                            ) : server.status === "disabled" ? (
                              <Badge variant="secondary" className="font-medium">Disabled</Badge>
                            ) : (
                              <Badge variant="destructive" className="font-medium">Offline</Badge>
                            )}
                        </td>
                          <td className="p-4">
                          <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(server)}
                                className="h-8"
                              >
                                <Edit className="h-3.5 w-3.5 mr-1.5" />
                                Sửa
                              </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveServer(server.id)}
                              disabled={removingServerId === server.id}
                                className="h-8"
                            >
                              {removingServerId === server.id ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                  Đang gỡ...
                                </>
                              ) : (
                                <>
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                  Gỡ
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Gán Server vào Cluster */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" onClose={handleCloseAssignModal}>
          <DialogHeader>
            <DialogTitle>Gán servers vào cluster</DialogTitle>
            <DialogDescription>
              Chọn các servers chưa nằm trong cluster để gán vào cluster. 
              Chỉ có thể gán servers với role MASTER hoặc WORKER vào cluster. 
              Vui lòng đảm bảo có ít nhất 1 server với role MASTER.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {/* Search trong modal */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm server..."
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Danh sách servers chưa trong cluster */}
            <div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="overflow-y-auto flex-1" style={{ maxHeight: "400px" }}>
                {filteredAvailableServers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {serversNotInCluster.length === 0 
                      ? "Không có server nào chưa trong cluster"
                      : "Không tìm thấy server nào"}
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-3 text-left w-12">
                          <Checkbox
                            checked={
                              filteredAvailableServers.filter((s) => canAssignServerToCluster(s)).length > 0 &&
                              filteredAvailableServers
                                .filter((s) => canAssignServerToCluster(s))
                                .every((s) => selectedServers.has(s.id))
                            }
                            onChange={(e) => handleSelectAllServers(e.target.checked)}
                          />
                        </th>
                        <th className="p-3 text-left">Tên</th>
                        <th className="p-3 text-left">IP Address</th>
                        <th className="p-3 text-left">Port</th>
                        <th className="p-3 text-left">Role</th>
                        <th className="p-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAvailableServers.map((server) => {
                        const canAssign = canAssignServerToCluster(server);
                        return (
                          <tr
                            key={server.id}
                            className={`border-t ${
                              !canAssign 
                                ? "opacity-50 bg-muted/20" 
                                : selectedServers.has(server.id) 
                                ? "bg-muted/30 hover:bg-muted/50" 
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <td className="p-3">
                              <Checkbox
                                checked={selectedServers.has(server.id)}
                                onChange={(e) => handleToggleServer(server.id, e.target.checked)}
                                disabled={!canAssign}
                              />
                            </td>
                            <td className="p-3 font-medium">
                              {server.name}
                              {!canAssign && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (Không thể gán vào cluster)
                                </span>
                              )}
                            </td>
                            <td className="p-3">{server.ipAddress}</td>
                            <td className="p-3">{server.port}</td>
                            <td className="p-3">
                              {selectedServers.has(server.id) && canAssign ? (
                              <select
                                value={serverRoles[server.id] || server.role?.toUpperCase() || "WORKER"}
                                onChange={(e) => handleRoleChange(server.id, e.target.value)}
                                  className={`flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs font-medium ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[120px] ${
                                    (serverRoles[server.id] || server.role?.toUpperCase() || "WORKER") === "MASTER"
                                      ? "border-yellow-500/50 bg-yellow-500/5"
                                      : "border-blue-500/50 bg-blue-500/5"
                                  }`}
                              >
                                <option value="MASTER">MASTER</option>
                                <option value="WORKER">WORKER</option>
                              </select>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {server.role && (server.role.toUpperCase() === "MASTER" || server.role.toUpperCase() === "WORKER") ? (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs font-medium ${
                                        server.role.toUpperCase() === "MASTER"
                                          ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-500"
                                          : "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-500"
                                      }`}
                                    >
                                      {server.role.toUpperCase()}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs font-medium opacity-50"
                                    >
                                      {server.role?.toUpperCase() || "N/A"}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge variant={server.status === "online" ? "default" : "secondary"}>
                                {server.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Footer với thông tin và nút */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Đã chọn: {selectedServers.size} server
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleCloseAssignModal}
                  disabled={isAssigning}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleAssignServers}
                  disabled={isAssigning || selectedServers.size === 0}
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang gán...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Gán vào cluster ({selectedServers.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog sửa server */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setActiveTab("connection");
          setEditingServer(null);
          setFormData({
            name: "",
            ipAddress: "",
            port: "22",
            username: "",
            password: "",
            role: "WORKER",
            serverStatus: "RUNNING",
            clusterStatus: "UNAVAILABLE",
          });
        }
      }}>
        <DialogContent className="w-[800px] max-w-[800px] h-[600px] max-h-[600px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Sửa Server
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Cập nhật thông tin kết nối và cấu hình server
            </p>
          </DialogHeader>
          
          <form onSubmit={handleSubmitEdit} className="flex flex-col flex-1 min-h-0 space-y-4">
            {/* Tên server */}
            <div className="space-y-2 flex-shrink-0">
              <Label htmlFor="edit-name" className="text-sm font-medium flex items-center gap-2">
                <ServerIcon className="h-3.5 w-3.5" />
                Tên Server <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="server-01, master-node, worker-01..."
                className="h-10"
                required
              />
              <p className="text-xs text-muted-foreground">
                Tên hiển thị để dễ dàng nhận biết server
              </p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="connection" className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Thông tin kết nối
                </TabsTrigger>
                <TabsTrigger value="configuration" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Cấu hình
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Thông tin kết nối SSH */}
              <TabsContent value="connection" className="space-y-4 mt-4 flex-1 overflow-y-auto min-h-0 pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-ipAddress" className="text-sm font-medium flex items-center gap-2">
                      <Network className="h-3.5 w-3.5" />
                      IP Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit-ipAddress"
                      name="ipAddress"
                      type="text"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      placeholder="192.168.1.10"
                      className="h-10 font-mono"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Địa chỉ IP hoặc hostname
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-port" className="text-sm font-medium">
                      Port SSH <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit-port"
                      name="port"
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      placeholder="22"
                      className="h-10"
                      min="1"
                      max="65535"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Port SSH (mặc định: 22)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-username" className="text-sm font-medium flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      Username <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit-username"
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="root, ubuntu..."
                      className="h-10"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Tên người dùng SSH
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-password" className="text-sm font-medium flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5" />
                      Password
                    </Label>
                    <Input
                      id="edit-password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Để trống nếu không đổi"
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Chỉ nhập nếu muốn thay đổi password
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Cấu hình Server */}
              <TabsContent value="configuration" className="space-y-4 mt-4 flex-1 overflow-y-auto min-h-0 pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-role" className="text-sm font-medium">
                      Role <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="edit-role"
                      name="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    >
                      <option value="MASTER">MASTER - Master Node</option>
                      <option value="WORKER">WORKER - Worker Node</option>
                      <option value="DOCKER">DOCKER - Docker Host</option>
                      <option value="ANSIBLE">ANSIBLE - Ansible Controller</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Vai trò của server trong hệ thống
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-serverStatus" className="text-sm font-medium">
                      Server Status <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="edit-serverStatus"
                      name="serverStatus"
                      value={formData.serverStatus}
                      onChange={(e) => setFormData({ ...formData, serverStatus: e.target.value })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    >
                      <option value="RUNNING">RUNNING - Đang chạy</option>
                      <option value="STOPPED">STOPPED - Đã dừng</option>
                      <option value="BUILDING">BUILDING - Đang xây dựng</option>
                      <option value="ERROR">ERROR - Lỗi</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Trạng thái hoạt động của server
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-clusterStatus" className="text-sm font-medium">
                    Cluster Status <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="edit-clusterStatus"
                    name="clusterStatus"
                    value={formData.clusterStatus}
                    onChange={(e) => setFormData({ ...formData, clusterStatus: e.target.value })}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="AVAILABLE">AVAILABLE - Sẵn sàng trong cluster</option>
                    <option value="UNAVAILABLE">UNAVAILABLE - Không sẵn sàng</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Trạng thái tham gia vào Kubernetes cluster
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer buttons */}
            <div className="flex justify-end items-center pt-4 border-t flex-shrink-0 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="min-w-[100px]"
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button type="submit" className="min-w-[120px]" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang cập nhật...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Cập nhật
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
