import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { adminAPI } from "@/lib/admin-api";
import type { Server } from "@/types/admin";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Power, PowerOff, RotateCcw, Wifi, WifiOff, Server as ServerIcon, Network, User, Lock, Settings, CheckCircle2, RefreshCw, Terminal as TerminalIcon, Search, MoreVertical, Pencil, Trash2, Laptop } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Terminal } from "@/components/common/Terminal";

  /**
   * Trang quản lý Hosts
   */
export function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingSsh, setIsTestingSsh] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isUpdatingMetrics, setIsUpdatingMetrics] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState<string | null>(null);
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false);
  const [reconnectPassword, setReconnectPassword] = useState("");
  const [reconnectingServer, setReconnectingServer] = useState<Server | null>(null);
  const [activeTab, setActiveTab] = useState("connection");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [selectedServerForTerminal, setSelectedServerForTerminal] = useState<Server | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form state để lưu giá trị khi chuyển tab
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
  
  const pageSize = 9; // 3 cột x 3 hàng = 9 items per page
  
  // Filter servers theo tên và IP
  const filteredServers = servers.filter((server) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = (server.name || "").toLowerCase();
    const ipAddress = (server.ipAddress || "").toLowerCase();
    return name.includes(query) || ipAddress.includes(query);
  });
  
  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredServers.length / pageSize));
  const currentPageIndex = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (currentPageIndex - 1) * pageSize;
  const displayServers = filteredServers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    // Load danh sách servers và kiểm tra status khi vào trang
    const initializeServers = async () => {
      try {
        setLoading(true);
        // Chỉ kiểm tra status (ping), metrics sẽ lấy từ database
        const result = await adminAPI.checkAllStatuses();
        setServers(result.servers);
      } catch (error: any) {
        // Nếu kiểm tra status thất bại, vẫn load danh sách servers từ database
        console.error("Error checking host status:", error);
        await loadServers();
          const errorMessage = error.message || 
                            error.response?.data?.message || 
                            error.response?.data?.error || 
                            "Không thể kiểm tra trạng thái hosts";
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    initializeServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getServers();
      setServers(data);
    } catch (error) {
      toast.error("Không thể tải danh sách hosts");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingServer(null);
    setActiveTab("connection"); // Reset về tab đầu tiên
    // Reset form data về giá trị mặc định
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
    setIsDialogOpen(true);
  };

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
      setIsDialogOpen(true);
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          "Không thể tải thông tin host";
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
    setIsDialogOpen(true);
    }
  };

  const handleDelete = async (server: Server) => {
    if (!confirm(`Bạn có chắc muốn xóa host "${server.name}"?`)) return;
    try {
      await adminAPI.deleteServer(server.id);
      toast.success("Xóa host thành công");
      loadServers();
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Không thể xóa host";
      toast.error(errorMessage);
        console.error("Error deleting host:", error);
    }
  };

  const handleCheckStatus = async () => {
    try {
      setIsCheckingStatus(true);
      // Gọi API chỉ kiểm tra trạng thái (ping)
      const result = await adminAPI.checkAllStatuses();

      // Cập nhật danh sách hosts với trạng thái mới nhất
      setServers(result.servers);

      // Thống kê số lượng host theo trạng thái để hiển thị rõ ràng cho admin
      const total = result.servers.length;
      const onlineCount = result.servers.filter((s) => s.status === "online").length;
      const offlineCount = result.servers.filter((s) => s.status === "offline").length;
      const disabledCount = result.servers.filter((s) => s.status === "disabled").length;

      const summaryMessage =
        result.message ||
        `Đã kiểm tra và cập nhật trạng thái ${total} hosts. ` +
          `Online: ${onlineCount}, Offline: ${offlineCount}, Disabled: ${disabledCount}.`;

      toast.success(summaryMessage);
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Không thể kiểm tra trạng thái";
      toast.error(errorMessage);
      console.error("Error checking status:", error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleUpdateMetrics = async () => {
    try {
      setIsUpdatingMetrics(true);
      // Gọi API check all hosts (status + metrics)
      const result = await adminAPI.checkAllServers();

      // Cập nhật danh sách hosts với dữ liệu mới nhất
      setServers(result.servers);

      // FE tự xây message đẹp dựa trên dữ liệu, backend chỉ trả data
      // Chỉ tính các host ONLINE và có metrics trong lần cập nhật này
      const serversWithMetrics = result.servers.filter((s) => {
        if (s.status !== "online") return false;
        const hasCpu = s.cpu && typeof s.cpu.total !== "undefined" && s.cpu.total !== "-" && typeof s.cpu.total !== "string";
        const hasMem = s.memory && typeof s.memory.total !== "undefined" && s.memory.total !== "-" && typeof s.memory.total !== "string";
        const hasDisk = s.disk && typeof s.disk.total !== "undefined" && s.disk.total !== "-" && typeof s.disk.total !== "string";
        return hasCpu || hasMem || hasDisk;
      });

      // Đưa ra tất cả host ONLINE bị failed metrics (tức online mà không lấy được metrics)
      const serversFailedMetrics = result.servers.filter((s) => {
        if (s.status !== "online") return false;
        const hasCpu = s.cpu && typeof s.cpu.total !== "undefined" && s.cpu.total !== "-" && typeof s.cpu.total !== "string";
        const hasMem = s.memory && typeof s.memory.total !== "undefined" && s.memory.total !== "-" && typeof s.memory.total !== "string";
        const hasDisk = s.disk && typeof s.disk.total !== "undefined" && s.disk.total !== "-" && typeof s.disk.total !== "string";
        return !(hasCpu || hasMem || hasDisk);
      });

      // Ngoài ra, show server offline/disabled nếu muốn 
      // Ta gom tất cả hosts không có metrics (offline, hoặc online failed hoặc disabled)
      const serversWithoutMetrics = [
        ...serversFailedMetrics,
        ...result.servers.filter(s => s.status !== "online")
      ];

      const successCount = serversWithMetrics.length;
      const failCount = serversWithoutMetrics.length;
      const successLabel = successCount === 1 ? "host" : "hosts";
      const failLabel = failCount === 1 ? "host" : "hosts";

      toast.success(
        <div>
          <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 4 }}>
            Cập nhật metrics: {successCount} thành công{failCount > 0 ? `, ${failCount} thất bại` : ""}
          </div>
          {/* Hiện tối đa 5 host thành công */}
          {successCount > 0 && successCount <= 5 && (
            <ul style={{ paddingLeft: 18, margin: 0, marginTop: 6, fontSize: "0.95em" }}>
              {serversWithMetrics.map((s) => {
                const name = s.name || s.id;
                const cpu =
                  !s.cpu || typeof s.cpu.total === "undefined" || s.cpu.total === "-" || typeof s.cpu.total === "string"
                    ? "-"
                    : s.cpu.total;
                const mem =
                  !s.memory || typeof s.memory.total === "undefined" || s.memory.total === "-" || typeof s.memory.total === "string"
                    ? "-"
                    : `${s.memory.total} GiB`;
                const disk =
                  !s.disk || typeof s.disk.total === "undefined" || s.disk.total === "-" || typeof s.disk.total === "string"
                    ? "-"
                    : `${s.disk.total} GiB`;
                return (
                  <li key={s.id}>
                    <strong>{name}</strong>: CPU {cpu}, RAM {mem}, DISK {disk}
                  </li>
                );
              })}
            </ul>
          )}
          {/* Hiện tối đa 10 server thất bại (bao gồm cả online không lấy được metrics và offline) */}
          {failCount > 0 && (
            <ul style={{ paddingLeft: 18, margin: 0, marginTop: 10, fontSize: "0.95em", color: "#d33" }}>
              {serversWithoutMetrics.slice(0, 10).map((s) => {
                const name = s.name || s.id;
                let reason = '';
                if (s.status !== "online") {
                  // Nếu offline hoặc disabled (không thỏa metrics do status)
                  reason = s.status === "offline"
                    ? "Offline – không kết nối được"
                    : (s.status === "disabled" ? "Đã disable" : "Không rõ");
                } else {
                  // Online nhưng không lấy được metrics
                  reason = "Online nhưng không lấy được metrics (có thể SSH lỗi)";
                }
                return (
                  <li key={s.id}>
                    <strong>{name}</strong> <span style={{ fontStyle: 'italic' }}>({reason})</span>
                  </li>
                );
              })}
              {failCount > 10 && (
                <li style={{ opacity: 0.8, fontStyle: "italic" }}>...và {failCount - 10} host khác</li>
              )}
            </ul>
          )}
        </div>
      );
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Không thể cập nhật metrics";
      toast.error(errorMessage);
      console.error("Error updating metrics:", error);
    } finally {
      setIsUpdatingMetrics(false);
    }
  };

  const handleReconnect = async (server: Server) => {
    if (!confirm(`Bạn có chắc muốn reconnect host "${server.name}"?`)) return;
    
    try {
      setIsExecutingAction(server.id);
      setReconnectingServer(server);
      
      // Bước 1: Kiểm tra ping đến server trước
      try {
        const pingResult = await adminAPI.pingServer(server.id, 2000);
        if (!pingResult.success) {
          toast.error("Không thể ping đến host. Vui lòng kiểm tra kết nối mạng.");
          setIsExecutingAction(null);
          return;
        }
      } catch (pingError: any) {
        const pingErrorMessage = pingError.message || 
                                pingError.response?.data?.message || 
                                pingError.response?.data?.error || 
                                "Không thể ping đến host";
        toast.error(pingErrorMessage);
        setIsExecutingAction(null);
        return;
      }
      
      // Bước 2: Ping thành công, thử reconnect với SSH key
      try {
        const updatedServer = await adminAPI.reconnectServer(server.id, undefined);
        
        // Cập nhật server trong danh sách
        setServers(servers.map(s => s.id === server.id ? updatedServer : s));
        
        toast.success("Reconnect host thành công bằng SSH key");
        setIsExecutingAction(null);
        return;
      } catch (keyError: any) {
        // SSH key không hoạt động, kiểm tra xem có yêu cầu password không
        const errorMessage = keyError.message || 
                            keyError.response?.data?.message || 
                            keyError.response?.data?.error || 
                            "";
        
        // Nếu lỗi là yêu cầu password, hiển thị dialog
        if (errorMessage.includes("SSH key không hoạt động") || 
            errorMessage.includes("Password không được để trống")) {
          // Hiển thị dialog nhập password
          setReconnectPassword("");
          setReconnectDialogOpen(true);
          return;
        } else {
          // Lỗi khác, hiển thị thông báo
          toast.error(errorMessage || "Không thể reconnect host");
          setIsExecutingAction(null);
          return;
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Không thể reconnect host";
      toast.error(errorMessage);
      console.error("Error reconnecting host:", error);
      setIsExecutingAction(null);
    }
  };

  const handleReconnectWithPassword = async () => {
    if (!reconnectingServer || !reconnectPassword.trim()) {
      toast.error("Vui lòng nhập password");
      return;
    }
    
    try {
      setIsExecutingAction(reconnectingServer.id);
      
      const updatedServer = await adminAPI.reconnectServer(reconnectingServer.id, reconnectPassword);
      
      // Cập nhật server trong danh sách
      setServers(servers.map(s => s.id === reconnectingServer.id ? updatedServer : s));
      
      toast.success("Reconnect host thành công bằng password");
      setReconnectDialogOpen(false);
      setReconnectPassword("");
      setReconnectingServer(null);
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Không thể reconnect host";
      toast.error(errorMessage);
      console.error("Error reconnecting host with password:", error);
    } finally {
      setIsExecutingAction(null);
    }
  };

  const handleDisconnect = async (server: Server) => {
    if (!confirm(`Bạn có chắc muốn disconnect host "${server.name}"?`)) return;
    
    try {
      setIsExecutingAction(server.id);
      const updatedServer = await adminAPI.disconnectServer(server.id);
      
      // Cập nhật server trong danh sách
      setServers(servers.map(s => s.id === server.id ? updatedServer : s));
      
      toast.success("Disconnect host thành công");
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Không thể disconnect host";
      toast.error(errorMessage);
      console.error("Error disconnecting host:", error);
    } finally {
      setIsExecutingAction(null);
    }
  };


  const handleShutdown = async (server: Server) => {
    if (!confirm(`Bạn có chắc muốn shutdown host "${server.name}"? Host sẽ tắt sau vài giây.`)) return;
    
    try {
      setIsExecutingAction(server.id);
      const result = await adminAPI.shutdownServer(server.id);
      
      // Cập nhật server status trong danh sách
      setServers(servers.map(s => s.id === server.id ? { ...s, status: "offline" as const } : s));
      
      toast.success(result.message || "Đã gửi lệnh shutdown đến host");
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Không thể shutdown host";
      toast.error(errorMessage);
      console.error("Error shutting down host:", error);
    } finally {
      setIsExecutingAction(null);
    }
  };

  const handleRestart = async (server: Server) => {
    if (!confirm(`Bạn có chắc muốn restart host "${server.name}"? Host sẽ khởi động lại sau vài giây.`)) return;
    
    try {
      setIsExecutingAction(server.id);
      const result = await adminAPI.restartServer(server.id);
      
      // Cập nhật server status trong danh sách
      setServers(servers.map(s => s.id === server.id ? { ...s, status: "offline" as const } : s));
      
      toast.success(result.message || "Đã gửi lệnh restart đến host");
    } catch (error: any) {
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Không thể restart host";
      toast.error(errorMessage);
      console.error("Error restarting host:", error);
    } finally {
      setIsExecutingAction(null);
    }
  };

  const handleTestSsh = async (e: React.MouseEvent) => {
    e.preventDefault();

    const ip = formData.ipAddress;
    const port = parseInt(formData.port) || 22;
    const username = formData.username;
    const password = formData.password;

    if (!ip || !username || !password) {
      toast.error("Vui lòng điền đầy đủ thông tin IP, Username và Password");
      return;
    }

    try {
      setIsTestingSsh(true);
      const result = await adminAPI.testSsh({
        ip,
        port,
        username,
        password,
      });

      if (result.success) {
        toast.success("Kết nối SSH thành công!");
      } else {
        toast.error(result.message || "Kết nối SSH thất bại");
      }
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi test SSH connection");
    } finally {
      setIsTestingSsh(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      if (editingServer) {
        // Khi sửa server: chỉ cập nhật các trường cấu hình (không cần test SSH)
        // Chỉ gửi các trường đã thay đổi hoặc các trường cấu hình
    const data: any = {
          name: formData.name,
          role: formData.role || "WORKER",
          serverStatus: formData.serverStatus || "RUNNING",
          clusterStatus: formData.clusterStatus || "UNAVAILABLE",
        };
        
        // Chỉ gửi thông tin kết nối nếu người dùng thực sự thay đổi
        // (Backend sẽ tự động test SSH nếu có thay đổi thông tin kết nối)
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
        toast.success("Cập nhật host thành công");
        setIsDialogOpen(false);
        loadServers();
      } else {
        // Khi tạo server mới: gửi đầy đủ thông tin (cần test SSH)
        const data: any = {
          name: formData.name,
          ipAddress: formData.ipAddress,
          port: parseInt(formData.port) || 22,
          username: formData.username,
          password: formData.password || "",
          role: formData.role || "WORKER",
          serverStatus: formData.serverStatus || "RUNNING",
          clusterStatus: formData.clusterStatus || "UNAVAILABLE",
          status: "online" as const,
          os: "Unknown",
        };
        
        await adminAPI.createServer(data);
        toast.success("Tạo host thành công. Hệ thống đang tự động cấu hình SSH key và lấy metrics...");
      setIsDialogOpen(false);
      loadServers();
      }
    } catch (error: any) {
      // Hiển thị error message chính xác từ backend
      const errorMessage = error.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Không thể lưu host";
      toast.error(errorMessage);
      console.error("Error saving host:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Component Server Card với dropdown menu
  const ServerCard = ({ server }: { server: Server }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          menuRef.current &&
          !menuRef.current.contains(event.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(event.target as Node)
        ) {
          setMenuOpen(false);
        }
      };

      if (menuOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [menuOpen]);

    useEffect(() => {
      if (menuOpen && triggerRef.current && menuRef.current) {
        const updatePosition = () => {
          if (!triggerRef.current || !menuRef.current) return;
          const triggerRect = triggerRef.current.getBoundingClientRect();
          const menu = menuRef.current;
          menu.style.left = `${triggerRect.right - menu.offsetWidth}px`;
          menu.style.top = `${triggerRect.bottom + 4}px`;
        };
        updatePosition();
        requestAnimationFrame(updatePosition);
        }
    }, [menuOpen]);

  return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ServerIcon className="h-5 w-5" />
                Hosts {server.id}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 font-mono flex items-center gap-1.5">
                <Network className="h-3.5 w-3.5" />
                {server.ipAddress}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {server.username && (
                  <div className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    <span>{server.username}</span>
                  </div>
                )}
                {server.role && (
                  <div className="flex items-center gap-1">
                    <Laptop className="h-3.5 w-3.5" />
                    <Badge 
                      variant="outline"
                      className={`text-xs px-2 py-0 ${
                        server.role === "MASTER" 
                          ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-700 dark:text-yellow-400"
                          : server.role === "WORKER"
                          ? "bg-blue-500/10 border-blue-500/50 text-blue-700 dark:text-blue-400"
                          : server.role === "DOCKER"
                          ? "bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400"
                          : server.role === "ANSIBLE"
                          ? "bg-purple-500/10 border-purple-500/50 text-purple-700 dark:text-purple-400"
                          : "bg-gray-500/10 border-gray-500/50 text-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {server.role}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {server.status === "online" ? (
                <Badge variant="success">Online</Badge>
              ) : server.status === "disabled" ? (
                <Badge variant="secondary">Disabled</Badge>
              ) : (
                <Badge variant="destructive">Offline</Badge>
              )}
              <Button
                ref={triggerRef}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
            {menuOpen && (
              <div
                ref={menuRef}
                className="fixed z-[9999] min-w-[180px] rounded-md border bg-background p-1 text-foreground shadow-lg"
                style={{ pointerEvents: "auto" }}
              >
                <DropdownMenuItem onClick={() => { handleEdit(server); setMenuOpen(false); }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Sửa
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { handleDelete(server); setMenuOpen(false); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Xóa
                </DropdownMenuItem>
            {(server.status === "offline" || server.status === "disabled") && (
                  <DropdownMenuItem onClick={() => { handleReconnect(server); setMenuOpen(false); }}>
                <Wifi className="h-4 w-4 mr-2" />
                Kết nối lại
              </DropdownMenuItem>
            )}
            {server.status === "online" && (
                  <DropdownMenuItem onClick={() => { handleDisconnect(server); setMenuOpen(false); }}>
                <WifiOff className="h-4 w-4 mr-2" />
                Ngắt kết nối
              </DropdownMenuItem>
            )}
            {server.status === "online" && (
              <>
                <DropdownMenuItem onClick={() => {
                  setSelectedServerForTerminal(server);
                  setTerminalOpen(true);
                      setMenuOpen(false);
                }}>
                  <TerminalIcon className="h-4 w-4 mr-2" />
                  Mở Terminal
                </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { handleRestart(server); setMenuOpen(false); }}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restart
                </DropdownMenuItem>
                <DropdownMenuItem 
                      onClick={() => { handleShutdown(server); setMenuOpen(false); }}
                  className="text-destructive focus:text-destructive"
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  Shutdown
                </DropdownMenuItem>
              </>
            )}
              </div>
        )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground">CPU</div>
                <div className="font-semibold">
                  {server.cpu.total === "-" || typeof server.cpu.total === "string" 
                    ? "-" 
                    : `${server.cpu.total} cores`}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">RAM</div>
                <div className="font-semibold">
                  {server.memory.total === "-" || typeof server.memory.total === "string" 
                    ? "-" 
                    : `${server.memory.total} GiB`}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Disk</div>
                <div className="font-semibold">
                  {server.disk.total === "-" || typeof server.disk.total === "string" 
                    ? "-" 
                    : `${server.disk.total} GiB`}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-bold">Hosts</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo tên hoặc IP..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 w-64"
              />
            </div>
            
            {/* Kiểm tra trạng thái */}
          <Button
            variant="outline"
              onClick={handleCheckStatus}
              disabled={isCheckingStatus || isUpdatingMetrics || loading}
            className="gap-2"
          >
            {isCheckingStatus ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang kiểm tra...</span>
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" />
                  <span>Kiểm tra trạng thái</span>
                </>
              )}
            </Button>
            
            {/* Cập nhật metrics */}
            <Button
              variant="outline"
              onClick={handleUpdateMetrics}
              disabled={isCheckingStatus || isUpdatingMetrics || loading}
              className="gap-2"
            >
              {isUpdatingMetrics ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang cập nhật...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                  <span>Cập nhật metrics</span>
              </>
            )}
          </Button>
            
            {/* Thêm mới */}
            <Button onClick={handleAdd}>
              <ServerIcon className="h-4 w-4 mr-2" />
              Thêm mới
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="border rounded-lg p-8 text-center">
            <div className="animate-pulse">Đang tải...</div>
          </div>
        ) : (
          <>
            {/* Grid Layout - 3 cột */}
            {displayServers.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                Không có dữ liệu
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayServers.map((server) => (
                  <ServerCard key={server.id} server={server} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {filteredServers.length > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Hiển thị {startIndex + 1}-{Math.min(startIndex + pageSize, filteredServers.length)} trong{" "}
                  {filteredServers.length} mục
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPageIndex - 1))}
                    disabled={currentPageIndex <= 1}
                  >
                    Trước
                  </Button>
                  <span>
                    Trang {currentPageIndex} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPageIndex + 1))}
                    disabled={currentPageIndex >= totalPages}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog thêm/sửa host */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setActiveTab("connection"); // Reset tab khi đóng dialog
          // Reset form data khi đóng dialog
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
              {editingServer ? (
                <>
                  <Settings className="h-6 w-6" />
                  Sửa Host
                </>
              ) : (
                <>
                  <ServerIcon className="h-6 w-6" />
                  Thêm Host mới
                </>
              )}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {editingServer 
                ? "Cập nhật thông tin kết nối và cấu hình host"
                : "Nhập thông tin kết nối SSH để hệ thống tự động cấu hình và quản lý host"}
            </p>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-4">
            {/* Tên host - hiển thị ở trên cùng, không trong tab */}
            <div className="space-y-2 flex-shrink-0">
              <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                <ServerIcon className="h-3.5 w-3.5" />
                Tên Host <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="host-01, master-node, worker-01..."
                className="h-10"
                required
              />
              <p className="text-xs text-muted-foreground">
                Tên hiển thị để dễ dàng nhận biết host
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
                    <Label htmlFor="ipAddress" className="text-sm font-medium flex items-center gap-2">
                      <Network className="h-3.5 w-3.5" />
                  IP Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ipAddress"
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
                <Label htmlFor="port" className="text-sm font-medium">
                  Port SSH <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="port"
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
                    <Label htmlFor="username" className="text-sm font-medium flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                  Username <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="username"
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
                    <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5" />
                      Password {!editingServer && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingServer ? "Để trống nếu không đổi" : "••••••••"}
                      className="h-10"
                      required={!editingServer}
                    />
                    {editingServer ? (
                      <p className="text-xs text-muted-foreground">
                        Chỉ nhập nếu muốn thay đổi password
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Password sẽ được dùng để tự động tạo SSH key
                      </p>
                    )}
                  </div>
                </div>

              </TabsContent>  

              {/* Tab 2: Cấu hình Host */}
              <TabsContent value="configuration" className="space-y-4 mt-4 flex-1 overflow-y-auto min-h-0 pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-sm font-medium">
                      Role <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="role"
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
                      Vai trò của host trong hệ thống
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serverStatus" className="text-sm font-medium">
                      Host Status <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="serverStatus"
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
                      Trạng thái hoạt động của host
                    </p>
              </div>
            </div>

                <div className="space-y-2">
                  <Label htmlFor="clusterStatus" className="text-sm font-medium">
                    Cluster Status <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="clusterStatus"
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
            <div className="flex justify-between items-center pt-4 border-t flex-shrink-0">
              {/* Test SSH Button - chỉ hiển thị khi thêm mới */}
              {!editingServer && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestSsh}
                  disabled={isTestingSsh || isSubmitting}
                  className="min-w-[160px]"
                >
                  {isTestingSsh ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang kiểm tra...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Kiểm tra kết nối SSH
                    </>
                  )}
                </Button>
              )}
              {editingServer && <div />} {/* Spacer khi edit */}
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="min-w-[100px]"
                  disabled={isSubmitting || isTestingSsh}
                >
                  Hủy
                </Button>
                <Button type="submit" className="min-w-[120px]" disabled={isSubmitting || isTestingSsh}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingServer ? "Đang cập nhật..." : "Đang tạo..."}
                    </>
                  ) : (
                    <>
                      {editingServer ? (
                        <>
                          <Settings className="mr-2 h-4 w-4" />
                          Cập nhật
                        </>
                      ) : (
                        <>
                          <ServerIcon className="mr-2 h-4 w-4" />
                          Thêm Server
                        </>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reconnect Password Dialog */}
      <Dialog open={reconnectDialogOpen} onOpenChange={setReconnectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Nhập Password để Reconnect
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              SSH key không hoạt động. Vui lòng nhập password để kết nối lại server{" "}
              <span className="font-semibold">{reconnectingServer?.name}</span>
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reconnectPassword" className="text-sm font-medium">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reconnectPassword"
                type="password"
                value={reconnectPassword}
                onChange={(e) => setReconnectPassword(e.target.value)}
                placeholder="Nhập password SSH"
                className="h-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && reconnectPassword.trim()) {
                    handleReconnectWithPassword();
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Password sẽ được sử dụng để kết nối và có thể tự động generate SSH key mới
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReconnectDialogOpen(false);
                  setReconnectPassword("");
                  setReconnectingServer(null);
                  setIsExecutingAction(null);
                }}
                disabled={isExecutingAction !== null}
              >
                Hủy
              </Button>
              <Button
                onClick={handleReconnectWithPassword}
                disabled={!reconnectPassword.trim() || isExecutingAction !== null}
              >
                {isExecutingAction !== null ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang kết nối...
                  </>
                ) : (
                  "Kết nối"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Terminal Dialog */}
      {selectedServerForTerminal && (
        <Terminal
          open={terminalOpen}
          onClose={() => {
            setTerminalOpen(false);
            setSelectedServerForTerminal(null);
          }}
          server={selectedServerForTerminal}
        />
      )}
    </>
  );
}

