/**
 * Infrastructure API - Quản lý Servers, Clusters, và Ansible
 */

import api from "@/services/api";
import type { Server, Cluster } from "@/types/admin";

/**
 * Parse giá trị từ string có đơn vị (ví dụ: "8.0Gi", "50.0Gi") và trả về số GiB
 * Backend trả về GiB, frontend chỉ cần parse và hiển thị
 */
function parseSizeToGiB(value: string | null | undefined): number {
  if (!value) return 0;
  
  const cleaned = value.trim();
  
  // Kiểm tra nếu có đơn vị GiB
  if (cleaned.endsWith("Gi") || cleaned.endsWith("GiB")) {
    const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
    if (isNaN(num)) return 0;
    return num; // Đã là GiB, không cần convert
  }
  
  // Kiểm tra nếu có đơn vị GB (fallback - không nên xảy ra)
  if (cleaned.endsWith("G") || cleaned.endsWith("GB")) {
    const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
    if (isNaN(num)) return 0;
    // Convert GB sang GiB: GB * 1000^3 / 1024^3 = GB * 0.9313225746154785
    return num * 0.9313225746154785;
  }
  
  // Nếu không có đơn vị, giả sử đã là GiB
  const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : num;
}

/**
 * Infrastructure API - Quản lý Servers, Clusters, và Ansible
 */
export const infrastructureAPI = {
  // ==================== Servers ====================
  
  getServers: async (): Promise<Server[]> => {
    try {
      const response = await api.get("/servers");
      const servers = response.data;
      
      // Map từ backend response sang frontend Server type
      return servers.map((server: any) => {
        // Parse CPU cores, RAM, Disk từ string sang number
        const cpuCores = server.cpuCores ? parseInt(server.cpuCores) || 0 : 0;
        // Parse RAM và Disk từ backend (backend trả về GiB)
        const ramTotal = parseSizeToGiB(server.ramTotal);
        const diskTotal = parseSizeToGiB(server.diskTotal);
        
        // Map status từ backend (ONLINE/OFFLINE/DISABLED) sang frontend ("online" | "offline" | "disabled")
        // Nếu có status thì dùng, nếu không thì map từ serverStatus
        let status: "online" | "offline" | "disabled" = "offline";
        if (server.status) {
            if (server.status === "ONLINE") {
                status = "online";
            } else if (server.status === "DISABLED") {
                status = "disabled";
            } else {
                status = "offline";
            }
        } else {
            status = server.serverStatus === "RUNNING" ? "online" : "offline";
        }
        
        return {
          id: String(server.id),
          name: server.name,
          ipAddress: server.ip,
          port: server.port || 22,
          username: server.username,
          status: status,
          role: server.role,
          serverStatus: server.serverStatus,
          clusterStatus: server.clusterStatus,
          cpu: {
            total: cpuCores > 0 ? cpuCores : "-",
          },
          memory: {
            total: ramTotal > 0 ? ramTotal : "-",
          },
          disk: {
            total: diskTotal > 0 ? diskTotal : "-",
          },
          os: "Ubuntu 22.04", // Default, có thể lấy từ server sau
          updatedAt: server.createdAt || new Date().toISOString(),
        };
      });
    } catch (error: any) {
      console.error("Error fetching servers:", error);
      // Extract error message từ backend response
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể tải danh sách servers";
      throw new Error(errorMessage);
    }
  },
  
  getServer: async (id: string): Promise<Server> => {
    try {
      const response = await api.get(`/servers/${id}`);
      const server = response.data;
      
      // Map từ backend response sang frontend Server type
      const cpuCores = server.cpuCores ? parseInt(server.cpuCores) || 0 : 0;
      // Parse RAM và Disk từ backend (backend trả về GiB)
      const ramTotal = parseSizeToGiB(server.ramTotal);
      const diskTotal = parseSizeToGiB(server.diskTotal);
      const status = server.serverStatus === "RUNNING" ? "online" : "offline";
      
      return {
        id: String(server.id),
        name: server.name,
        ipAddress: server.ip,
        port: server.port || 22,
        username: server.username,
        status: status,
        role: server.role,
        serverStatus: server.serverStatus,
        clusterStatus: server.clusterStatus,
        cpu: {
          total: cpuCores > 0 ? cpuCores : "-",
        },
        memory: {
          total: ramTotal > 0 ? ramTotal : "-",
        },
        disk: {
          total: diskTotal > 0 ? diskTotal : "-",
        },
        os: "Ubuntu 22.04",
        updatedAt: server.createdAt || new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Error fetching server:", error);
      // Extract error message từ backend response
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể lấy thông tin server";
      throw new Error(errorMessage);
    }
  },
  
  createServer: async (data: Omit<Server, "id" | "updatedAt"> & { 
    role?: string; 
    serverStatus?: string; 
    clusterStatus?: string;
  }): Promise<Server> => {
    try {
      // Map từ frontend Server type sang backend CreateServerRequest
      const request = {
        name: data.name,
        ip: data.ipAddress,
        port: data.port || 22,
        username: data.username || "root",
        password: data.password || "",
        role: data.role || "WORKER",
        serverStatus: data.serverStatus || (data.status === "online" ? "RUNNING" : "STOPPED"),
        clusterStatus: data.clusterStatus || "UNAVAILABLE",
      };
      
      const response = await api.post("/servers", request);
      const server = response.data;
      
      // Map response về frontend Server type
      let status: "online" | "offline" | "disabled" = "offline";
      if (server.status === "ONLINE") {
        status = "online";
      } else if (server.status === "DISABLED") {
        status = "disabled";
      } else {
        status = "offline";
      }
      const cpuCores = server.cpuCores ? parseInt(server.cpuCores) || 0 : 0;
      // Parse RAM và Disk từ backend (backend trả về GiB)
      const ramTotal = parseSizeToGiB(server.ramTotal);
      const diskTotal = parseSizeToGiB(server.diskTotal);
      
      return {
        id: String(server.id),
        name: server.name,
        ipAddress: server.ip,
        port: server.port || 22,
        username: server.username,
        status: status,
        role: server.role,
        serverStatus: server.serverStatus,
        clusterStatus: server.clusterStatus,
        cpu: {
          total: cpuCores > 0 ? cpuCores : "-",
        },
        memory: {
          total: ramTotal > 0 ? ramTotal : "-",
        },
        disk: {
          total: diskTotal > 0 ? diskTotal : "-",
        },
        os: data.os || "Ubuntu 22.04",
        updatedAt: server.createdAt || new Date().toISOString(),
    };
    } catch (error: any) {
      console.error("Error creating server:", error);
      // Extract error message từ backend response
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể tạo server";
      throw new Error(errorMessage);
    }
  },
  
  updateServer: async (id: string, data: Partial<Server> & { 
    role?: string; 
    serverStatus?: string; 
    clusterStatus?: string;
  }): Promise<Server> => {
    try {
      // Map từ frontend Server type sang backend UpdateServerRequest
      const request: any = {};
      
      if (data.name !== undefined) request.name = data.name;
      if (data.ipAddress !== undefined) request.ip = data.ipAddress;
      if (data.port !== undefined) request.port = data.port;
      if (data.username !== undefined) request.username = data.username;
      if (data.password !== undefined) request.password = data.password;
      if (data.role !== undefined) request.role = data.role;
      if (data.serverStatus !== undefined) {
        request.serverStatus = data.serverStatus;
      } else if (data.status !== undefined) {
        request.serverStatus = data.status === "online" ? "RUNNING" : "STOPPED";
      }
      if (data.clusterStatus !== undefined) request.clusterStatus = data.clusterStatus;
      
      const response = await api.put(`/servers/${id}`, request);
      const server = response.data;
      
      // Map response về frontend Server type
      const cpuCores = server.cpuCores ? parseInt(server.cpuCores) || 0 : 0;
      // Parse RAM và Disk từ backend (backend trả về GiB)
      const ramTotal = parseSizeToGiB(server.ramTotal);
      const diskTotal = parseSizeToGiB(server.diskTotal);
      
      // Map status từ backend (ONLINE/OFFLINE/DISABLED) sang frontend ("online" | "offline" | "disabled")
      let status: "online" | "offline" | "disabled" = "offline";
      if (server.status) {
          if (server.status === "ONLINE") {
              status = "online";
          } else if (server.status === "DISABLED") {
              status = "disabled";
          } else {
              status = "offline";
          }
      } else {
          status = server.serverStatus === "RUNNING" ? "online" : "offline";
      }
      
      return {
        id: String(server.id),
        name: server.name,
        ipAddress: server.ip,
        port: server.port || 22,
        username: server.username,
        status: status,
        role: server.role,
        serverStatus: server.serverStatus,
        clusterStatus: server.clusterStatus,
        cpu: {
          total: cpuCores > 0 ? cpuCores : "-",
        },
        memory: {
          total: ramTotal > 0 ? ramTotal : "-",
        },
        disk: {
          total: diskTotal > 0 ? diskTotal : "-",
        },
        os: data.os || "Ubuntu 22.04",
        updatedAt: server.createdAt || new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Error updating server:", error);
      // Extract error message từ backend response
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể cập nhật server";
      throw new Error(errorMessage);
    }
  },
  
  deleteServer: async (id: string): Promise<void> => {
    try {
      await api.delete(`/servers/${id}`);
    } catch (error: any) {
      console.error("Error deleting server:", error);
      // Extract error message từ backend response
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể xóa server";
      throw new Error(errorMessage);
    }
  },
  
  // Test SSH connection
  testSsh: async (data: { ip: string; port: number; username: string; password: string }): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post("/servers/test-ssh", {
        ip: data.ip,
        port: data.port,
        username: data.username,
        password: data.password,
      });
      return response.data;
    } catch (error: any) {
      console.error("Error testing SSH:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Kết nối SSH thất bại",
      };
    }
  },
  
  // Kiểm tra và cập nhật trạng thái (status) cho tất cả servers (không có metrics)
  checkAllStatuses: async (): Promise<{ servers: Server[]; message: string }> => {
    try {
      const response = await api.post("/servers/check-status");
      // Backend trả về { servers: [...], message: "..." }
      const serversData = response.data.servers || [];
      return {
        servers: serversData.map((server: any) => {
          const cpuCores = server.cpuCores ? parseInt(server.cpuCores) || 0 : 0;
          const ramTotal = parseSizeToGiB(server.ramTotal);
          const diskTotal = parseSizeToGiB(server.diskTotal);
          let status: "online" | "offline" | "disabled" = "offline";
          if (server.status === "ONLINE") {
            status = "online";
          } else if (server.status === "DISABLED") {
            status = "disabled";
          } else {
            status = "offline";
          }
          
          return {
            id: String(server.id),
            name: server.name,
            ipAddress: server.ip,
            port: server.port || 22,
            username: server.username,
            status: status,
            role: server.role,
            serverStatus: server.serverStatus,
            clusterStatus: server.clusterStatus,
            cpu: {
              total: cpuCores > 0 ? cpuCores : "-",
            },
            memory: {
              total: ramTotal > 0 ? ramTotal : "-",
            },
            disk: {
              total: diskTotal > 0 ? diskTotal : "-",
            },
            os: "Ubuntu 22.04",
            updatedAt: server.createdAt || new Date().toISOString(),
          };
        }),
        message: response.data.message || `Đã kiểm tra và cập nhật trạng thái ${serversData.length} servers`,
      };
    } catch (error: any) {
      console.error("Error checking statuses:", error);
      // Extract error message từ backend response
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể kiểm tra trạng thái";
      throw new Error(errorMessage);
    }
  },

  // Kiểm tra và cập nhật trạng thái (status) và metrics cho tất cả servers
  checkAllServers: async (): Promise<{ servers: Server[]; message: string }> => {
    try {
      const response = await api.post("/servers/check-all");
      // Backend trả về { servers: [...], message: "..." }
      const serversData = response.data.servers || [];
      return {
        servers: serversData.map((server: any) => {
          const cpuCores = server.cpuCores ? parseInt(server.cpuCores) || 0 : 0;
          const ramTotal = parseSizeToGiB(server.ramTotal);
          const diskTotal = parseSizeToGiB(server.diskTotal);
          let status: "online" | "offline" | "disabled" = "offline";
          if (server.status === "ONLINE") {
            status = "online";
          } else if (server.status === "DISABLED") {
            status = "disabled";
          } else {
            status = "offline";
          }
          
          return {
            id: String(server.id),
            name: server.name,
            ipAddress: server.ip,
            port: server.port || 22,
            username: server.username,
            status: status,
            role: server.role,
            serverStatus: server.serverStatus,
            clusterStatus: server.clusterStatus,
            cpu: {
              total: cpuCores > 0 ? cpuCores : "-",
            },
            memory: {
              total: ramTotal > 0 ? ramTotal : "-",
            },
            disk: {
              total: diskTotal > 0 ? diskTotal : "-",
            },
            os: "Ubuntu 22.04",
            updatedAt: server.createdAt || new Date().toISOString(),
          };
        }),
        message: response.data.message || `Đã kiểm tra trạng thái và cập nhật metrics cho ${serversData.length} servers`,
      };
    } catch (error: any) {
      console.error("Error checking all servers:", error);
      // Extract error message từ backend response
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể kiểm tra servers";
      throw new Error(errorMessage);
    }
  },
  
  // Cập nhật trạng thái server (ONLINE/OFFLINE/DISABLED)
  updateServerStatus: async (id: string, status: "ONLINE" | "OFFLINE" | "DISABLED"): Promise<Server> => {
    try {
      const response = await api.put(`/servers/${id}/status`, { status });
      const server = response.data;
      
      const cpuCores = server.cpuCores ? parseInt(server.cpuCores) || 0 : 0;
      // Parse RAM và Disk từ backend (backend trả về GiB)
      const ramTotal = parseSizeToGiB(server.ramTotal);
      const diskTotal = parseSizeToGiB(server.diskTotal);
      let statusMapped: "online" | "offline" | "disabled" = "offline";
      if (server.status === "ONLINE") {
        statusMapped = "online";
      } else if (server.status === "DISABLED") {
        statusMapped = "disabled";
      } else {
        statusMapped = "offline";
      }
      
      return {
        id: String(server.id),
        name: server.name,
        ipAddress: server.ip,
        port: server.port || 22,
        username: server.username,
        status: statusMapped,
        role: server.role,
        serverStatus: server.serverStatus,
        clusterStatus: server.clusterStatus,
        cpu: {
          total: cpuCores > 0 ? cpuCores : "-",
        },
        memory: {
          total: ramTotal > 0 ? ramTotal : "-",
        },
        disk: {
          total: diskTotal > 0 ? diskTotal : "-",
        },
        os: "Ubuntu 22.04",
        updatedAt: server.createdAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error updating server status:", error);
      throw error;
    }
  },

  // Ping server để kiểm tra kết nối
  pingServer: async (id: string, timeoutMs: number = 2000): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post(`/servers/${id}/ping`, { timeoutMs });
      return {
        success: response.data.success,
        message: response.data.message || (response.data.success ? "Server có thể ping được" : "Không thể ping đến server"),
      };
    } catch (error: any) {
      console.error("Error pinging server:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể ping server";
      throw new Error(errorMessage);
    }
  },

  // Reconnect server
  reconnectServer: async (id: string, password?: string): Promise<Server> => {
    try {
      const response = await api.post(`/servers/${id}/reconnect`, { password });
      const server = response.data;
      
      // Map response tương tự như updateServerStatus
      const cpuCores = server.cpuCores ? parseInt(server.cpuCores) || 0 : 0;
      const ramTotal = parseSizeToGiB(server.ramTotal);
      const diskTotal = parseSizeToGiB(server.diskTotal);
      let statusMapped: "online" | "offline" | "disabled" = "offline";
      if (server.status === "ONLINE") {
        statusMapped = "online";
      } else if (server.status === "DISABLED") {
        statusMapped = "disabled";
      } else {
        statusMapped = "offline";
      }
      
      return {
        id: String(server.id),
        name: server.name,
        ipAddress: server.ip,
        port: server.port || 22,
        username: server.username,
        status: statusMapped,
        role: server.role,
        serverStatus: server.serverStatus,
        clusterStatus: server.clusterStatus,
        cpu: {
          total: cpuCores > 0 ? cpuCores : "-",
        },
        memory: {
          total: ramTotal > 0 ? ramTotal : "-",
        },
        disk: {
          total: diskTotal > 0 ? diskTotal : "-",
        },
        os: "Ubuntu 22.04",
        updatedAt: server.createdAt || new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Error reconnecting server:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể reconnect server";
      throw new Error(errorMessage);
    }
  },

  // Disconnect server
  disconnectServer: async (id: string): Promise<Server> => {
    try {
      const response = await api.post(`/servers/${id}/disconnect`);
      const server = response.data;
      
      // Map response tương tự như updateServerStatus
      const cpuCores = server.cpuCores ? parseInt(server.cpuCores) || 0 : 0;
      const ramTotal = parseSizeToGiB(server.ramTotal);
      const diskTotal = parseSizeToGiB(server.diskTotal);
      let statusMapped: "online" | "offline" | "disabled" = "offline";
      if (server.status === "ONLINE") {
        statusMapped = "online";
      } else if (server.status === "DISABLED") {
        statusMapped = "disabled";
      } else {
        statusMapped = "offline";
      }
      
      return {
        id: String(server.id),
        name: server.name,
        ipAddress: server.ip,
        port: server.port || 22,
        username: server.username,
        status: statusMapped,
        role: server.role,
        serverStatus: server.serverStatus,
        clusterStatus: server.clusterStatus,
        cpu: {
          total: cpuCores > 0 ? cpuCores : "-",
        },
        memory: {
          total: ramTotal > 0 ? ramTotal : "-",
        },
        disk: {
          total: diskTotal > 0 ? diskTotal : "-",
        },
        os: "Ubuntu 22.04",
        updatedAt: server.createdAt || new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Error disconnecting server:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể disconnect server";
      throw new Error(errorMessage);
    }
  },

  // Execute command on server (CLI)
  execCommand: async (id: string, command: string, timeoutMs: number = 10000): Promise<{ success: boolean; output: string; message: string }> => {
    try {
      const response = await api.post(`/servers/${id}/exec`, { command, timeoutMs });
      return response.data;
    } catch (error: any) {
      console.error("Error executing command:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể thực thi command";
      throw new Error(errorMessage);
    }
  },

  // Shutdown server
  shutdownServer: async (id: string): Promise<{ success: boolean; message: string; output: string }> => {
    try {
      const response = await api.post(`/servers/${id}/shutdown`);
      return response.data;
    } catch (error: any) {
      console.error("Error shutting down server:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể shutdown server";
      throw new Error(errorMessage);
    }
  },

  // Restart server
  restartServer: async (id: string): Promise<{ success: boolean; message: string; output: string }> => {
    try {
      const response = await api.post(`/servers/${id}/restart`);
      return response.data;
    } catch (error: any) {
      console.error("Error restarting server:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể restart server";
      throw new Error(errorMessage);
    }
  },

  // ==================== Clusters ====================

  /**
   * Lấy thông tin cluster thật từ backend
   * @returns ClusterInfoResponse với nodeCount, status, version
   */
  getClusterInfo: async (): Promise<{
    nodeCount: number;
    status: "healthy" | "unhealthy";
    version: string;
  }> => {
    try {
      const response = await api.get("/admin/cluster/info");
      return response.data;
    } catch (error: any) {
      console.error("Error getting cluster info:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể lấy thông tin cluster";
      throw new Error(errorMessage);
    }
  },

  getCluster: async (): Promise<Cluster | null> => {
    try {
      // Lấy tất cả servers để tính serverIds và serverRoles trước
      const servers = await infrastructureAPI.getServers();
      
      // Lọc servers có clusterStatus = "AVAILABLE" và role MASTER/WORKER
      const clusterServers = servers.filter(
        (s) => s.clusterStatus === "AVAILABLE" && (s.role === "MASTER" || s.role === "WORKER")
      );
      
      // Nếu không có server nào trong cluster, trả về null
      if (clusterServers.length === 0) {
        return null;
      }
      
      // Lấy thông tin cluster thật từ backend (chỉ khi có servers)
      let clusterInfo;
      try {
        clusterInfo = await infrastructureAPI.getClusterInfo();
      } catch (error: any) {
        console.warn("Could not get cluster info from backend, using defaults:", error);
        // Nếu không lấy được cluster info, sử dụng giá trị mặc định
        clusterInfo = {
          nodeCount: clusterServers.length,
          status: "unhealthy" as const,
          version: "Unknown",
        };
      }
      
      // Tạo cluster object từ servers và cluster info
      const serverIds = clusterServers.map((s) => s.id);
      const serverRoles: Record<string, "master" | "worker"> = {};
      clusterServers.forEach((s) => {
        const role = s.role?.toLowerCase() || "worker";
        serverRoles[s.id] = (role === "master" ? "master" : "worker") as "master" | "worker";
      });
      
      return {
        id: "1", // Cluster duy nhất có ID = "1"
        name: "", // Không có tên cluster (chỉ có 1 cụm)
        version: clusterInfo.version || "Unknown",
        nodeCount: clusterInfo.nodeCount || clusterServers.length,
        status: (clusterInfo.status === "healthy" ? "healthy" : "unhealthy") as "healthy" | "unhealthy",
        provider: "local" as const,
        serverIds,
        serverRoles,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error getting cluster:", error);
      return null;
    }
  },

  createCluster: async (data: Omit<Cluster, "id" | "createdAt">): Promise<Cluster> => {
    try {
      // Kiểm tra xem đã có cluster chưa (có servers với clusterStatus = "AVAILABLE")
      const existingCluster = await infrastructureAPI.getCluster();
      if (existingCluster) {
        throw new Error("Đã có cluster, chỉ được phép quản lý 1 cluster. Vui lòng sử dụng trang Assign Servers để quản lý.");
      }
      
      // Assign servers vào cluster (set clusterStatus = "AVAILABLE")
      const updates = data.serverIds.map((serverId) => ({
        serverId,
        role: data.serverRoles[serverId]?.toUpperCase() || "WORKER",
      }));
      
      await infrastructureAPI.assignServersToCluster(updates);
      
      // Trả về cluster mới được tạo
      return await infrastructureAPI.getCluster() as Cluster;
    } catch (error: any) {
      const errorMessage = error.message || "Không thể tạo cluster";
      throw new Error(errorMessage);
    }
  },

  updateCluster: async (data: Partial<Cluster>): Promise<Cluster> => {
    // Cluster được quản lý thông qua clusterStatus của servers
    // Không có API riêng để update cluster, chỉ update servers
    throw new Error("Không hỗ trợ update cluster. Vui lòng sử dụng assign/unassign servers.");
  },

  deleteCluster: async (): Promise<void> => {
    // Cluster được quản lý thông qua clusterStatus của servers
    // Để xóa cluster, cần unassign tất cả servers (set clusterStatus = "UNAVAILABLE")
    throw new Error("Không hỗ trợ xóa cluster. Vui lòng unassign tất cả servers khỏi cluster.");
  },

  // Assign Servers to Cluster
  assignServersToCluster: async (updates: Array<{ serverId: string; role: string }>): Promise<void> => {
    try {
      await api.post("/cluster/assign", { updates });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể gán servers vào cluster";
      throw new Error(errorMessage);
    }
  },

  updateServerRoles: async (updates: Array<{ serverId: string; role: string }>): Promise<void> => {
    try {
      await api.post("/cluster/update-roles", { updates });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể cập nhật role";
      throw new Error(errorMessage);
    }
  },

  unassignServersFromCluster: async (serverIds: string[]): Promise<void> => {
    try {
      await api.post("/cluster/unassign", { serverIds });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể bỏ servers khỏi cluster";
      throw new Error(errorMessage);
    }
  },

  // ==================== Ansible Installation & Management (Mock Data) ====================

  /**
   * Kiểm tra trạng thái Ansible từ backend
   * @returns Trạng thái cài đặt Ansible trên controller server
   */
  checkAnsibleStatus: async (): Promise<{
    installed: boolean;
    version?: string;
    controllerHost?: string;
    controllerRole?: "ANSIBLE" | "MASTER";
    error?: string;
  }> => {
    try {
      const response = await api.get("/admin/ansible/status");
      const data = response.data;
      
      return {
        installed: data.installed || false,
        version: data.version || undefined,
        controllerHost: data.controllerHost || undefined,
        controllerRole: (data.controllerRole === "ANSIBLE" || data.controllerRole === "MASTER") 
          ? data.controllerRole as "ANSIBLE" | "MASTER"
          : undefined,
        error: data.error || undefined,
      };
    } catch (error: any) {
      console.error("Error checking Ansible status:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể kiểm tra trạng thái Ansible";
      return {
        installed: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Cài đặt Ansible trên máy controller cụ thể
   * @param controllerHost IP address của controller (optional)
   * @param sudoPassword Sudo password của máy controller
   * @returns Task ID để theo dõi quá trình cài đặt
   */
  installAnsible: async (
    controllerHost: string | undefined,
    sudoPassword: string
  ): Promise<{ taskId: string; message: string }> => {
    try {
      const response = await api.post("/admin/ansible/install", {
        controllerHost: controllerHost || null,
        sudoPassword: sudoPassword || null,
      });
      return {
        taskId: response.data.taskId || `ansible-install-${Date.now()}`,
        message: response.data.message || "Đã bắt đầu cài đặt Ansible",
      };
    } catch (error: any) {
      console.error("Error installing Ansible:", error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          "Không thể cài đặt Ansible";
      throw new Error(errorMessage);
    }
  },

  /**
   * Cài đặt lại Ansible trên máy controller cụ thể
   * @param controllerHost IP address của controller (optional)
   * @param sudoPassword Sudo password của máy controller
   * @returns Task ID để theo dõi quá trình cài đặt lại
   */
  reinstallAnsible: async (
    controllerHost: string | undefined,
    sudoPassword: string
  ): Promise<{ taskId: string; message: string }> => {
    try {
      const response = await api.post("/admin/ansible/reinstall", {
        controllerHost: controllerHost || null,
        sudoPassword: sudoPassword || null,
      });
      return {
        taskId: response.data.taskId || `ansible-reinstall-${Date.now()}`,
        message: response.data.message || "Đã bắt đầu cài đặt lại Ansible",
      };
    } catch (error: any) {
      console.error("Error reinstalling Ansible:", error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          "Không thể cài đặt lại Ansible";
      throw new Error(errorMessage);
    }
  },

  /**
   * Gỡ Ansible khỏi máy controller cụ thể
   * @param controllerHost IP address của controller (optional)
   * @param sudoPassword Sudo password của máy controller
   * @returns Task ID để theo dõi quá trình gỡ cài đặt
   */
  uninstallAnsible: async (
    controllerHost: string | undefined,
    sudoPassword: string
  ): Promise<{ taskId: string; message: string }> => {
    try {
      const response = await api.post("/admin/ansible/uninstall", {
        controllerHost: controllerHost || null,
        sudoPassword: sudoPassword || null,
      });
      return {
        taskId: response.data.taskId || `ansible-uninstall-${Date.now()}`,
        message: response.data.message || "Đã bắt đầu gỡ Ansible",
      };
    } catch (error: any) {
      console.error("Error uninstalling Ansible:", error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          "Không thể gỡ Ansible";
      throw new Error(errorMessage);
    }
  },

  /**
   * Kiểm tra trạng thái xác thực của server (SSH key và sudo NOPASSWD)
   * @param serverId Server ID
   * @returns Trạng thái xác thực của server
   */
  checkServerAuthStatus: async (serverId: number): Promise<{
    hasSshKey: boolean;
    hasSudoNopasswd: boolean | null;
    needsPassword: boolean;
    authMethod: string;
    error?: string;
  }> => {
    try {
      const response = await api.get("/admin/server/auth-status", {
        params: { serverId },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error checking server auth status:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Không thể kiểm tra trạng thái xác thực";
      throw new Error(errorMessage);
    }
  },

  /**
   * Kiểm tra trạng thái Docker trên server có role=DOCKER
   */
  checkDockerStatus: async (): Promise<{
    installed: boolean;
    version?: string;
    dockerHost?: string;
    dockerRole?: string;
    error?: string;
  }> => {
    try {
      const response = await api.get("/install/docker/status");
      return response.data;
    } catch (error: any) {
      console.error("Error checking Docker status:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Không thể kiểm tra trạng thái Docker";
      throw new Error(errorMessage);
    }
  },

  // ==================== Init Ansible (4 steps) ====================

  /**
   * Init Ansible Step 1: Tạo cấu trúc thư mục
   * @param controllerHost IP address của controller (optional)
   * @param sudoPassword Sudo password (optional)
   * @returns Task ID và message
   */
  initAnsibleStep1: async (
    controllerHost: string | undefined,
    sudoPassword?: string
  ): Promise<{ taskId: string; message: string; success: boolean }> => {
    try {
      const response = await api.post("/admin/ansible/init/step1", {
        controllerHost: controllerHost || null,
        sudoPassword: sudoPassword || null,
      });
      return {
        taskId: response.data.taskId || `ansible-init-step1-${Date.now()}`,
        message: response.data.message || "Đã hoàn thành bước 1",
        success: response.data.success !== false,
      };
    } catch (error: any) {
      console.error("Error initializing Ansible step 1:", error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          "Không thể thực hiện bước 1";
      throw new Error(errorMessage);
    }
  },

  /**
   * Init Ansible Step 2: Ghi cấu hình mặc định
   * @param controllerHost IP address của controller (optional)
   * @param sudoPassword Sudo password (optional)
   * @param ansibleCfg Ansible config content
   * @param ansibleInventory Ansible inventory content
   * @param ansibleVars Ansible variables content
   * @returns Task ID và message
   */
  initAnsibleStep2: async (
    controllerHost: string | undefined,
    ansibleCfg: string,
    ansibleInventory: string,
    ansibleVars: string,
    sudoPassword?: string
  ): Promise<{ taskId: string; message: string; success: boolean }> => {
    try {
      const response = await api.post("/admin/ansible/init/step2", {
        controllerHost: controllerHost || null,
        sudoPassword: sudoPassword || null,
        ansibleCfg,
        ansibleInventory,
        ansibleVars,
      });
      return {
        taskId: response.data.taskId || `ansible-init-step2-${Date.now()}`,
        message: response.data.message || "Đã hoàn thành bước 2",
        success: response.data.success !== false,
      };
    } catch (error: any) {
      console.error("Error initializing Ansible step 2:", error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          "Không thể thực hiện bước 2";
      throw new Error(errorMessage);
    }
  },

  /**
   * Init Ansible Step 3: Phân phối SSH key
   * @param controllerHost IP address của controller (optional)
   * @param serverIds Danh sách server IDs
   * @param sudoPassword Sudo password (optional)
   * @returns Task ID và message
   */
  initAnsibleStep3: async (
    controllerHost: string | undefined,
    serverIds: string[],
    sudoPassword?: string
  ): Promise<{ taskId: string; message: string; success: boolean }> => {
    try {
      const response = await api.post("/admin/ansible/init/step3", {
        controllerHost: controllerHost || null,
        sudoPassword: sudoPassword || null,
        serverIds: serverIds.map(id => parseInt(id)),
      });
      return {
        taskId: response.data.taskId || `ansible-init-step3-${Date.now()}`,
        message: response.data.message || "Đã hoàn thành bước 3",
        success: response.data.success !== false,
      };
    } catch (error: any) {
      console.error("Error initializing Ansible step 3:", error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          "Không thể thực hiện bước 3";
      throw new Error(errorMessage);
    }
  },

  /**
   * Init Ansible Step 4: Ping nodes
   * @param controllerHost IP address của controller (optional)
   * @param serverIds Danh sách server IDs
   * @returns Task ID và message
   */
  initAnsibleStep4: async (
    controllerHost: string | undefined,
    serverIds: string[]
  ): Promise<{ taskId: string; message: string; success: boolean }> => {
    try {
      const response = await api.post("/admin/ansible/init/step4", {
        controllerHost: controllerHost || null,
        serverIds: serverIds.map(id => parseInt(id)),
      });
      return {
        taskId: response.data.taskId || `ansible-init-step4-${Date.now()}`,
        message: response.data.message || "Đã hoàn thành bước 4",
        success: response.data.success !== false,
      };
    } catch (error: any) {
      console.error("Error initializing Ansible step 4:", error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          "Không thể thực hiện bước 4";
      throw new Error(errorMessage);
    }
  },

  // ==================== Config Ansible ====================

  /**
   * Đọc cấu hình Ansible từ server
   * @param controllerHost IP address của controller (optional)
   * @returns AnsibleConfigResponse chứa nội dung các file cấu hình
   */
  getAnsibleConfig: async (
    controllerHost?: string
  ): Promise<{
    success: boolean;
    controllerHost?: string;
    ansibleCfg: string;
    ansibleInventory: string;
    ansibleVars: string;
    error?: string;
  }> => {
    try {
      const response = await api.get("/install/ansible/config");
      return {
        success: response.data.success !== false,
        controllerHost: response.data.controllerHost,
        ansibleCfg: response.data.ansibleCfg || "",
        ansibleInventory: response.data.ansibleInventory || "",
        ansibleVars: response.data.ansibleVars || "",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error getting Ansible config:", error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          "Không thể lấy cấu hình Ansible";
      throw new Error(errorMessage);
    }
  },

  /**
   * Verify Ansible configuration on the controller
   * @param controllerHost IP address của controller (optional)
   * @param ansibleCfg Nội dung file ansible.cfg
   * @param ansibleInventory Nội dung inventory
   * @param ansibleVars Nội dung group_vars/all.yml
   */
  verifyAnsibleConfig: async (
    controllerHost: string | undefined,
    ansibleCfg: string,
    ansibleInventory: string,
    ansibleVars: string
  ): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const response = await api.post("/admin/ansible/config/verify", {
        controllerHost: controllerHost || null,
        ansibleCfg,
        ansibleInventory,
        ansibleVars,
      });
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã kiểm tra cấu hình Ansible",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error verifying Ansible config:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể kiểm tra cấu hình Ansible";
      throw new Error(errorMessage);
    }
  },

  /**
   * Save Ansible configuration to controller
   * @param controllerHost IP address controller
   * @param ansibleCfg Nội dung file ansible.cfg
   * @param ansibleInventory Nội dung inventory
   * @param ansibleVars Nội dung group_vars/all.yml
   * @param sudoPassword Sudo password (optional)
   */
  saveAnsibleConfig: async (
    controllerHost: string | undefined,
    ansibleCfg: string,
    ansibleInventory: string,
    ansibleVars: string,
    sudoPassword?: string
  ): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const response = await api.post("/install/ansible/config", {
        controllerHost: controllerHost || null,
        ansibleCfg,
        ansibleInventory,
        ansibleVars,
        sudoPassword: sudoPassword || null,
      });
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã lưu cấu hình Ansible",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error saving Ansible config:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể lưu cấu hình Ansible";
      throw new Error(errorMessage);
    }
  },

  /**
   * Regenerate ansible.cfg và hosts.ini từ server list
   */
  updateAnsibleConfig: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const response = await api.post("/install/ansible/config/regenerate");
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã cập nhật cấu hình Ansible",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error updating Ansible config:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể cập nhật cấu hình Ansible";
      throw new Error(errorMessage);
    }
  },

  /**
   * Lấy trạng thái thực thi của quá trình init Ansible
   * @param taskId Task ID nhận được khi gọi init step
   */
  getAnsibleInitStatus: async (
    taskId: string
  ): Promise<{
    success: boolean;
    taskId: string;
    status: string;
    progress?: number;
    logs?: string;
    startTime?: number;
    endTime?: number;
    error?: string;
  }> => {
    try {
      const response = await api.get("/admin/ansible/init/status", {
        params: { taskId },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error getting init task status:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể lấy trạng thái task";
      throw new Error(errorMessage);
    }
  },

  // ==================== Playbook ====================

  getPlaybooks: async (
    controllerHost?: string
  ): Promise<{ playbooks: Array<{ name: string; content: string; size?: number }>; total: number }> => {
    try {
      const response = await api.get("/admin/ansible/playbooks", {
        params: controllerHost ? { controllerHost } : {},
      });
      return {
        playbooks: response.data.playbooks || [],
        total: response.data.total ?? response.data.playbooks?.length ?? 0,
      };
    } catch (error: any) {
      console.error("Error getting playbooks:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể tải danh sách playbook";
      throw new Error(errorMessage);
    }
  },

  savePlaybook: async (payload: {
    controllerHost: string;
    filename: string;
    content: string;
    sudoPassword?: string;
  }): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const response = await api.post("/admin/ansible/playbooks/save", {
        controllerHost: payload.controllerHost || null,
        filename: payload.filename,
        content: payload.content,
        sudoPassword: payload.sudoPassword || null,
      });
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã lưu playbook",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error saving playbook:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể lưu playbook";
      throw new Error(errorMessage);
    }
  },

  deletePlaybook: async (payload: {
    controllerHost: string;
    filename: string;
    sudoPassword?: string;
  }): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const response = await api.post("/admin/ansible/playbooks/delete", {
        controllerHost: payload.controllerHost || null,
        filename: payload.filename,
        sudoPassword: payload.sudoPassword || null,
      });
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã xóa playbook",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error deleting playbook:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể xóa playbook";
      throw new Error(errorMessage);
    }
  },

  uploadPlaybookFile: async (payload: {
    controllerHost: string;
    file: File;
    sudoPassword?: string;
  }): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const formData = new FormData();
      formData.append("file", payload.file);
      if (payload.controllerHost) {
        formData.append("controllerHost", payload.controllerHost);
      }
      if (payload.sudoPassword) {
        formData.append("sudoPassword", payload.sudoPassword);
      }

      const response = await api.post("/admin/ansible/playbooks/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã tải lên playbook",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error uploading playbook:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể tải lên playbook";
      throw new Error(errorMessage);
    }
  },

  executePlaybook: async (payload: {
    controllerHost: string;
    filename: string;
    sudoPassword?: string;
    extraVars?: string;
  }): Promise<{ success: boolean; message: string; error?: string; taskId?: string }> => {
    try {
      const response = await api.post("/admin/ansible/playbooks/execute", {
        controllerHost: payload.controllerHost || null,
        filename: payload.filename,
        sudoPassword: payload.sudoPassword || null,
        extraVars: payload.extraVars || null,
      });
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã thực thi playbook",
        error: response.data.error,
        taskId: response.data.taskId,
      };
    } catch (error: any) {
      console.error("Error executing playbook:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể thực thi playbook";
      throw new Error(errorMessage);
    }
  },
  
  getPlaybookExecutionStatus: async (
    taskId: string
  ): Promise<{
    success: boolean;
    taskId: string;
    status: string;
    progress?: number;
    logs?: string;
    startTime?: number;
    endTime?: number;
    error?: string;
  }> => {
    try {
      const response = await api.get("/admin/ansible/playbooks/status", {
        params: { taskId },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error getting playbook task status:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể lấy trạng thái thực thi playbook";
      throw new Error(errorMessage);
    }
  },

  // ==================== K8s Install ====================

  installK8sTab1: async (payload: {
    controllerHost: string;
    sudoPassword?: string;
    k8sVersion?: string;
    podNetworkCidr?: string;
    serviceCidr?: string;
    containerRuntime?: string;
  }): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const response = await api.post("/admin/k8s/install/tab1", {
        controllerHost: payload.controllerHost || null,
        sudoPassword: payload.sudoPassword || null,
        k8sVersion: payload.k8sVersion,
        podNetworkCidr: payload.podNetworkCidr,
        serviceCidr: payload.serviceCidr,
        containerRuntime: payload.containerRuntime,
      });
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã thực thi Tab 1",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error installing K8s tab 1:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể chạy Tab 1";
      throw new Error(errorMessage);
    }
  },

  installK8sTab2: async (payload: {
    controllerHost: string;
    sudoPassword?: string;
    k8sVersion?: string;
    podNetworkCidr?: string;
    serviceCidr?: string;
    containerRuntime?: string;
  }): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const response = await api.post("/admin/k8s/install/tab2", {
        controllerHost: payload.controllerHost || null,
        sudoPassword: payload.sudoPassword || null,
        k8sVersion: payload.k8sVersion,
        podNetworkCidr: payload.podNetworkCidr,
        serviceCidr: payload.serviceCidr,
        containerRuntime: payload.containerRuntime,
      });
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã thực thi Tab 2",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error installing K8s tab 2:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể chạy Tab 2";
      throw new Error(errorMessage);
    }
  },

  installK8sTab3: async (payload: {
    controllerHost: string;
    sudoPassword?: string;
    k8sVersion?: string;
    podNetworkCidr?: string;
    serviceCidr?: string;
    containerRuntime?: string;
    masterNodeIp: string;
    workerNodeIps: string[];
  }): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const response = await api.post("/admin/k8s/install/tab3", {
        controllerHost: payload.controllerHost || null,
        sudoPassword: payload.sudoPassword || null,
        k8sVersion: payload.k8sVersion,
        podNetworkCidr: payload.podNetworkCidr,
        serviceCidr: payload.serviceCidr,
        containerRuntime: payload.containerRuntime,
        masterNodeIp: payload.masterNodeIp,
        workerNodeIps: payload.workerNodeIps,
      });
      return {
        success: response.data.success !== false,
        message: response.data.message || "Đã thực thi Tab 3",
        error: response.data.error,
      };
    } catch (error: any) {
      console.error("Error installing K8s tab 3:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Không thể chạy Tab 3";
      throw new Error(errorMessage);
    }
  },
};

