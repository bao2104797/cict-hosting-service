/**
 * API cho Admin Dashboard - Gọi API thật từ backend
 */

import api from "@/services/api";
import { infrastructureAPI } from "@/lib/infrastructure-api";
import type {
  Server,
  Cluster,
  Node,
  Namespace,
  Deployment,
  DeploymentDetail,
  Pod,
  PodDetail,
  Statefulset,
  StatefulsetDetail,
  Service,
  ServiceDetail,
  Ingress,
  PVC,
  PVCDetail,
  PV,
  PVDetail,
  DashboardMetrics,
  AdminUser,
  AdminUserProject,
  AdminProjectDetail,
  AdminAccount,
  AdminOverviewResponse,
  AdminUserUsageResponse,
  ClusterCapacityResponse,
  ClusterAllocatableResponse,
  AdminUserProjectSummaryResponse,
  AdminUserProjectListResponse,
  AdminProjectResourceDetailResponse,
  AdminDatabaseDetailResponse,
  AdminBackendDetailResponse,
  AdminFrontendDetailResponse,
  AdminReplicaRequest,
} from "@/types/admin";

const buildScopedId = (namespace: string, name: string) => `${namespace}/${name}`;

const parseScopedId = (id: string, fallbackNamespace = "default") => {
  if (!id) {
    return { namespace: fallbackNamespace, name: "" };
  }
  if (id.includes("/")) {
    const [namespace, ...rest] = id.split("/");
    return { namespace: namespace || fallbackNamespace, name: rest.join("/") || "" };
  }
  const lastDash = id.lastIndexOf("-");
  if (lastDash > 0) {
    return {
      namespace: id.substring(lastDash + 1) || fallbackNamespace,
      name: id.substring(0, lastDash),
    };
  }
  return { namespace: fallbackNamespace, name: id };
};

// Helper functions để map data từ API response

const mapServerApiResponse = (raw: any): Server => {
  const serverStatus = typeof raw?.serverStatus === "string" ? raw.serverStatus.toUpperCase() : "";
  const isOnline = serverStatus === "RUNNING" || serverStatus === "ONLINE";
  const id =
    raw?.id !== undefined
      ? String(raw.id)
      : raw?.name
      ? String(raw.name)
      : String(Date.now() + Math.random());

  // Map CPU: backend trả về { used: number, total: number } với used là số cores đang dùng
  // Frontend cần hiển thị dưới dạng cores
  const cpuData = raw?.cpu;
  const cpuUsed = cpuData?.used ?? 0;
  const cpuTotal = cpuData?.total ?? 0;

  // Map Memory: backend trả về { used: number, total: number } theo GB
  const memoryData = raw?.memory;
  const memoryUsed = memoryData?.used ?? 0;
  const memoryTotal = memoryData?.total ?? 0;

  // Map Disk: backend trả về { used: number, total: number } theo GB
  const diskData = raw?.disk;
  const diskUsed = diskData?.used ?? 0;
  const diskTotal = diskData?.total ?? 0;

  return {
    id,
    name: raw?.name ?? `server-${id}`,
    ipAddress: raw?.ip ?? raw?.ipAddress ?? "0.0.0.0",
    port: raw?.port ?? raw?.sshPort ?? 22,
    username: raw?.username ?? undefined,
    password: undefined,
    role: typeof raw?.role === "string" ? raw.role.toUpperCase() : undefined,
    status: isOnline ? "online" : "offline",
    cpu: { used: Math.round(cpuUsed * 100) / 100, total: cpuTotal },
    memory: { used: Math.round(memoryUsed * 100) / 100, total: memoryTotal },
    disk: { used: Math.round(diskUsed * 100) / 100, total: diskTotal },
    os: raw?.os ?? "Linux",
    updatedAt: raw?.createdAt ?? raw?.updatedAt ?? new Date().toISOString(),
    clusterStatus: raw?.clusterStatus ?? "UNASSIGNED",
  };
};

// Helper functions để xử lý YAML
function extractYamlValue(yaml: string, regex: RegExp, fallback = ""): string {
  const match = yaml.match(regex);
  return match ? match[1].trim() : fallback;
}

function extractYamlList(yaml: string, regex: RegExp): string[] {
  return Array.from(yaml.matchAll(regex)).map((match) => match[1].trim());
}

// Chỉ quản lý 1 cluster duy nhất (được quản lý bởi infrastructureAPI)
let currentCluster: Cluster | null = null;

// Các helper functions để normalize và map data
const normalizeReplicaStatus = (status?: string) => {
  if (!status) return undefined;
  const upper = status.toUpperCase();
  return upper === "ALL" ? undefined : upper;
};

const toDateString = (value: any) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value);
};

const normalizeAccountRole = (value: any): AdminAccount["role"] => {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  return upper === "ADMIN" || upper === "DEVOPS" ? upper : "USER";
};

const normalizeAccountTier = (value: any): AdminAccount["tier"] => {
  const lower = typeof value === "string" ? value.toLowerCase() : "";
  return lower === "premium" ? "premium" : "standard";
};

const normalizeAccountStatus = (value: any): AdminAccount["status"] => {
  const lower = typeof value === "string" ? value.toLowerCase() : "";
  if (lower === "active" || lower === "inactive") {
    return lower;
  }
  return "pending";
};

const mapUserSummaryToAdminAccount = (raw: any): AdminAccount => {
  const fallbackId = raw?.id ?? raw?.userId ?? Math.floor(Math.random() * 1_000_000);
  return {
    id: String(fallbackId),
    name: raw?.name ?? raw?.fullname ?? raw?.username ?? "Không xác định",
    username: raw?.username ?? "",
    email: raw?.email ?? null,
    role: normalizeAccountRole(raw?.role),
    tier: normalizeAccountTier(raw?.tier),
    status: normalizeAccountStatus(raw?.status),
    projectCount: Number(raw?.projectCount ?? 0) || 0,
    services: Number(raw?.services ?? raw?.serviceCount ?? 0) || 0,
    createdAt: toDateString(raw?.createdAt) || "",
    lastLogin: raw?.lastLogin ? toDateString(raw?.lastLogin) : null,
  };
};

const mapBackendReplicaRequest = (raw: any): AdminReplicaRequest => ({
  id: raw.id,
  componentId: raw.backendId,
  componentType: "BACKEND",
  componentName: raw.backendName || "",
  projectName: raw.projectName || "",
  username: raw.username || "",
  oldReplicas: raw.oldReplicas ?? 0,
  newReplicas: raw.newReplicas ?? 0,
  status: raw.status || "PENDING",
  reasonReject: raw.reasonReject || undefined,
  createdAt: toDateString(raw.createdAt),
});

const mapFrontendReplicaRequest = (raw: any): AdminReplicaRequest => ({
  id: raw.id,
  componentId: raw.frontendId,
  componentType: "FRONTEND",
  componentName: raw.frontendName || "",
  projectName: raw.projectName || "",
  username: raw.username || "",
  oldReplicas: raw.oldReplicas ?? 0,
  newReplicas: raw.newReplicas ?? 0,
  status: raw.status || "PENDING",
  reasonReject: raw.reasonReject || undefined,
  createdAt: toDateString(raw.createdAt),
});

// API functions
export const adminAPI = {
  // Dashboard
  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const response = await api.get("/admin/dashboard/metrics");
    const data = response.data;
    // Map từ backend response sang frontend type
    return {
      nodes: {
        total: data.nodes?.total || 0,
        healthy: data.nodes?.healthy || 0,
        unhealthy: data.nodes?.unhealthy || 0,
      },
      pods: {
        total: data.pods?.total || 0,
        running: data.pods?.running || 0,
        pending: data.pods?.pending || 0,
        failed: data.pods?.failed || 0,
      },
      deployments: {
        total: data.deployments?.total || 0,
        active: data.deployments?.active || 0,
        error: data.deployments?.error || 0,
      },
      cpuUsage: {
        used: data.cpuUsage?.used || 0,
        total: data.cpuUsage?.total || 0,
      },
      memoryUsage: {
        used: data.memoryUsage?.used || 0,
        total: data.memoryUsage?.total || 0,
      },
    };
  },

  // Servers - Sử dụng infrastructureAPI
  getServers: infrastructureAPI.getServers,
  getClusterServers: async (): Promise<Server[]> => {
    try {
      const response = await api.get("/servers/cluster");
      const data = Array.isArray(response.data) ? response.data : [];
      if (data.length === 0) {
        return [];
      }
      return data.map(mapServerApiResponse);
    } catch (error) {
      console.error("Không thể tải danh sách server trong cluster", error);
      return [];
    }
  },
  getServer: infrastructureAPI.getServer,
  createServer: infrastructureAPI.createServer,
  updateServer: infrastructureAPI.updateServer,
  deleteServer: infrastructureAPI.deleteServer,

  // Clusters - chỉ quản lý 1 cluster
  getCluster: async (): Promise<Cluster | null> => {
    // Sử dụng infrastructureAPI.getCluster() để lấy thông tin cluster thật từ backend
    return await infrastructureAPI.getCluster();
  },
  createCluster: async (data: Omit<Cluster, "id" | "createdAt">): Promise<Cluster> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (currentCluster) {
      throw new Error("Đã có cluster, chỉ được phép quản lý 1 cluster");
    }
    const newCluster: Cluster = {
      ...data,
      id: "1",
      createdAt: new Date().toISOString(),
    };
    currentCluster = newCluster;
    return newCluster;
  },
  updateCluster: async (data: Partial<Cluster>): Promise<Cluster> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (!currentCluster) throw new Error("Cluster not found");
    currentCluster = { ...currentCluster, ...data };
    return currentCluster;
  },
  deleteCluster: async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    currentCluster = null;
  },

  // Nodes
  getNodes: async (): Promise<Node[]> => {
    const response = await api.get("/admin/cluster/nodes");
    const nodeListResponse = response.data;
    
    // Map từ backend response sang frontend type
    return nodeListResponse.nodes.map((node: any) => ({
      id: node.id || node.name,
      name: node.name,
      ip: node.ip || undefined,
      status: node.status === "ready" ? "ready" : 
              node.status === "NOT_ASSIGN" ? "NOT_ASSIGN" : 
              node.status === "NOT_JOIN_K8S" ? "NOT_JOIN_K8S" : "notready",
      role: node.role === "master" ? "master" : "worker",
      cpu: {
        requested: node.cpu?.requested || 0,
        limit: node.cpu?.limit || 0,
        capacity: node.cpu?.capacity || 0,
      },
      memory: {
        requested: node.memory?.requested || 0,
        limit: node.memory?.limit || 0,
        capacity: node.memory?.capacity || 0,
      },
      disk: {
        requested: node.disk?.requested || 0,
        limit: node.disk?.limit || 0,
        capacity: node.disk?.capacity || 0,
      },
      podCount: node.podCount || 0,
      os: node.os || "Unknown",
      kernel: node.kernel || "Unknown",
      updatedAt: node.updatedAt || "",
      kubeletVersion: node.kubeletVersion || "Unknown",
      containerRuntime: node.containerRuntime || "Unknown",
      labels: node.labels || {},
      pods: node.pods || [],
      yaml: node.yaml || "",
      notAssignAction: node.notAssignAction || undefined,
    }));
  },
  joinNodeToK8s: async (serverId: string): Promise<void> => {
    await api.post(`/admin/cluster/nodes/join/${serverId}`);
  },
  removeNodeFromK8s: async (nodeName: string, ip?: string): Promise<void> => {
    const url = ip 
      ? `/admin/cluster/nodes/${nodeName}?ip=${encodeURIComponent(ip)}`
      : `/admin/cluster/nodes/${nodeName}`;
    await api.delete(url);
  },
  getNode: async (id: string): Promise<Node> => {
    const response = await api.get(`/admin/cluster/nodes/${id}`);
    const node = response.data;
    return {
      id: node.id || node.name,
      name: node.name,
      ip: node.ip || undefined,
      status: node.status === "ready" ? "ready" : 
              node.status === "NOT_ASSIGN" ? "NOT_ASSIGN" : 
              node.status === "NOT_JOIN_K8S" ? "NOT_JOIN_K8S" : "notready",
      role: node.role === "master" ? "master" : "worker",
      cpu: {
        requested: node.cpu?.requested || 0,
        limit: node.cpu?.limit || 0,
        capacity: node.cpu?.capacity || 0,
      },
      memory: {
        requested: node.memory?.requested || 0,
        limit: node.memory?.limit || 0,
        capacity: node.memory?.capacity || 0,
      },
      disk: {
        requested: node.disk?.requested || 0,
        limit: node.disk?.limit || 0,
        capacity: node.disk?.capacity || 0,
      },
      podCount: node.podCount || 0,
      os: node.os || "Unknown",
      kernel: node.kernel || "Unknown",
      updatedAt: node.updatedAt || "",
      kubeletVersion: node.kubeletVersion || "Unknown",
      containerRuntime: node.containerRuntime || "Unknown",
      labels: node.labels || {},
      pods: node.pods || [],
      yaml: node.yaml || "",
      notAssignAction: node.notAssignAction || undefined,
    };
  },

  // Namespaces
  getNamespaces: async (): Promise<Namespace[]> => {
    const response = await api.get("/admin/cluster/namespaces");
    const namespaceListResponse = response.data;
    
    // Map từ backend response sang frontend type
    // Chỉ lấy các trường cần thiết cho bảng: Tên, Status, Pods, CPU, RAM, Age
    return namespaceListResponse.namespaces.map((ns: any) => ({
      id: ns.id || ns.name,
      name: ns.name,
      status: ns.status === "active" ? "active" : "terminating",
      labels: {}, // Không cần labels cho danh sách
      age: ns.age || "",
      cpu: ns.cpu || "0m",
      memory: ns.memory || "0",
      podCount: ns.podCount || 0,
    }));
  },
  getNamespace: async (name: string): Promise<any> => {
    const response = await api.get(`/admin/cluster/namespaces/${name}`);
    return response.data;
  },
  createNamespace: async (data: Omit<Namespace, "id" | "age">): Promise<Namespace> => {
    const response = await api.post("/admin/cluster/namespaces", data);
    const ns = response.data;
    return {
      id: ns.id || ns.name,
      name: ns.name,
      status: ns.status === "active" ? "active" : "terminating",
      labels: ns.labels || {},
      age: ns.age || "0d",
    };
  },
  createNamespaceFromYaml: async (yaml: string): Promise<Namespace> => {
    const response = await api.post("/admin/cluster/namespaces/yaml", { yamlContent: yaml });
    const ns = response.data;
    return {
      id: ns.id || ns.name,
      name: ns.name,
      status: ns.status === "active" ? "active" : "terminating",
      labels: ns.labels || {},
      age: ns.age || "0d",
    };
  },
  updateNamespace: async (
    name: string,
    data: { labels?: Record<string, string>; annotations?: Record<string, string> }
  ): Promise<Namespace> => {
    const response = await api.put(`/admin/cluster/namespaces/${name}`, data);
    const ns = response.data;
    return {
      id: ns.id || ns.name,
      name: ns.name,
      status: ns.status === "active" ? "active" : "terminating",
      labels: ns.labels || {},
      age: ns.age || "0d",
      cpu: ns.cpu,
      memory: ns.memory,
      podCount: ns.podCount,
    };
  },
  updateNamespaceFromYaml: async (name: string, yaml: string): Promise<Namespace> => {
    const response = await api.put(`/admin/cluster/namespaces/${name}/yaml`, { yamlContent: yaml });
    const ns = response.data;
    return {
      id: ns.id || ns.name,
      name: ns.name,
      status: ns.status || "active",
      age: ns.age || "",
      podCount: ns.podCount,
    };
  },
  deleteNamespace: async (id: string): Promise<void> => {
    await api.delete(`/admin/cluster/namespaces/${id}`);
  },

  // Deployments
  getDeployments: async (): Promise<Deployment[]> => {
    const response = await api.get("/admin/workloads/deployments");
    const deploymentListResponse = response.data;
    
    // Map từ backend response sang frontend type
    return deploymentListResponse.deployments.map((deployment: any) => ({
      id: buildScopedId(deployment.namespace, deployment.name),
      name: deployment.name,
      namespace: deployment.namespace,
      replicas: {
        desired: deployment.replicas?.desired || 0,
        ready: deployment.replicas?.ready || 0,
        updated: deployment.replicas?.updated || 0,
        available: deployment.replicas?.available || 0,
      },
      status: deployment.status === "running" ? "running" : deployment.status === "error" ? "error" : "pending",
      image: deployment.image || "",
      age: deployment.age || "",
      cpu: deployment.cpu,
      memory: deployment.memory,
    }));
  },
  getDeployment: async (id: string): Promise<Deployment> => {
    try {
      const { namespace, name } = parseScopedId(id);
      const response = await api.get(`/admin/workloads/deployments/${namespace}/${name}`);
      const deployment = response.data;
      return {
        id: buildScopedId(deployment.namespace, deployment.name),
        name: deployment.name,
        namespace: deployment.namespace,
        replicas: {
          desired: deployment.replicas?.desired || 0,
          ready: deployment.replicas?.ready || 0,
          updated: deployment.replicas?.updated || 0,
          available: deployment.replicas?.available || 0,
        },
        status: deployment.status === "running" ? "running" : deployment.status === "error" ? "error" : "pending",
        image: deployment.image || "",
        age: deployment.age || "",
        cpu: deployment.cpu,
        memory: deployment.memory,
      };
    } catch (error) {
      throw new Error("Deployment not found");
    }
  },
  getDeploymentDetail: async (id: string): Promise<DeploymentDetail> => {
    try {
      const { namespace, name } = parseScopedId(id);
      const response = await api.get(`/admin/workloads/deployments/${namespace}/${name}/detail`);
      const detail = response.data;
      return {
        id: buildScopedId(detail.namespace, detail.name),
        name: detail.name,
        namespace: detail.namespace,
        replicas: {
          desired: detail.replicas?.desired || 0,
          ready: detail.replicas?.ready || 0,
          updated: detail.replicas?.updated || 0,
          available: detail.replicas?.available || 0,
        },
        status: detail.status === "running" ? "running" : detail.status === "error" ? "error" : "pending",
        containers: detail.containers || [],
        images: detail.images || [],
        selector: detail.selector || "",
        age: detail.age || "",
        cpu: detail.cpu,
        memory: detail.memory,
        labels: detail.labels || {},
        annotations: detail.annotations || {},
        uid: detail.uid,
        resourceVersion: detail.resourceVersion,
        creationTimestamp: detail.creationTimestamp,
        pods: detail.pods || [],
        replicaSets: detail.replicaSets || [],
        events: detail.events || [],
        conditions: detail.conditions || [],
        yaml: detail.yaml,
      };
    } catch (error) {
      throw new Error("Deployment detail not found");
    }
  },
  createDeployment: async (data: any): Promise<Deployment> => {
    const response = await api.post("/admin/workloads/deployments", data);
    const deployment = response.data;
    return {
      id: buildScopedId(deployment.namespace, deployment.name),
      name: deployment.name,
      namespace: deployment.namespace,
      replicas: {
        desired: deployment.replicas?.desired || 0,
        ready: deployment.replicas?.ready || 0,
        updated: deployment.replicas?.updated || 0,
        available: deployment.replicas?.available || 0,
      },
      status: deployment.status === "running" ? "running" : deployment.status === "error" ? "error" : "pending",
      image: deployment.image || "",
      age: deployment.age || "0d",
    };
  },
  updateDeployment: async (id: string, data: Partial<Deployment>): Promise<Deployment> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.put(`/admin/workloads/deployments/${namespace}/${name}`, data);
    const deployment = response.data;
    return {
      id: buildScopedId(deployment.namespace, deployment.name),
      name: deployment.name,
      namespace: deployment.namespace,
      replicas: {
        desired: deployment.replicas?.desired || 0,
        ready: deployment.replicas?.ready || 0,
        updated: deployment.replicas?.updated || 0,
        available: deployment.replicas?.available || 0,
      },
      status: deployment.status === "running" ? "running" : deployment.status === "error" ? "error" : "pending",
      image: deployment.image || "",
      age: deployment.age || "",
    };
  },
  deleteDeployment: async (id: string): Promise<void> => {
    const { namespace, name } = parseScopedId(id);
    await api.delete(`/admin/workloads/deployments/${namespace}/${name}`);
  },
  scaleDeployment: async (id: string, replicas: number): Promise<Deployment> => {
    const { namespace, name } = parseScopedId(id);
    await api.post(`/admin/workloads/deployments/${namespace}/${name}/scale`, { replicas });
    return adminAPI.getDeployment(buildScopedId(namespace, name));
  },
  updateDeploymentFromYaml: async (id: string, yaml: string): Promise<Deployment> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.put(`/admin/workloads/deployments/${namespace}/${name}/yaml`, { yamlContent: yaml });
    const deployment = response.data;
    return {
      id: buildScopedId(deployment.namespace, deployment.name),
      name: deployment.name,
      namespace: deployment.namespace,
      replicas: {
        desired: deployment.replicas?.desired || 0,
        ready: deployment.replicas?.ready || 0,
        updated: deployment.replicas?.updated || 0,
        available: deployment.replicas?.available || 0,
      },
      status: deployment.status === "running" ? "running" : deployment.status === "error" ? "error" : "pending",
      image: deployment.image || "",
      age: deployment.age || "",
      cpu: deployment.cpu,
      memory: deployment.memory,
    };
  },

  // Pods
  getPods: async (): Promise<Pod[]> => {
    const response = await api.get("/admin/workloads/pods");
    const podListResponse = response.data;
    
    // Map từ backend response sang frontend type
    // Backend trả về status từ Kubernetes (Running, Pending, Failed, Succeeded, CrashLoopBackOff, etc.)
    return podListResponse.pods.map((pod: any) => ({
      id: buildScopedId(pod.namespace, pod.name),
      name: pod.name,
      namespace: pod.namespace,
      ready: {
        ready: pod.ready?.ready || 0,
        total: pod.ready?.total || 0,
      },
      node: pod.node || "",
      // Giữ nguyên status từ backend (đã là string, có thể là Running, Pending, CrashLoopBackOff, etc.)
      status: pod.status || "Unknown",
      restarts: pod.restarts || 0,
      age: pod.age || "",
      ip: pod.ip || "",
      cpu: pod.cpu,
      memory: pod.memory,
    }));
  },
  getPod: async (id: string): Promise<Pod> => {
    try {
      const { namespace, name } = parseScopedId(id);
      const response = await api.get(`/admin/workloads/pods/${namespace}/${name}`);
      const pod = response.data;
      return {
        id: buildScopedId(pod.namespace, pod.name),
        name: pod.name,
        namespace: pod.namespace,
        ready: {
          ready: pod.ready?.ready || 0,
          total: pod.ready?.total || 0,
        },
        node: pod.node || "",
        // Giữ nguyên status từ backend (đã là string, có thể là Running, Pending, CrashLoopBackOff, etc.)
        status: pod.status || "Unknown",
        restarts: pod.restarts || 0,
        age: pod.age || "",
        ip: pod.ip || "",
        cpu: pod.cpu,
        memory: pod.memory,
      };
    } catch (error) {
      throw new Error("Pod not found");
    }
  },
  getPodDetail: async (id: string): Promise<PodDetail> => {
    try {
      const { namespace, name } = parseScopedId(id);
      const response = await api.get(`/admin/workloads/pods/${namespace}/${name}/detail`);
      const detail = response.data;
      return {
        id: buildScopedId(detail.namespace, detail.name),
        name: detail.name,
        namespace: detail.namespace,
        // Giữ nguyên status từ backend (đã là string, có thể là Running, Pending, CrashLoopBackOff, etc.)
        status: detail.status || "Unknown",
        node: detail.node,
        ip: detail.ip,
        age: detail.age || "",
        cpu: detail.cpu,
        memory: detail.memory,
        ready: {
          ready: detail.ready?.ready || 0,
          total: detail.ready?.total || 0,
        },
        restarts: detail.restarts,
        nominatedNode: detail.nominatedNode,
        readinessGates: detail.readinessGates || [],
        labels: detail.labels || {},
        annotations: detail.annotations || {},
        uid: detail.uid,
        resourceVersion: detail.resourceVersion,
        creationTimestamp: detail.creationTimestamp,
        containers: detail.containers || [],
        events: detail.events || [],
        conditions: detail.conditions || [],
        yaml: detail.yaml,
      };
    } catch (error) {
      throw new Error("Pod detail not found");
    }
  },
  getPodLogs: async (id: string, container?: string): Promise<string> => {
    try {
      const { namespace, name } = parseScopedId(id);
      const params = container ? { container } : {};
      const response = await api.get(`/admin/workloads/pods/${namespace}/${name}/logs`, { params });
      return response.data.logs || "";
    } catch (error) {
      throw new Error("Cannot get pod logs");
    }
  },
  execPodCommand: async (id: string, command: string, container?: string): Promise<string> => {
    try {
      const { namespace, name } = parseScopedId(id);
      const params = container ? { container } : {};
      const response = await api.post(`/admin/workloads/pods/${namespace}/${name}/exec`, { command }, { params });
      return response.data.output || "";
    } catch (error) {
      throw new Error("Cannot exec command in pod");
    }
  },
  updatePodFromYaml: async (id: string, yaml: string): Promise<Pod> => {
    try {
      const { namespace, name } = parseScopedId(id);
      const response = await api.put(`/admin/workloads/pods/${namespace}/${name}/yaml`, { yamlContent: yaml });
      const pod = response.data;
      return {
        id: buildScopedId(pod.namespace, pod.name),
        name: pod.name,
        namespace: pod.namespace,
        ready: {
          ready: pod.ready?.ready || 0,
          total: pod.ready?.total || 0,
        },
        node: pod.node || "",
        // Giữ nguyên status từ backend (đã là string, có thể là Running, Pending, CrashLoopBackOff, etc.)
        status: pod.status || "Unknown",
        restarts: pod.restarts || 0,
        age: pod.age || "",
        ip: pod.ip || "",
        cpu: pod.cpu,
        memory: pod.memory,
      };
    } catch (error) {
      throw new Error("Cannot update pod from YAML");
    }
  },
  deletePod: async (id: string): Promise<void> => {
    const { namespace, name } = parseScopedId(id);
    await api.delete(`/admin/workloads/pods/${namespace}/${name}`);
  },
  createPod: async (data: any): Promise<Pod> => {
    const response = await api.post("/admin/workloads/pods", data);
    const pod = response.data;
    return {
      id: buildScopedId(pod.namespace, pod.name),
      name: pod.name,
      namespace: pod.namespace,
      ready: {
        ready: pod.ready?.ready || 0,
        total: pod.ready?.total || 0,
      },
      node: pod.node || "",
      status: pod.status === "running" ? "running" : 
              pod.status === "pending" ? "pending" : 
              pod.status === "failed" ? "failed" : 
              pod.status === "succeeded" ? "succeeded" : "pending",
      restarts: pod.restarts || 0,
      age: pod.age || "0m",
      ip: pod.ip || "",
    };
  },
  createPodFromYaml: async (yaml: string): Promise<Pod> => {
    try {
      const response = await api.post("/admin/workloads/pods/yaml", { yamlContent: yaml });
      const pod = response.data;
      return {
        id: buildScopedId(pod.namespace, pod.name),
        name: pod.name,
        namespace: pod.namespace,
        ready: {
          ready: pod.ready?.ready || 0,
          total: pod.ready?.total || 0,
        },
        node: pod.node || "",
        // Giữ nguyên status từ backend (đã là string, có thể là Running, Pending, CrashLoopBackOff, etc.)
        status: pod.status || "Unknown",
        restarts: pod.restarts || 0,
        age: pod.age || "0m",
        ip: pod.ip || "",
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || "Không thể tạo pod từ YAML");
    }
  },
  createDeploymentFromYaml: async (yaml: string): Promise<Deployment> => {
    try {
      const response = await api.post("/admin/workloads/deployments/yaml", { yamlContent: yaml });
      const deployment = response.data;
      return {
        id: buildScopedId(deployment.namespace, deployment.name),
        name: deployment.name,
        namespace: deployment.namespace,
        replicas: {
          desired: deployment.replicas?.desired || 0,
          ready: deployment.replicas?.ready || 0,
          updated: deployment.replicas?.updated || 0,
          available: deployment.replicas?.available || 0,
        },
        status: deployment.status === "running" ? "running" : deployment.status === "error" ? "error" : "pending",
        image: deployment.image || "",
        age: deployment.age || "0d",
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || "Không thể tạo deployment từ YAML");
    }
  },

  // Statefulsets
  getStatefulsets: async (): Promise<Statefulset[]> => {
    const response = await api.get("/admin/workloads/statefulsets");
    const statefulsetListResponse = response.data;
    
    // Map từ backend response sang frontend type
    return statefulsetListResponse.statefulsets.map((sts: any) => ({
      id: buildScopedId(sts.namespace, sts.name),
      name: sts.name,
      namespace: sts.namespace,
      replicas: {
        desired: sts.replicas?.desired || 0,
        ready: sts.replicas?.ready || 0,
      },
      status: sts.status === "running" ? "running" : "error",
      service: sts.service || "",
      containers: sts.containers || [],
      images: sts.images || [],
      age: sts.age || "",
      cpu: sts.cpu,
      memory: sts.memory,
    }));
  },
  getStatefulset: async (id: string): Promise<Statefulset> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.get(`/admin/workloads/statefulsets/${namespace}/${name}`);
    const sts = response.data;
    return {
      id: buildScopedId(sts.namespace, sts.name),
      name: sts.name,
      namespace: sts.namespace,
      replicas: {
        desired: sts.replicas?.desired || 0,
        ready: sts.replicas?.ready || 0,
      },
      status: sts.status === "running" ? "running" : "error",
      service: sts.service || "",
      containers: sts.containers || [],
      images: sts.images || [],
      age: sts.age || "",
      cpu: sts.cpu,
      memory: sts.memory,
    };
  },
  getStatefulsetDetail: async (id: string): Promise<StatefulsetDetail> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.get(`/admin/workloads/statefulsets/${namespace}/${name}/detail`);
    return response.data;
  },
  createStatefulset: async (data: any): Promise<Statefulset> => {
    const response = await api.post("/admin/workloads/statefulsets", data);
    const statefulset = response.data;
    return {
      id: buildScopedId(statefulset.namespace, statefulset.name),
      name: statefulset.name,
      namespace: statefulset.namespace,
      replicas: {
        desired: statefulset.replicas?.desired || 0,
        ready: statefulset.replicas?.ready || 0,
      },
      status: statefulset.status === "running" ? "running" : "error",
      service: statefulset.service || "",
      containers: statefulset.containers || [],
      images: statefulset.images || [],
      age: statefulset.age || "0d",
    };
  },
  createStatefulsetFromYaml: async (yaml: string): Promise<Statefulset> => {
    try {
      const response = await api.post("/admin/workloads/statefulsets/yaml", { yamlContent: yaml });
      const statefulset = response.data;
      return {
        id: buildScopedId(statefulset.namespace, statefulset.name),
        name: statefulset.name,
        namespace: statefulset.namespace,
        replicas: {
          desired: statefulset.replicas?.desired || 0,
          ready: statefulset.replicas?.ready || 0,
        },
        status: statefulset.status === "running" ? "running" : "error",
        service: statefulset.service || "",
        containers: statefulset.containers || [],
        images: statefulset.images || [],
        age: statefulset.age || "0d",
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || "Không thể tạo statefulset từ YAML");
    }
  },
  updateStatefulset: async (id: string, data: any): Promise<Statefulset> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.put(`/admin/workloads/statefulsets/${namespace}/${name}`, data);
    const statefulset = response.data;
    return {
      id: buildScopedId(statefulset.namespace, statefulset.name),
      name: statefulset.name,
      namespace: statefulset.namespace,
      replicas: {
        desired: statefulset.replicas?.desired || 0,
        ready: statefulset.replicas?.ready || 0,
      },
      status: statefulset.status === "running" ? "running" : "error",
      service: statefulset.service || "",
      containers: statefulset.containers || [],
      images: statefulset.images || [],
      age: statefulset.age || "",
    };
  },
  deleteStatefulset: async (id: string): Promise<void> => {
    const { namespace, name } = parseScopedId(id);
    await api.delete(`/admin/workloads/statefulsets/${namespace}/${name}`);
  },
  scaleStatefulset: async (id: string, replicas: number): Promise<Statefulset> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.post(`/admin/workloads/statefulsets/${namespace}/${name}/scale`, { replicas });
    const statefulset = response.data;
    return {
      id: buildScopedId(statefulset.namespace, statefulset.name),
      name: statefulset.name,
      namespace: statefulset.namespace,
      replicas: {
        desired: statefulset.replicas?.desired || 0,
        ready: statefulset.replicas?.ready || 0,
      },
      status: statefulset.status === "running" ? "running" : "error",
      service: statefulset.service || "",
      containers: statefulset.containers || [],
      images: statefulset.images || [],
      age: statefulset.age || "",
      cpu: statefulset.cpu,
      memory: statefulset.memory,
    };
  },
  updateStatefulsetFromYaml: async (id: string, yaml: string): Promise<Statefulset> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.put(`/admin/workloads/statefulsets/${namespace}/${name}/yaml`, { yamlContent: yaml });
    const statefulset = response.data;
    return {
      id: buildScopedId(statefulset.namespace, statefulset.name),
      name: statefulset.name,
      namespace: statefulset.namespace,
      replicas: {
        desired: statefulset.replicas?.desired || 0,
        ready: statefulset.replicas?.ready || 0,
      },
      status: statefulset.status === "running" ? "running" : "error",
      service: statefulset.service || "",
      containers: statefulset.containers || [],
      images: statefulset.images || [],
      age: statefulset.age || "",
      cpu: statefulset.cpu,
      memory: statefulset.memory,
    };
  },

  // Services
  getServices: async (): Promise<Service[]> => {
    const response = await api.get("/admin/services");
    const serviceListResponse = response.data;
    
    // Map từ backend response sang frontend type
    return serviceListResponse.services.map((svc: any) => ({
      id: svc.id || buildScopedId(svc.namespace || "default", svc.name),
      name: svc.name,
      namespace: svc.namespace,
      type: (svc.type === "ClusterIP" || svc.type === "NodePort" || svc.type === "LoadBalancer") 
        ? svc.type 
        : "ClusterIP",
      clusterIP: svc.clusterIP || "-",
      externalIP: svc.externalIP || "-",
      ports: (svc.ports || []).map((p: any) => ({
        port: p.port || 80,
        targetPort: p.targetPort || p.port || 8080,
        protocol: p.protocol || "TCP",
      })),
      selector: svc.selector || {},
      age: svc.age || "",
    }));
  },
  createService: async (data: any): Promise<Service> => {
    const response = await api.post("/admin/services", data);
    const service = response.data;
    return {
      id: buildScopedId(service.namespace, service.name),
      name: service.name,
      namespace: service.namespace,
      type: (service.type === "ClusterIP" || service.type === "NodePort" || service.type === "LoadBalancer") 
        ? service.type 
        : "ClusterIP",
      clusterIP: service.clusterIP || "-",
      externalIP: service.externalIP || "-",
      ports: (service.ports || []).map((p: any) => ({
        port: p.port || 80,
        targetPort: p.targetPort || p.port || 8080,
        protocol: p.protocol || "TCP",
      })),
      selector: service.selector || {},
      age: service.age || "0d",
    };
  },
  createServiceFromYaml: async (yaml: string): Promise<Service> => {
    try {
      const response = await api.post("/admin/services/yaml", { yamlContent: yaml });
      const service = response.data;
      return {
        id: buildScopedId(service.namespace, service.name),
        name: service.name,
        namespace: service.namespace,
        type: (service.type === "ClusterIP" || service.type === "NodePort" || service.type === "LoadBalancer") 
          ? service.type 
          : "ClusterIP",
        clusterIP: service.clusterIP || "-",
        externalIP: service.externalIP || "-",
        ports: (service.ports || []).map((p: any) => ({
          port: p.port || 80,
          targetPort: p.targetPort || p.port || 8080,
          protocol: p.protocol || "TCP",
        })),
        selector: service.selector || {},
        age: service.age || "0d",
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || "Không thể tạo service từ YAML");
    }
  },
  getService: async (id: string): Promise<Service> => {
    const { namespace, name } = parseScopedId(id);
    if (!namespace || !name) {
      throw new Error(`Invalid service ID format: ${id}. Expected format: namespace/name`);
    }
    const encodedNamespace = encodeURIComponent(namespace);
    const encodedName = encodeURIComponent(name);
    const response = await api.get(`/admin/services/${encodedNamespace}/${encodedName}`);
    const svc = response.data;
    return {
      id: svc.id || `${svc.name}-${svc.namespace}`,
      name: svc.name,
      namespace: svc.namespace,
      type: (svc.type === "ClusterIP" || svc.type === "NodePort" || svc.type === "LoadBalancer") 
        ? svc.type 
        : "ClusterIP",
      clusterIP: svc.clusterIP || "-",
      externalIP: svc.externalIP || "-",
      ports: (svc.ports || []).map((p: any) => ({
        port: p.port || 80,
        targetPort: p.targetPort || p.port || 8080,
        protocol: p.protocol || "TCP",
      })),
      selector: svc.selector || {},
      age: svc.age || "",
    };
  },
  getServiceDetail: async (id: string, namespace?: string, name?: string): Promise<ServiceDetail> => {
    // Prefer using explicit namespace and name if provided (more reliable)
    let finalNamespace = namespace;
    let finalName = name;
    
    // If not provided, try to parse from ID
    if (!finalNamespace || !finalName) {
      const parsed = parseScopedId(id);
      finalNamespace = finalNamespace || parsed.namespace;
      finalName = finalName || parsed.name;
    }
    
    if (!finalNamespace || !finalName) {
      throw new Error(`Invalid service ID format: ${id}. Expected format: namespace/name or provide namespace and name explicitly`);
    }
    try {
      // Encode namespace and name to handle special characters
      const encodedNamespace = encodeURIComponent(finalNamespace);
      const encodedName = encodeURIComponent(finalName);
      const response = await api.get(`/admin/services/${encodedNamespace}/${encodedName}/detail`);
      return response.data;
    } catch (error: any) {
      // Log the error for debugging
      console.error(`Error fetching service detail:`, {
        id,
        namespace: finalNamespace,
        name: finalName,
        encodedNamespace: encodeURIComponent(finalNamespace),
        encodedName: encodeURIComponent(finalName),
        url: `/admin/services/${encodeURIComponent(finalNamespace)}/${encodeURIComponent(finalName)}/detail`,
        error: error.response?.data || error.message,
      });
      
      // Extract error message from response
      let errorMessage = `Không thể lấy chi tiết service "${finalName}" trong namespace "${finalNamespace}"`;
      
      if (error.response?.status === 400) {
        errorMessage = `Service "${finalName}" không tồn tại trong namespace "${finalNamespace}" hoặc có lỗi khi truy vấn Kubernetes`;
      } else if (error.response?.status === 404) {
        errorMessage = `Không tìm thấy service "${finalName}" trong namespace "${finalNamespace}"`;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  },
  updateServiceFromYaml: async (id: string, yaml: string): Promise<Service> => {
    const { namespace, name } = parseScopedId(id);
    if (!namespace || !name) {
      throw new Error(`Invalid service ID format: ${id}. Expected format: namespace/name`);
    }
    const encodedNamespace = encodeURIComponent(namespace);
    const encodedName = encodeURIComponent(name);
    const response = await api.put(`/admin/services/${encodedNamespace}/${encodedName}/yaml`, { yamlContent: yaml });
    const service = response.data;
    return {
      id: service.id || `${service.name}-${service.namespace}`,
      name: service.name,
      namespace: service.namespace,
      type: service.type || "ClusterIP",
      clusterIP: service.clusterIP || undefined,
      externalIP: service.externalIP || undefined,
      ports: service.ports || [],
      selector: service.selector || {},
      age: service.age || "",
    };
  },
  deleteService: async (id: string): Promise<void> => {
    const { namespace, name } = parseScopedId(id);
    if (!namespace || !name) {
      throw new Error(`Invalid service ID format: ${id}. Expected format: namespace/name`);
    }
    const encodedNamespace = encodeURIComponent(namespace);
    const encodedName = encodeURIComponent(name);
    await api.delete(`/admin/services/${encodedNamespace}/${encodedName}`);
  },

  // Ingress
  getIngress: async (): Promise<Ingress[]> => {
    const response = await api.get("/admin/ingress");
    const ingressListResponse = response.data;
    
    // Map từ backend response sang frontend type
    return ingressListResponse.ingress.map((ing: any) => ({
      id: buildScopedId(ing.namespace, ing.name),
      name: ing.name,
      namespace: ing.namespace,
      ingressClass: ing.ingressClass || undefined,
      hosts: ing.hosts || [],
      address: ing.address || undefined,
      ports: ing.ports || [80, 443],
      age: ing.age || "",
    }));
  },
  createIngress: async (data: Omit<Ingress, "id" | "age">): Promise<Ingress> => {
    const response = await api.post("/admin/ingress", data);
    const ingress = response.data;
    return {
      id: ingress.id || `${ingress.name}-${ingress.namespace}`,
      name: ingress.name,
      namespace: ingress.namespace,
      ingressClass: ingress.ingressClass || undefined,
      hosts: ingress.hosts || [],
      address: ingress.address || undefined,
      ports: ingress.ports || [80, 443],
      age: ingress.age || "0d",
    };
  },
  updateIngress: async (id: string, data: Omit<Ingress, "id" | "age">): Promise<Ingress> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.put(`/admin/ingress/${namespace}/${name}`, data);
    const ingress = response.data;
    return {
      id: ingress.id || `${ingress.name}-${ingress.namespace}`,
      name: ingress.name,
      namespace: ingress.namespace,
      ingressClass: ingress.ingressClass || undefined,
      hosts: ingress.hosts || [],
      address: ingress.address || undefined,
      ports: ingress.ports || [80, 443],
      age: ingress.age || "0d",
    };
  },
  getIngressDetail: async (id: string): Promise<any> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.get(`/admin/ingress/${namespace}/${name}/detail`);
    return response.data;
  },
  updateIngressFromYaml: async (id: string, yaml: string): Promise<Ingress> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.put(`/admin/ingress/${namespace}/${name}/yaml`, { yamlContent: yaml });
    const ingress = response.data;
    return {
      id: ingress.id || `${ingress.name}-${ingress.namespace}`,
      name: ingress.name,
      namespace: ingress.namespace,
      ingressClass: ingress.ingressClass || undefined,
      hosts: ingress.hosts || [],
      address: ingress.address || undefined,
      ports: ingress.ports || [80, 443],
      age: ingress.age || "0d",
    };
  },
  deleteIngress: async (id: string): Promise<void> => {
    const { namespace, name } = parseScopedId(id);
    await api.delete(`/admin/ingress/${namespace}/${name}`);
  },

  // PVC
  getPVCs: async (): Promise<PVC[]> => {
    const response = await api.get("/admin/storage/pvcs");
    const pvcListResponse = response.data;
    
    return pvcListResponse.pvcs.map((pvc: any) => ({
      id: buildScopedId(pvc.namespace, pvc.name),
      name: pvc.name,
      namespace: pvc.namespace,
      status: pvc.status === "lost" ? "lost" : pvc.status === "bound" ? "bound" : "pending",
      volume: pvc.volume || undefined,
      capacity: pvc.capacity || "",
      accessModes: pvc.accessModes || [],
      storageClass: pvc.storageClass || "",
      volumeAttributesClass: pvc.volumeAttributesClass || undefined,
      volumeMode: pvc.volumeMode || undefined,
      age: pvc.age || "",
    }));
  },
  getPVCDetail: async (id: string): Promise<PVCDetail> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.get(`/admin/storage/pvcs/${namespace}/${name}/detail`);
    return response.data;
  },
  updatePVCFromYaml: async (id: string, yaml: string): Promise<PVC> => {
    const { namespace, name } = parseScopedId(id);
    const response = await api.put(`/admin/storage/pvcs/${namespace}/${name}/yaml`, { yamlContent: yaml });
    const pvc = response.data;
    return {
      id: buildScopedId(pvc.namespace, pvc.name),
      name: pvc.name,
      namespace: pvc.namespace,
      status: pvc.status === "lost" ? "lost" : pvc.status === "bound" ? "bound" : "pending",
      volume: pvc.volume || undefined,
      capacity: pvc.capacity || "",
      accessModes: pvc.accessModes || [],
      storageClass: pvc.storageClass || "",
      volumeAttributesClass: pvc.volumeAttributesClass || undefined,
      volumeMode: pvc.volumeMode || undefined,
      age: pvc.age || "",
    };
  },
  createPVC: async (data: Omit<PVC, "id" | "age">): Promise<PVC> => {
    const response = await api.post("/admin/storage/pvcs", data);
    const pvc = response.data;
    return {
      id: buildScopedId(pvc.namespace, pvc.name),
      name: pvc.name,
      namespace: pvc.namespace,
      status: pvc.status === "lost" ? "lost" : pvc.status === "bound" ? "bound" : "pending",
      volume: pvc.volume || undefined,
      capacity: pvc.capacity || "",
      accessModes: pvc.accessModes || [],
      storageClass: pvc.storageClass || "",
      volumeAttributesClass: pvc.volumeAttributesClass || undefined,
      volumeMode: pvc.volumeMode || undefined,
      age: pvc.age || "",
    };
  },
  createPVCFromYaml: async (yaml: string): Promise<PVC> => {
    const response = await api.post("/admin/storage/pvcs/yaml", { yamlContent: yaml });
    const pvc = response.data;
    return {
      id: buildScopedId(pvc.namespace, pvc.name),
      name: pvc.name,
      namespace: pvc.namespace,
      status: pvc.status === "lost" ? "lost" : pvc.status === "bound" ? "bound" : "pending",
      volume: pvc.volume || undefined,
      capacity: pvc.capacity || "",
      accessModes: pvc.accessModes || [],
      storageClass: pvc.storageClass || "",
      volumeAttributesClass: pvc.volumeAttributesClass || undefined,
      volumeMode: pvc.volumeMode || undefined,
      age: pvc.age || "",
    };
  },
  deletePVC: async (id: string): Promise<void> => {
    const { namespace, name } = parseScopedId(id);
    await api.delete(`/admin/storage/pvcs/${namespace}/${name}`);
  },

  // PV
  getPVs: async (): Promise<PV[]> => {
    const response = await api.get("/admin/storage/pvs");
    const pvListResponse = response.data;
    
    // Map từ backend response sang frontend type
    return pvListResponse.pvs.map((pv: any) => ({
      id: pv.id || pv.name,
      name: pv.name,
      capacity: pv.capacity || "",
      accessModes: pv.accessModes || [],
      reclaimPolicy: (pv.reclaimPolicy === "Retain" || pv.reclaimPolicy === "Delete" || pv.reclaimPolicy === "Recycle")
        ? pv.reclaimPolicy
        : "Retain",
      status: (pv.status === "available" || pv.status === "bound" || pv.status === "released")
        ? pv.status
        : "available",
      storageClass: pv.storageClass || "",
      claim: pv.claim ? {
        namespace: pv.claim.namespace || "",
        name: pv.claim.name || "",
      } : undefined,
      volumeAttributesClass: pv.volumeAttributesClass || undefined,
      reason: pv.reason || undefined,
      volumeMode: pv.volumeMode || undefined,
      age: pv.age || "",
    }));
  },
  createPV: async (data: Omit<PV, "id" | "age">): Promise<PV> => {
    const response = await api.post("/admin/storage/pvs", data);
    const pv = response.data;
    return {
      id: pv.id || pv.name,
      name: pv.name,
      capacity: pv.capacity || "",
      accessModes: pv.accessModes || [],
      reclaimPolicy: (pv.reclaimPolicy === "Retain" || pv.reclaimPolicy === "Delete" || pv.reclaimPolicy === "Recycle")
        ? pv.reclaimPolicy
        : "Retain",
      status: (pv.status === "available" || pv.status === "bound" || pv.status === "released")
        ? pv.status
        : "available",
      storageClass: pv.storageClass || "",
      claim: pv.claim ? {
        namespace: pv.claim.namespace || "",
        name: pv.claim.name || "",
      } : undefined,
      volumeAttributesClass: pv.volumeAttributesClass || undefined,
      reason: pv.reason || undefined,
      volumeMode: pv.volumeMode || undefined,
      age: pv.age || "0d",
    };
  },
  deletePV: async (id: string): Promise<void> => {
    await api.delete(`/admin/storage/pvs/${id}`);
  },
  getPV: async (id: string): Promise<PV> => {
    const response = await api.get(`/admin/storage/pvs/${id}`);
    const pv = response.data;
    return {
      id: pv.id || pv.name,
      name: pv.name,
      capacity: pv.capacity || "",
      accessModes: pv.accessModes || [],
      reclaimPolicy: (pv.reclaimPolicy === "Retain" || pv.reclaimPolicy === "Delete" || pv.reclaimPolicy === "Recycle")
        ? pv.reclaimPolicy
        : "Retain",
      status: (pv.status === "available" || pv.status === "bound" || pv.status === "released")
        ? pv.status
        : "available",
      storageClass: pv.storageClass || "",
      claim: pv.claim ? {
        namespace: pv.claim.namespace || "",
        name: pv.claim.name || "",
      } : undefined,
      volumeAttributesClass: pv.volumeAttributesClass || undefined,
      reason: pv.reason || undefined,
      volumeMode: pv.volumeMode || undefined,
      age: pv.age || "",
    };
  },
  getPVDetail: async (id: string): Promise<PVDetail> => {
    const response = await api.get(`/admin/storage/pvs/${id}/detail`);
    return response.data;
  },
  updatePVFromYaml: async (id: string, yaml: string): Promise<PV> => {
    const response = await api.put(`/admin/storage/pvs/${id}/yaml`, { yamlContent: yaml });
    const pv = response.data;
    return {
      id: pv.id || pv.name,
      name: pv.name,
      capacity: pv.capacity || "",
      accessModes: pv.accessModes || [],
      reclaimPolicy: (pv.reclaimPolicy === "Retain" || pv.reclaimPolicy === "Delete" || pv.reclaimPolicy === "Recycle")
        ? pv.reclaimPolicy
        : "Retain",
      status: (pv.status === "available" || pv.status === "bound" || pv.status === "released")
        ? pv.status
        : "available",
      storageClass: pv.storageClass || "",
      claim: pv.claim ? {
        namespace: pv.claim.namespace || "",
        name: pv.claim.name || "",
      } : undefined,
      volumeAttributesClass: pv.volumeAttributesClass || undefined,
      reason: pv.reason || undefined,
      volumeMode: pv.volumeMode || undefined,
      age: pv.age || "",
    };
  },
  createPVFromYaml: async (yaml: string): Promise<PV> => {
    const response = await api.post("/admin/storage/pvs/yaml", { yamlContent: yaml });
    const pv = response.data;
    return {
      id: pv.id || pv.name,
      name: pv.name,
      capacity: pv.capacity || "",
      accessModes: pv.accessModes || [],
      reclaimPolicy: (pv.reclaimPolicy === "Retain" || pv.reclaimPolicy === "Delete" || pv.reclaimPolicy === "Recycle")
        ? pv.reclaimPolicy
        : "Retain",
      status: (pv.status === "available" || pv.status === "bound" || pv.status === "released")
        ? pv.status
        : "available",
      storageClass: pv.storageClass || "",
      claim: pv.claim ? {
        namespace: pv.claim.namespace || "",
        name: pv.claim.name || "",
      } : undefined,
      volumeAttributesClass: pv.volumeAttributesClass || undefined,
      reason: pv.reason || undefined,
      volumeMode: pv.volumeMode || undefined,
      age: pv.age || "0d",
    };
  },
  // User Management
  getOverview: async (): Promise<AdminOverviewResponse> => {
    const response = await api.get("/admin/user-services/overview");
    return response.data;
  },
  getUserUsage: async (): Promise<AdminUserUsageResponse> => {
    const response = await api.get("/admin/user-services/users");
    return response.data;
  },
  getAdminUsers: async (): Promise<AdminUser[]> => {
    // Gọi API thật để lấy dữ liệu
    const response = await api.get("/admin/user-services/users");
    const userUsageResponse: AdminUserUsageResponse = response.data;
    
    // Map dữ liệu từ API response sang format AdminUser
    return userUsageResponse.users.map((user) => {
      const isPremium = user.tier.toLowerCase() === "premium";
      // Ước tính total dựa trên tier (vì API không trả về capacity)
      // Premium: total cao hơn, Standard: total thấp hơn
      const cpuTotal = isPremium 
        ? Math.max(user.cpuCores * 1.5, 200) // Premium: ít nhất 200 cores hoặc 1.5x used
        : Math.max(user.cpuCores * 1.3, 100); // Standard: ít nhất 100 cores hoặc 1.3x used
      const memoryTotal = isPremium
        ? Math.max(user.memoryGb * 1.5, 320) // Premium: ít nhất 320 GB hoặc 1.5x used
        : Math.max(user.memoryGb * 1.3, 128); // Standard: ít nhất 128 GB hoặc 1.3x used
      
      return {
        id: String(user.id),
        name: user.fullname,
        username: user.username,
        tier: (isPremium ? "premium" : "standard") as "premium" | "standard",
        email: "", // API không trả về email, để trống
        projectCount: user.projectCount,
        cpuUsage: {
          used: user.cpuCores,
          total: Math.round(cpuTotal),
        },
        memoryUsage: {
          used: user.memoryGb,
          total: Math.round(memoryTotal),
        },
      };
    });
  },
  getUserProjects: async (userId: string): Promise<AdminUserProject[]> => {
    // Sử dụng getUserProjectsDetail API để lấy danh sách projects
    const response = await api.get("/admin/user-services/user-projects", {
      params: { userId },
    });
    const projectListResponse: AdminUserProjectListResponse = response.data;
    // Map từ AdminUserProjectListResponse sang AdminUserProject[]
    return (projectListResponse.projects || []).map((proj: any) => ({
      id: String(proj.projectId),
      name: proj.projectName || "",
      databaseCount: proj.databaseCount || 0,
      backendCount: proj.backendCount || 0,
      frontendCount: proj.frontendCount || 0,
      cpuUsage: {
        used: proj.cpuCores || 0,
        total: proj.cpuCores ? Math.round(proj.cpuCores * 1.3) : 0,
      },
      memoryUsage: {
        used: proj.memoryGb || 0,
        total: proj.memoryGb ? Math.round(proj.memoryGb * 1.3) : 0,
      },
    }));
  },
  getProjectDetail: async (projectId: string): Promise<AdminProjectDetail> => {
    // Sử dụng getProjectResources API để lấy chi tiết project
    const response = await api.get("/admin/user-services/project-resources", {
      params: { projectId },
    });
    const projectResourceResponse: AdminProjectResourceDetailResponse = response.data;
    // Map từ AdminProjectResourceDetailResponse sang AdminProjectDetail
    return {
      id: String(projectResourceResponse.projectId),
      name: projectResourceResponse.projectName || "",
      databases: (projectResourceResponse.databases || []).map((db: any) => ({
        id: String(db.id),
        name: db.name || "",
        status: db.status || "unknown",
        cpu: db.cpu || "-",
        memory: db.memory || "-",
        projectName: projectResourceResponse.projectName || "",
        cpuUsed: db.cpuUsed || "-",
        memoryUsed: db.memoryUsed || "-",
        ip: db.ip || "",
        port: db.port || 0,
        databaseName: db.databaseName || "",
        dbUsername: db.dbUsername || "",
        dbPassword: db.dbPassword || "",
        node: db.node || "",
        pvc: db.pvc || "",
        pv: db.pv || "",
      })),
      backends: (projectResourceResponse.backends || []).map((be: any) => ({
        id: String(be.id),
        name: be.name || "",
        status: be.status || "unknown",
        cpu: be.cpu || "-",
        memory: be.memory || "-",
        replicas: be.replicas || "0/0",
      })),
      frontends: (projectResourceResponse.frontends || []).map((fe: any) => ({
        id: String(fe.id),
        name: fe.name || "",
        status: fe.status || "unknown",
        cpu: fe.cpu || "-",
        memory: fe.memory || "-",
        replicas: fe.replicas || "0/0",
      })),
    };
  },
  getAdminAccounts: async (): Promise<AdminAccount[]> => {
    const response = await api.get("/users");
    const userSummaries = Array.isArray(response.data) ? response.data : [];
    if (userSummaries.length === 0) {
      return [];
    }
    return userSummaries.map(mapUserSummaryToAdminAccount);
  },
  createAdminAccount: async (data: {
    fullname: string;
    username: string;
    password: string;
    confirmPassword: string;
    tier?: "STANDARD" | "PREMIUM";
  }): Promise<void> => {
    await api.post("/users", {
      fullname: data.fullname,
      username: data.username,
      password: data.password,
      confirmPassword: data.confirmPassword,
      tier: data.tier || "STANDARD",
    });
  },
  updateAdminAccountStatus: async (id: string, status: AdminAccount["status"]): Promise<AdminAccount> => {
    // TODO: Implement API endpoint for updating account status
    throw new Error("API endpoint for updating account status is not implemented yet");
  },
  resetAdminAccountPassword: async (id: string): Promise<void> => {
    // TODO: Implement API endpoint for resetting password
    throw new Error("API endpoint for resetting password is not implemented yet");
  },
  // Cluster Resources
  getClusterCapacity: async (): Promise<ClusterCapacityResponse> => {
    const response = await api.get("/admin/cluster/capacity");
    return response.data;
  },
  getClusterAllocatable: async (): Promise<ClusterAllocatableResponse> => {
    const response = await api.get("/admin/cluster/allocatable");
    return response.data;
  },
  getUserSummary: async (userId: string): Promise<AdminUserProjectSummaryResponse> => {
    const response = await api.get("/admin/user-services/user-summary", {
      params: { userId },
    });
    return response.data;
  },
  getUserProjectsDetail: async (userId: string): Promise<AdminUserProjectListResponse> => {
    const response = await api.get("/admin/user-services/user-projects", {
      params: { userId },
    });
    return response.data;
  },
  getProjectResources: async (projectId: string): Promise<AdminProjectResourceDetailResponse> => {
    const response = await api.get("/admin/user-services/project-resources", {
      params: { projectId },
    });
    return response.data;
  },
  getDatabaseDetail: async (databaseId: string): Promise<AdminDatabaseDetailResponse> => {
    const response = await api.get("/admin/database/detail", {
      params: { databaseId },
    });
    return response.data;
  },
  getBackendDetail: async (backendId: string): Promise<AdminBackendDetailResponse> => {
    const response = await api.get("/admin/backend/detail", {
      params: { backendId },
    });
    return response.data;
  },
  getFrontendDetail: async (frontendId: string): Promise<AdminFrontendDetailResponse> => {
    const response = await api.get("/admin/frontend/detail", {
      params: { frontendId },
    });
    return response.data;
  },
  getBackendReplicaRequests: async (status?: string): Promise<AdminReplicaRequest[]> => {
    const normalizedStatus = normalizeReplicaStatus(status);
    const response = await api.get("/backend-requests", {
      params: normalizedStatus ? { status: normalizedStatus } : undefined,
    });
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map(mapBackendReplicaRequest);
  },
  approveBackendReplicaRequest: async (requestId: number): Promise<void> => {
    await api.post(`/backend-requests/${requestId}/approve`);
  },
  rejectBackendReplicaRequest: async (requestId: number, reason: string): Promise<void> => {
    await api.post(`/backend-requests/${requestId}/reject`, { reason });
  },
  getFrontendReplicaRequests: async (status?: string): Promise<AdminReplicaRequest[]> => {
    const normalizedStatus = normalizeReplicaStatus(status);
    const response = await api.get("/frontend-requests", {
      params: normalizedStatus ? { status: normalizedStatus } : undefined,
    });
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map(mapFrontendReplicaRequest);
  },
  approveFrontendReplicaRequest: async (requestId: number): Promise<void> => {
    await api.post(`/frontend-requests/${requestId}/approve`);
  },
  rejectFrontendReplicaRequest: async (requestId: number, reason: string): Promise<void> => {
    await api.post(`/frontend-requests/${requestId}/reject`, { reason });
  },

  // ==================== Infrastructure APIs (Re-exported from infrastructure-api.ts) ====================
  
  // Server Auth
  checkServerAuthStatus: infrastructureAPI.checkServerAuthStatus,
  
  // Ansible
  checkAnsibleStatus: infrastructureAPI.checkAnsibleStatus,
  installAnsible: infrastructureAPI.installAnsible,
  reinstallAnsible: infrastructureAPI.reinstallAnsible,
  uninstallAnsible: infrastructureAPI.uninstallAnsible,
  getAnsibleConfig: infrastructureAPI.getAnsibleConfig,
  verifyAnsibleConfig: infrastructureAPI.verifyAnsibleConfig,
  saveAnsibleConfig: infrastructureAPI.saveAnsibleConfig,
  getAnsibleInitStatus: infrastructureAPI.getAnsibleInitStatus,
  initAnsibleStep1: infrastructureAPI.initAnsibleStep1,
  initAnsibleStep2: infrastructureAPI.initAnsibleStep2,
  initAnsibleStep3: infrastructureAPI.initAnsibleStep3,
  initAnsibleStep4: infrastructureAPI.initAnsibleStep4,
  getPlaybooks: infrastructureAPI.getPlaybooks,
  savePlaybook: infrastructureAPI.savePlaybook,
  deletePlaybook: infrastructureAPI.deletePlaybook,
  uploadPlaybookFile: infrastructureAPI.uploadPlaybookFile,
  executePlaybook: infrastructureAPI.executePlaybook,
  getPlaybookExecutionStatus: infrastructureAPI.getPlaybookExecutionStatus,
  
  // Cluster Management
  getClusterInfo: infrastructureAPI.getClusterInfo,
  assignServersToCluster: infrastructureAPI.assignServersToCluster,
  updateServerRoles: infrastructureAPI.updateServerRoles,
  unassignServersFromCluster: infrastructureAPI.unassignServersFromCluster,
  
  // Server Operations
  checkAllStatuses: infrastructureAPI.checkAllStatuses,
  checkAllServers: infrastructureAPI.checkAllServers,
  pingServer: infrastructureAPI.pingServer,
  reconnectServer: infrastructureAPI.reconnectServer,
  disconnectServer: infrastructureAPI.disconnectServer,
  shutdownServer: infrastructureAPI.shutdownServer,
  restartServer: infrastructureAPI.restartServer,
  testSsh: infrastructureAPI.testSsh,
};

