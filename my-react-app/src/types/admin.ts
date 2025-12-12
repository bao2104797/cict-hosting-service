/**
 * Types cho Admin Dashboard - Quản lý Infrastructure và Cluster
 */

// Server
export type Server = {
  id: string;
  name: string;
  ipAddress: string;
  port?: number;
  username?: string;
  password?: string; // Không hiển thị trong UI, chỉ dùng để lưu
  role?: "MASTER" | "WORKER" | "DOCKER" | "DATABASE" | string;
  status: "online" | "offline" | "disabled";
  serverStatus?: string; // RUNNING, STOPPED, BUILDING, ERROR
  cpu: { used?: number; total: number | "-" };
  memory: { used?: number; total: number | "-" };
  disk: { used?: number; total: number | "-" };
  os: string;
  updatedAt: string;
  clusterStatus?: "UNASSIGNED" | "TAGGED" | "IN_CLUSTER" | "AVAILABLE" | "UNAVAILABLE" | string;
};

// Cluster
export type Cluster = {
  id: string;
  name: string;
  version: string;
  nodeCount: number;
  status: "healthy" | "unhealthy";
  provider: "local" | "aws" | "gcp" | "azure";
  serverIds: string[]; // Danh sách ID của các server trong cluster
  serverRoles: Record<string, "master" | "worker">; // Map serverId -> role
  createdAt: string;
};

// Node
export type Node = {
  id: string;
  name: string;
  ip?: string; // IP address của node (InternalIP)
  status: "ready" | "notready" | "NOT_ASSIGN" | "NOT_JOIN_K8S";
  role: "master" | "worker";
  cpu: { requested: number; limit: number; capacity: number };
  memory: { requested: number; limit: number; capacity: number };
  disk: { requested: number; limit: number; capacity: number };
  podCount: number;
  os: string;
  kernel: string;
  updatedAt: string;
   kubeletVersion?: string;
   containerRuntime?: string;
  labels?: Record<string, string>;
  pods?: Array<{
    name: string;
    namespace: string;
    status: string;
    age?: string;
    ip?: string;
  }>;
  yaml?: string;
  notAssignAction?: "ASSIGN" | "JOIN_K8S"; // "ASSIGN" khi status = "NOT_ASSIGN", "JOIN_K8S" khi status = "NOT_JOIN_K8S"
};

// Namespace
export type Namespace = {
  id: string;
  name: string;
  status: "active" | "terminating";
  labels?: Record<string, string>;
  resourceQuota?: {
    cpu: { limit: number; used: number };
    memory: { limit: number; used: number };
  };
  age: string;
  cpu?: string; // CPU usage (e.g., "400m", "1.5")
  memory?: string; // Memory usage (e.g., "1.2Gi", "800Mi")
  podCount?: number; // Number of pods in this namespace
};

// Deployment
export type Deployment = {
  id: string;
  name: string;
  namespace: string;
  replicas: { desired: number; ready: number; updated: number; available: number };
  status: "running" | "error" | "pending";
  image: string; // Chỉ lấy image đầu tiên cho danh sách
  age: string;
  cpu?: string; // CPU usage (e.g., "400m", "1.5")
  memory?: string; // Memory usage (e.g., "1.2Gi", "800Mi")
};

// Deployment Detail
export type DeploymentDetail = {
  id: string;
  name: string;
  namespace: string;
  replicas: { desired: number; ready: number; updated: number; available: number };
  status: "running" | "error" | "pending";
  containers: string[];
  images: string[];
  selector: string;
  age: string;
  cpu?: string;
  memory?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  pods?: Array<{
    name: string;
    namespace: string;
    status: string;
    node?: string;
    ip?: string;
    restarts?: number;
    age?: string;
    ready?: string;
  }>;
  replicaSets?: Array<{
    name: string;
    namespace: string;
    replicas: number;
    readyReplicas: number;
    age?: string;
    image?: string;
  }>;
  events?: Array<{
    type?: string;
    reason?: string;
    message?: string;
    firstTimestamp?: string;
    lastTimestamp?: string;
    count?: number;
    involvedObjectKind?: string;
    involvedObjectName?: string;
  }>;
  conditions?: Array<{
    type?: string;
    status?: string;
    reason?: string;
    message?: string;
    lastTransitionTime?: string;
    lastUpdateTime?: string;
  }>;
  yaml?: string;
};

// Pod
export type Pod = {
  id: string;
  name: string;
  namespace: string;
  ready: { ready: number; total: number };
  node: string;
  status: string; // Pod status from Kubernetes (Running, Pending, Failed, Succeeded, Unknown, CrashLoopBackOff, ImagePullBackOff, Error, etc.)
  restarts: number;
  age: string;
  ip: string;
  cpu?: string;
  memory?: string;
};

// Pod Detail
export type PodDetail = {
  id: string;
  name: string;
  namespace: string;
  status: string; // Pod status from Kubernetes (Running, Pending, Failed, Succeeded, Unknown, CrashLoopBackOff, ImagePullBackOff, Error, etc.)
  node?: string;
  ip?: string;
  age: string;
  cpu?: string;
  memory?: string;
  ready: { ready: number; total: number };
  restarts?: number;
  nominatedNode?: string;
  readinessGates?: string[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  containers?: Array<{
    name: string;
    image: string;
    imagePullPolicy?: string;
    ports?: Array<{
      name?: string;
      containerPort: number;
      protocol?: string;
    }>;
    resources?: {
      cpuRequest?: string;
      cpuLimit?: string;
      memoryRequest?: string;
      memoryLimit?: string;
    };
    status?: string;
    ready?: boolean;
    restartCount?: number;
    startedAt?: string;
  }>;
  events?: Array<{
    type?: string;
    reason?: string;
    message?: string;
    firstTimestamp?: string;
    lastTimestamp?: string;
    count?: number;
    involvedObjectKind?: string;
    involvedObjectName?: string;
  }>;
  conditions?: Array<{
    type?: string;
    status?: string;
    reason?: string;
    message?: string;
    lastTransitionTime?: string;
    lastProbeTime?: string;
  }>;
  yaml?: string;
};

// Statefulset
export type Statefulset = {
  id: string;
  name: string;
  namespace: string;
  replicas: { desired: number; ready: number };
  status: "running" | "error";
  service: string;
  containers: string[];
  images: string[];
  age: string;
  cpu?: string;
  memory?: string;
};

export type StatefulsetDetail = {
  id: string;
  name: string;
  namespace: string;
  replicas: { desired: number; ready: number };
  status: string;
  service?: string;
  containers?: string[];
  images?: string[];
  age: string;
  cpu?: string;
  memory?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  pods?: Array<{
    name: string;
    namespace: string;
    status?: string;
    node?: string;
    ip?: string;
    restarts?: number;
    age?: string;
    ready?: string;
  }>;
  pvcs?: Array<{
    name: string;
    namespace: string;
    status?: string;
    volume?: string;
    capacity?: string;
    storageClass?: string;
    age?: string;
  }>;
  events?: Array<{
    type?: string;
    reason?: string;
    message?: string;
    firstTimestamp?: string;
    lastTimestamp?: string;
    count?: number;
    involvedObjectKind?: string;
    involvedObjectName?: string;
  }>;
  conditions?: Array<{
    type?: string;
    status?: string;
    reason?: string;
    message?: string;
    lastTransitionTime?: string;
    lastUpdateTime?: string;
  }>;
  volumeClaimTemplates?: Array<{
    name?: string;
    storageClass?: string;
    accessMode?: string;
    size?: string;
  }>;
  yaml?: string;
};

// Service
export type Service = {
  id: string;
  name: string;
  namespace: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer";
  clusterIP: string;
  externalIP?: string;
  ports: { port: number; targetPort: number; protocol: string }[];
  selector?: Record<string, string>;
  age: string;
};

export type ServiceDetail = {
  id: string;
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP?: string;
  ports: Array<{ port: number; targetPort: number; protocol: string }>;
  selector?: Record<string, string>;
  age: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  endpoints?: Array<{
    ip?: string;
    ports?: number[];
    targetRefKind?: string;
    targetRefName?: string;
    targetRefNamespace?: string;
  }>;
  events?: Array<{
    type?: string;
    reason?: string;
    message?: string;
    firstTimestamp?: string;
    lastTimestamp?: string;
    count?: number;
    involvedObjectKind?: string;
    involvedObjectName?: string;
  }>;
  status?: {
    endpointCount?: number;
    loadBalancerStatus?: string;
  };
  yaml?: string;
};

// Ingress
export type Ingress = {
  id: string;
  name: string;
  namespace: string;
  ingressClass?: string;
  hosts: string[];
  address?: string;
  ports: number[];
  age: string;
};

// PVC
export type PVC = {
  id: string;
  name: string;
  namespace: string;
  status: string; // PVC status from Kubernetes (Bound, Pending, Lost)
  volume?: string;
  capacity: string;
  accessModes: string[];
  storageClass: string;
  volumeAttributesClass?: string;
  volumeMode?: string;
  age: string;
};

export type PVCDetail = {
  id: string;
  name: string;
  namespace: string;
  status?: string;
  volume?: string;
  capacity?: string;
  accessModes?: string[];
  storageClass?: string;
  volumeAttributesClass?: string;
  volumeMode?: string;
  age?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  pods?: Array<{
    name?: string;
    namespace?: string;
    status?: string;
    node?: string;
    age?: string;
  }>;
  events?: Array<{
    type?: string;
    reason?: string;
    message?: string;
    firstTimestamp?: string;
    lastTimestamp?: string;
    count?: number;
  }>;
  conditions?: Array<{
    type?: string;
    status?: string;
    reason?: string;
    message?: string;
    lastTransitionTime?: string;
  }>;
  yaml?: string;
};

// PV
export type PV = {
  id: string;
  name: string;
  capacity: string;
  accessModes: string[];
  reclaimPolicy: "Retain" | "Delete" | "Recycle";
  status: "available" | "bound" | "released";
  storageClass: string;
  claim?: { namespace: string; name: string };
  volumeAttributesClass?: string;
  reason?: string;
  volumeMode?: string;
  age: string;
};

export type PVDetail = {
  id: string;
  name: string;
  capacity?: string;
  accessModes?: string[];
  reclaimPolicy?: string;
  status?: string;
  claim?: { namespace?: string; name?: string };
  storageClass?: string;
  volumeMode?: string;
  volumeAttributesClass?: string;
  mountOptions?: string[];
  age?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  source?: {
    type?: string;
    details?: Record<string, any>;
  };
  events?: Array<{
    type?: string;
    reason?: string;
    message?: string;
    firstTimestamp?: string;
    lastTimestamp?: string;
    count?: number;
  }>;
  conditions?: Array<{
    type?: string;
    status?: string;
    message?: string;
    lastTransitionTime?: string;
    lastProbeTime?: string;
  }>;
  pods?: Array<{
    name?: string;
    namespace?: string;
    status?: string;
    node?: string;
    age?: string;
  }>;
  yaml?: string;
};

// Admin User Management
export type AdminUser = {
  id: string;
  name: string;
  username: string;
  tier: "standard" | "premium";
  email: string;
  projectCount: number;
  cpuUsage: { used: number; total: number };
  memoryUsage: { used: number; total: number };
};

export type AdminUserProject = {
  id: string;
  name: string;
  databaseCount: number;
  backendCount: number;
  frontendCount: number;
  cpuUsage: { used: number; total: number };
  memoryUsage: { used: number; total: number };
};

export type AdminProjectComponent = {
  id: string;
  name: string;
  status: "running" | "stopped" | "error";
  cpu: string;
  memory: string;
  replicas?: string;
  projectName?: string;
  cpuUsed?: string;
  memoryUsed?: string;
  ip?: string;
  port?: number;
  databaseName?: string;
  dbUsername?: string;
  dbPassword?: string;
  node?: string;
  pvc?: string;
  pv?: string;
};

export type AdminProjectDetail = {
  id: string;
  name: string;
  databases: AdminProjectComponent[];
  backends: AdminProjectComponent[];
  frontends: AdminProjectComponent[];
};

export type AdminAccount = {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  role: "ADMIN" | "DEVOPS" | "USER";
  tier: "standard" | "premium";
  status: "active" | "inactive" | "pending";
  projectCount: number;
  services: number;
  createdAt: string;
  lastLogin?: string | null;
};

// Dashboard Overview Metrics
export type DashboardMetrics = {
  nodes: { total: number; healthy: number; unhealthy: number };
  pods: { total: number; running: number; pending: number; failed: number };
  deployments: { total: number; active: number; error: number };
  cpuUsage: { used: number; total: number };
  memoryUsage: { used: number; total: number };
};

// Admin User Services API Responses
export type AdminOverviewResponse = {
  totalUsers: number;
  totalProjects: number;
  totalCpuCores: number;
  totalMemoryGb: number;
};

export type AdminUserUsageResponse = {
  users: Array<{
    id: number;
    fullname: string;
    username: string;
    projectCount: number;
    tier: string;
    cpuCores: number;
    memoryGb: number;
  }>;
};

export type ClusterCapacityResponse = {
  totalCpuCores: number;
  totalMemoryGb: number;
};

export type ClusterAllocatableResponse = {
  totalCpuCores: number;
  totalMemoryGb: number;
};

export type AdminUserProjectSummaryResponse = {
  userId: number;
  fullname: string;
  username: string;
  projectCount: number;
  cpuCores: number;
  memoryGb: number;
};

export type AdminUserProjectListResponse = {
  userId: number;
  fullname: string;
  username: string;
  projects: Array<{
    projectId: number;
    projectName: string;
    databaseCount: number;
    backendCount: number;
    frontendCount: number;
    cpuCores: number;
    memoryGb: number;
  }>;
};

export type AdminProjectResourceDetailResponse = {
  projectId: number;
  projectName: string;
  totalCpuCores: number;
  totalMemoryGb: number;
  databases: Array<{
    id: number;
    projectName: string;
    status: string;
    cpuCores: number;
    memoryGb: number;
  }>;
  backends: Array<{
    id: number;
    projectName: string;
    status: string;
    cpuCores: number;
    memoryGb: number;
  }>;
  frontends: Array<{
    id: number;
    projectName: string;
    status: string;
    cpuCores: number;
    memoryGb: number;
  }>;
};

export type AdminDatabaseDetailResponse = {
  databaseId: number;
  databaseType: string;
  databaseIp: string;
  databasePort: number;
  databaseName: string;
  databaseUsername: string;
  databasePassword: string;
  podName?: string;
  podNode?: string;
  podStatus?: string;
  serviceName?: string;
  serviceExternalIp?: string;
  servicePort?: number;
  statefulSetName?: string;
  pvcName?: string;
  pvcStatus?: string;
  pvcVolume?: string;
  pvcCapacity?: string;
  pvName?: string;
  pvCapacity?: string;
  pvNode?: string;
};

export type AdminBackendDetailResponse = {
  backendId: number;
  projectName: string;
  deploymentType: string;
  frameworkType: string;
  domainNameSystem?: string;
  dockerImage?: string;
  databaseIp?: string;
  databasePort?: number;
  databaseName?: string;
  databaseUsername?: string;
  databasePassword?: string;
  deploymentName?: string;
  replicas?: number;
  podName?: string;
  podNode?: string;
  podStatus?: string;
  serviceName?: string;
  serviceType?: string;
  servicePort?: string;
  ingressName?: string;
  ingressHosts?: string;
  ingressAddress?: string;
  ingressPort?: string;
  ingressClass?: string;
};

export type AdminFrontendDetailResponse = {
  frontendId: number;
  projectName: string;
  deploymentType: string;
  frameworkType: string;
  domainNameSystem?: string;
  dockerImage?: string;
  deploymentName?: string;
  replicas?: number;
  podName?: string;
  podNode?: string;
  podStatus?: string;
  serviceName?: string;
  serviceType?: string;
  servicePort?: string;
  ingressName?: string;
  ingressHosts?: string;
  ingressAddress?: string;
  ingressPort?: string;
  ingressClass?: string;
};

export type AdminReplicaRequest = {
  id: number;
  componentId: number;
  componentType: "BACKEND" | "FRONTEND";
  componentName?: string;
  projectName?: string;
  username?: string;
  oldReplicas: number;
  newReplicas: number;
  status: string;
  reasonReject?: string;
  createdAt: string;
};

