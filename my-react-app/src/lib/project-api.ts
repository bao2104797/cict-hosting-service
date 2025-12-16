/**
 * API service cho projects
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"

export interface ProjectSummaryItem {
  id: number
  projectName: string
  description?: string
  databaseCount: number
  backendCount: number
  frontendCount: number
  updatedAt: string // ISO date string
}

export interface ProjectSummaryResponse {
  projects: ProjectSummaryItem[]
}

/**
 * Lấy danh sách projects của user
 */
export async function getUserProjects(username: string): Promise<ProjectSummaryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects?username=${encodeURIComponent(username)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi lấy danh sách projects" }))
    throw new Error(error.message || "Có lỗi xảy ra khi lấy danh sách projects")
  }

  return response.json()
}

/**
 * Tạo project mới
 */
export interface CreateProjectRequest {
  projectName: string
  description?: string
  username: string
}

export interface CreateProjectResponse {
  id: number
  projectName: string
  description?: string
  uuid_k8s: string
  namespace: string
  createdAt: string
}

export async function createProject(request: CreateProjectRequest): Promise<CreateProjectResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi tạo project" }))
    throw new Error(error.message || "Có lỗi xảy ra khi tạo project")
  }

  return response.json()
}

/**
 * Lấy thông tin cơ bản của project
 */
export interface ProjectBasicInfoResponse {
  id: number
  projectName: string
  description?: string
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
}

export async function getProjectBasicInfo(projectId: string | number): Promise<ProjectBasicInfoResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/basic-info`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi lấy thông tin project" }))
    throw new Error(error.message || "Có lỗi xảy ra khi lấy thông tin project")
  }

  return response.json()
}

/**
 * Project Detail Response
 */
export interface DatabaseDetail {
  id: number
  projectName: string
  description?: string
  databaseType: string // MYSQL, MONGODB
  databaseIp?: string
  databasePort?: number
  databaseName?: string
  databaseUsername?: string
  databasePassword?: string
  uuid_k8s?: string
  sourcePath?: string
  yamlPath?: string
  status: string // RUNNING, STOPPED, ERROR
  createdAt: string // ISO date string
}

export interface BackendDetail {
  id: number
  projectName: string
  description?: string
  deploymentType: string // DOCKER, FILE
  frameworkType: string // SPRING, NODEJS
  databaseIp?: string
  databasePort?: number
  databaseName?: string
  databaseUsername?: string
  databasePassword?: string
  uuid_k8s?: string
  sourcePath?: string
  yamlPath?: string
  dockerImage?: string
  domainNameSystem?: string
  status: string // RUNNING, STOPPED, ERROR
  createdAt: string // ISO date string
}

export interface FrontendDetail {
  id: number
  projectName: string
  description?: string
  deploymentType: string // DOCKER, FILE
  frameworkType: string // REACT, VUE, ANGULAR
  uuid_k8s?: string
  sourcePath?: string
  yamlPath?: string
  dockerImage?: string
  domainNameSystem?: string
  status: string // RUNNING, STOPPED, ERROR
  createdAt: string // ISO date string
}

export interface ProjectDetailResponse {
  id: number
  projectName: string
  description?: string
  status: string // RUNNING, STOPPED, ERROR, PAUSED
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
  uuid_k8s?: string
  namespace?: string
  databases: DatabaseDetail[]
  backends: BackendDetail[]
  frontends: FrontendDetail[]
}

/**
 * Lấy chi tiết project
 */
export async function getProjectDetail(
  projectId: string | number,
  username: string
): Promise<ProjectDetailResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${projectId}?username=${encodeURIComponent(username)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi lấy chi tiết project" }))
    throw new Error(error.message || "Có lỗi xảy ra khi lấy chi tiết project")
  }

  return response.json()
}

/**
 * Lấy thông tin tổng quan của project
 */
export interface ComponentStats {
  total: number
  running: number
  paused: number
  stopped: number
  error: number
}

export interface ProjectOverviewResponse {
  id: number
  projectName: string
  description?: string
  createdAt: string
  updatedAt: string
  uuid_k8s: string
  namespace: string
  databases: ComponentStats
  backends: ComponentStats
  frontends: ComponentStats
}

export async function getProjectOverview(projectId: string | number): Promise<ProjectOverviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/overview`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi lấy thông tin tổng quan project" }))
    throw new Error(error.message || "Có lỗi xảy ra khi lấy thông tin tổng quan project")
  }

  return response.json()
}

/**
 * Lấy danh sách databases của project
 */
export interface DatabaseInfo {
  id: number
  projectName: string
  description?: string
  databaseType: string // MYSQL, MONGODB
  databaseIp: string
  databasePort: number
  databaseName: string
  databaseUsername: string
  databasePassword: string
  status: string // RUNNING, STOPPED, ERROR
  cpu?: string // CPU usage
  memory?: string // Memory usage
  createdAt: string
}

export interface ProjectDatabaseListResponse {
  databases: DatabaseInfo[]
}

export async function getProjectDatabases(projectId: string | number): Promise<ProjectDatabaseListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/databases`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi lấy danh sách databases" }))
    throw new Error(error.message || "Có lỗi xảy ra khi lấy danh sách databases")
  }

  return response.json()
}

/**
 * Lấy danh sách backends của project
 */
export interface BackendInfo {
  id: number
  projectName: string
  description?: string
  deploymentType: string // DOCKER, FILE
  frameworkType: string // SPRING, NODEJS
  databaseIp?: string
  databasePort?: number
  databaseName?: string
  databaseUsername?: string
  databasePassword?: string
  uuid_k8s: string
  sourcePath?: string
  yamlPath?: string
  dockerImage?: string
  domainNameSystem?: string
  replicas?: number
  maxReplicas?: number
  status: string // RUNNING, STOPPED, ERROR
  cpu?: string // CPU usage từ Kubernetes (ví dụ: "100m", "1.5")
  memory?: string // Memory usage từ Kubernetes (ví dụ: "256Mi", "1Gi")
  createdAt: string
}

export interface ProjectBackendListResponse {
  backends: BackendInfo[]
}

export async function getProjectBackends(projectId: string | number): Promise<ProjectBackendListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/backends`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi lấy danh sách backends" }))
    throw new Error(error.message || "Có lỗi xảy ra khi lấy danh sách backends")
  }

  return response.json()
}

export interface BackendScaleRequestPayload {
  backendId: number
  newReplicas: number
}

export interface BackendRequestResponse {
  id: number
  backendId?: number
  oldReplicas: number
  newReplicas: number
  status: string
  createdAt: string
  reasonReject?: string
}

export interface BackendReplicaInfo {
  backendId: number
  replicas: number | null
  maxReplicas: number | null
  hasPendingRequest: boolean
  pendingRequestId: number | null
  pendingNewReplicas: number | null
  pendingStatus?: string
  message?: string
}

export async function createBackendScaleRequest(
  payload: BackendScaleRequestPayload
): Promise<BackendRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/backend-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể gửi yêu cầu điều chỉnh backend" }))
    throw new Error(error.message || "Không thể gửi yêu cầu điều chỉnh backend")
  }

  return response.json()
}

export async function getBackendReplicaInfo(backendId: number): Promise<BackendReplicaInfo> {
  const response = await fetch(`${API_BASE_URL}/api/project-backends/${backendId}/replicas`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể lấy thông tin replicas backend" }))
    throw new Error(error.message || "Không thể lấy thông tin replicas backend")
  }

  return response.json()
}

export async function cancelBackendScaleRequest(requestId: number): Promise<BackendRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/backend-requests/${requestId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể hủy yêu cầu điều chỉnh backend" }))
    throw new Error(error.message || "Không thể hủy yêu cầu điều chỉnh backend")
  }

  return response.json()
}

export interface FrontendScaleRequestPayload {
  frontendId: number
  newReplicas: number
}

export interface FrontendRequestResponse {
  id: number
  frontendId?: number
  oldReplicas: number
  newReplicas: number
  status: string
  createdAt: string
  reasonReject?: string
}

export interface FrontendReplicaInfo {
  frontendId: number
  replicas: number | null
  maxReplicas: number | null
  hasPendingRequest: boolean
  pendingRequestId: number | null
  pendingNewReplicas: number | null
  pendingStatus?: string
  message?: string
}

export async function createFrontendScaleRequest(
  payload: FrontendScaleRequestPayload
): Promise<FrontendRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/frontend-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể gửi yêu cầu điều chỉnh frontend" }))
    throw new Error(error.message || "Không thể gửi yêu cầu điều chỉnh frontend")
  }

  return response.json()
}

export async function getFrontendReplicaInfo(frontendId: number): Promise<FrontendReplicaInfo> {
  const response = await fetch(`${API_BASE_URL}/api/project-frontends/${frontendId}/replicas`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể lấy thông tin replicas frontend" }))
    throw new Error(error.message || "Không thể lấy thông tin replicas frontend")
  }

  return response.json()
}

export async function cancelFrontendScaleRequest(requestId: number): Promise<FrontendRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/frontend-requests/${requestId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể hủy yêu cầu điều chỉnh frontend" }))
    throw new Error(error.message || "Không thể hủy yêu cầu điều chỉnh frontend")
  }

  return response.json()
}

/**
 * Lấy danh sách frontends của project
 */
export interface FrontendInfo {
  id: number
  projectName: string
  description?: string
  deploymentType: string // DOCKER, FILE
  frameworkType: string // REACT, VUE, ANGULAR
  uuid_k8s: string
  sourcePath?: string
  yamlPath?: string
  dockerImage?: string
  domainNameSystem?: string
  replicas?: number
  maxReplicas?: number
  status: string // RUNNING, STOPPED, ERROR
  cpu?: string // CPU usage
  memory?: string // Memory usage
  createdAt: string
}

export interface ProjectFrontendListResponse {
  frontends: FrontendInfo[]
}

export async function getProjectFrontends(projectId: string | number): Promise<ProjectFrontendListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/frontends`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi lấy danh sách frontends" }))
    throw new Error(error.message || "Có lỗi xảy ra khi lấy danh sách frontends")
  }

  return response.json()
}

/**
 * Xóa project
 */
export async function deleteProject(projectId: string | number, username: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}?username=${encodeURIComponent(username)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi xóa project" }))
    throw new Error(error.message || "Có lỗi xảy ra khi xóa project")
  }
}

/**
 * Lịch sử triển khai
 */
export interface DeploymentHistoryItem {
  type: "PROJECT" | "DATABASE" | "BACKEND" | "FRONTEND"
  id: number
  name: string
  description?: string
  createdAt: string
  databaseType?: string
  frameworkType?: string
  deploymentType?: string
}

export interface ProjectDeploymentHistoryResponse {
  projectId: number
  projectName: string
  projectCreatedAt: string
  historyItems: DeploymentHistoryItem[]
}

export async function getProjectDeploymentHistory(projectId: string | number): Promise<ProjectDeploymentHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/deployment-history`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi lấy lịch sử triển khai" }))
    throw new Error(error.message || "Có lỗi xảy ra khi lấy lịch sử triển khai")
  }

  return response.json()
}

/**
 * Lịch sử yêu cầu
 */
export interface ProjectRequestHistoryResponse {
  projectId: number
  projectName: string
  requestItems: RequestHistoryItem[]
}

export interface RequestHistoryItem {
  type: "BACKEND" | "FRONTEND"
  id: number
  componentId: number
  componentName: string
  oldReplicas: number
  newReplicas: number
  status: "PENDING" | "APPROVED" | "REJECTED"
  reasonReject?: string | null
  createdAt: string // ISO date string
}

export async function getProjectRequestHistory(projectId: string | number): Promise<ProjectRequestHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/request-history`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi lấy lịch sử yêu cầu" }))
    throw new Error(error.message || "Có lỗi xảy ra khi lấy lịch sử yêu cầu")
  }

  return response.json()
}

/**
 * Deploy Database
 */
export interface DeployDatabaseRequest {
  projectName: string
  databaseType: "MYSQL" | "MONGODB"
  databaseName: string
  databaseUsername: string
  databasePassword: string
  file?: File | null
  username: string
  projectId: number
}

export interface DeployDatabaseResponse {
  status: string
  databaseIp: string
  databasePort: number
  databaseName: string
  databaseUsername: string
  databasePassword: string
}

export async function deployDatabase(request: DeployDatabaseRequest): Promise<DeployDatabaseResponse> {
  const formData = new FormData()
  formData.append("projectName", request.projectName)
  formData.append("databaseType", request.databaseType)
  formData.append("databaseName", request.databaseName)
  formData.append("databaseUsername", request.databaseUsername)
  formData.append("databasePassword", request.databasePassword)
  formData.append("username", request.username)
  formData.append("projectId", String(request.projectId))
  
  if (request.file) {
    formData.append("file", request.file)
  }

  const response = await fetch(`${API_BASE_URL}/api/project-databases/deploy`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi triển khai database" }))
    throw new Error(error.message || "Có lỗi xảy ra khi triển khai database")
  }

  return response.json()
}

/**
 * Deploy Backend
 */
export interface DeployBackendRequest {
  projectName: string
  deploymentType: "DOCKER" | "FILE"
  frameworkType: "SPRINGBOOT" | "NODEJS"
  dockerImage?: string
  file?: File | null
  databaseIp: string
  databasePort: number
  databaseName: string
  databaseUsername: string
  databasePassword: string
  domainNameSystem: string
  username: string
  projectId: number
}

export interface DeployBackendResponse {
  url: string
  status: string
  domainNameSystem: string
}

export async function deployBackend(request: DeployBackendRequest): Promise<DeployBackendResponse> {
  const formData = new FormData()
  formData.append("projectName", request.projectName)
  formData.append("deploymentType", request.deploymentType)
  formData.append("frameworkType", request.frameworkType)
  formData.append("databaseIp", request.databaseIp)
  formData.append("databasePort", String(request.databasePort))
  formData.append("databaseName", request.databaseName)
  formData.append("databaseUsername", request.databaseUsername)
  formData.append("databasePassword", request.databasePassword)
  formData.append("domainNameSystem", request.domainNameSystem)
  formData.append("username", request.username)
  formData.append("projectId", String(request.projectId))
  
  if (request.deploymentType === "DOCKER" && request.dockerImage) {
    formData.append("dockerImage", request.dockerImage)
  }
  
  if (request.deploymentType === "FILE" && request.file) {
    formData.append("file", request.file)
  }

  const response = await fetch(`${API_BASE_URL}/api/project-backends/deploy`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi triển khai backend" }))
    throw new Error(error.message || "Có lỗi xảy ra khi triển khai backend")
  }

  return response.json()
}

/**
 * Deploy Frontend
 */
export interface DeployFrontendRequest {
  projectName: string
  deploymentType: "DOCKER" | "FILE"
  frameworkType: "REACT" | "VUE" | "ANGULAR"
  dockerImage?: string
  file?: File | null
  domainNameSystem: string
  username: string
  projectId: number
}

export interface DeployFrontendResponse {
  url: string
  status: string
  domainNameSystem: string
}

export async function deployFrontend(request: DeployFrontendRequest): Promise<DeployFrontendResponse> {
  const formData = new FormData()
  formData.append("projectName", request.projectName)
  formData.append("deploymentType", request.deploymentType)
  formData.append("frameworkType", request.frameworkType)
  formData.append("domainNameSystem", request.domainNameSystem)
  formData.append("username", request.username)
  formData.append("projectId", String(request.projectId))
  
  if (request.deploymentType === "DOCKER" && request.dockerImage) {
    formData.append("dockerImage", request.dockerImage)
  }
  
  if (request.deploymentType === "FILE" && request.file) {
    formData.append("file", request.file)
  }

  const response = await fetch(`${API_BASE_URL}/api/project-frontends/deploy`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi triển khai frontend" }))
    throw new Error(error.message || "Có lỗi xảy ra khi triển khai frontend")
  }

  return response.json()
}

/**
 * Điều khiển frontend đang triển khai
 */
export async function stopProjectFrontend(projectId: string | number, frontendId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/project-frontends/${projectId}/${frontendId}/stop`, {
    method: "POST",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể tạm dừng frontend" }))
    throw new Error(error.message || "Không thể tạm dừng frontend")
  }
}

export async function startProjectFrontend(projectId: string | number, frontendId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/project-frontends/${projectId}/${frontendId}/start`, {
    method: "POST",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể khởi động frontend" }))
    throw new Error(error.message || "Không thể khởi động frontend")
  }
}

/**
 * Điều khiển backend đang triển khai
 */
export async function stopProjectBackend(projectId: string | number, backendId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/project-backends/${projectId}/${backendId}/stop`, {
    method: "POST",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể tạm dừng backend" }))
    throw new Error(error.message || "Không thể tạm dừng backend")
  }
}

export async function startProjectBackend(projectId: string | number, backendId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/project-backends/${projectId}/${backendId}/start`, {
    method: "POST",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể khởi động backend" }))
    throw new Error(error.message || "Không thể khởi động backend")
  }
}

export async function deleteProjectBackend(projectId: string | number, backendId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/project-backends/${projectId}/${backendId}/delete`, {
    method: "POST",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể xóa backend" }))
    throw new Error(error.message || "Không thể xóa backend")
  }
}

export async function deleteProjectFrontend(projectId: string | number, frontendId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/project-frontends/${projectId}/${frontendId}/delete`, {
    method: "POST",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể xóa frontend" }))
    throw new Error(error.message || "Không thể xóa frontend")
  }
}

/**
 * Điều khiển database đang triển khai
 */
export async function stopProjectDatabase(projectId: string | number, databaseId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/project-databases/${projectId}/${databaseId}/stop`, {
    method: "POST",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể tạm dừng database" }))
    throw new Error(error.message || "Không thể tạm dừng database")
  }
}

export async function startProjectDatabase(projectId: string | number, databaseId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/project-databases/${projectId}/${databaseId}/start`, {
    method: "POST",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể khởi động database" }))
    throw new Error(error.message || "Không thể khởi động database")
  }
}

export async function deleteProjectDatabase(projectId: string | number, databaseId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/project-databases/${projectId}/${databaseId}/delete`, {
    method: "POST",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể xóa database" }))
    throw new Error(error.message || "Không thể xóa database")
  }
}

/**
 * Kiểm tra domainNameSystem đã tồn tại chưa
 */
export interface DNSCheckResponse {
  exists: boolean
  message: string
}

export async function checkDomainNameSystem(domainNameSystem: string): Promise<DNSCheckResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/dns/check?domainNameSystem=${encodeURIComponent(domainNameSystem)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Không thể kiểm tra DNS" }))
    throw new Error(error.message || "Không thể kiểm tra DNS")
  }

  return response.json()
}

