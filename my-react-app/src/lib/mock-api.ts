/**
 * Mock API service - Lưu dữ liệu trong memory và localStorage
 */
import type { Project, DatabaseItem, BackendItem, FrontendItem } from "@/types"

// Seed data mẫu
const seedProjects: Project[] = [
  {
    id: "1",
    name: "E-Commerce Platform",
    description: "Hệ thống thương mại điện tử với React frontend, Spring Boot backend và MySQL database",
    status: "running",
    updatedAt: "2024-01-20T14:30:00Z",
    endpoints: [
      { label: "Frontend", url: "https://ecommerce.example.com" },
      { label: "API", url: "https://api-ecommerce.example.com" },
    ],
    components: {
      databases: [
        {
          id: "db1",
          name: "ecommerce-db",
          type: "mysql",
          provision: "system",
          status: "deployed",
        },
      ],
      backends: [
        {
          id: "be1",
          name: "api-service",
          tech: "spring",
          source: { kind: "image", ref: "docker.io/ecommerce/backend:1.2.0" },
          dns: "api-ecommerce.example.com",
          version: "1.2.0",
          status: "deployed",
        },
      ],
      frontends: [
        {
          id: "fe1",
          name: "web-app",
          tech: "react",
          source: { kind: "image", ref: "docker.io/ecommerce/frontend:2.1.0" },
          publicUrl: "ecommerce.example.com",
          status: "deployed",
        },
      ],
    },
  },
  {
    id: "2",
    name: "Blog CMS",
    description: "Hệ thống quản lý nội dung blog với Angular frontend, Node.js backend và MongoDB",
    status: "running",
    updatedAt: "2024-01-20T15:00:00Z",
    endpoints: [
      { label: "Frontend", url: "https://blog.example.com" },
      { label: "Admin Panel", url: "https://admin-blog.example.com" },
      { label: "API", url: "https://api-blog.example.com" },
    ],
    components: {
      databases: [
        {
          id: "db2-1",
          name: "blog-db",
          type: "mongodb",
          provision: "user",
          endpoint: "192.168.1.101:27017",
          username: "bloguser",
          status: "deployed",
        },
        {
          id: "db2-2",
          name: "analytics-db",
          type: "mysql",
          provision: "system",
          status: "deployed",
        },
        {
          id: "db2-3",
          name: "cache-db",
          type: "mongodb",
          provision: "system",
          status: "paused",
        },
      ],
      backends: [
        {
          id: "be2-1",
          name: "api-server",
          tech: "node",
          source: { kind: "image", ref: "docker.io/blog/backend:3.0.0" },
          dns: "api-blog.example.com",
          version: "3.0.0",
          status: "deployed",
          env: {
            NODE_ENV: "production",
            PORT: "3000",
          },
        },
        {
          id: "be2-2",
          name: "auth-service",
          tech: "node",
          source: { kind: "image", ref: "docker.io/blog/auth:1.2.0" },
          dns: "auth-blog.example.com",
          version: "1.2.0",
          status: "deployed",
        },
        {
          id: "be2-3",
          name: "analytics-service",
          tech: "spring",
          source: { kind: "image", ref: "docker.io/blog/analytics:2.1.0" },
          dns: "analytics-blog.example.com",
          version: "2.1.0",
          status: "building",
        },
      ],
      frontends: [
        {
          id: "fe2-1",
          name: "admin-panel",
          tech: "angular",
          source: { kind: "image", ref: "docker.io/blog/frontend:1.5.0" },
          publicUrl: "admin-blog.example.com",
          status: "deployed",
          runtimeEnv: {
            API_BASE_URL: "https://api-blog.example.com",
          },
        },
        {
          id: "fe2-2",
          name: "public-site",
          tech: "react",
          source: { kind: "image", ref: "docker.io/blog/public:2.0.0" },
          publicUrl: "blog.example.com",
          status: "deployed",
          runtimeEnv: {
            REACT_APP_API_URL: "https://api-blog.example.com",
          },
        },
        {
          id: "fe2-3",
          name: "mobile-web",
          tech: "vue",
          source: { kind: "image", ref: "docker.io/blog/mobile:1.0.0" },
          publicUrl: "m-blog.example.com",
          status: "paused",
        },
      ],
    },
  },
  {
    id: "3",
    name: "Portfolio Website",
    description: "Website portfolio cá nhân với Vue.js frontend",
    status: "paused",
    updatedAt: "2024-01-15T10:00:00Z",
    endpoints: [{ label: "Website", url: "https://portfolio.example.com" }],
    components: {
      databases: [],
      backends: [],
      frontends: [
        {
          id: "fe3",
          name: "portfolio",
          tech: "vue",
          source: { kind: "image", ref: "docker.io/portfolio/frontend:1.0.0" },
          publicUrl: "portfolio.example.com",
          status: "error",
        },
      ],
    },
  },
]

// Load từ localStorage
const loadProjects = (): Project[] => {
  try {
    const stored = localStorage.getItem("projects")
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error("Lỗi load projects từ localStorage:", error)
  }
  return seedProjects
}

// Save vào localStorage
const saveProjects = (projects: Project[]) => {
  try {
    localStorage.setItem("projects", JSON.stringify(projects))
  } catch (error) {
    console.error("Lỗi save projects vào localStorage:", error)
  }
}

// Khởi tạo
let projects = loadProjects()

/**
 * Lấy danh sách projects (có thể filter)
 */
export const getProjects = async (
  query?: string,
  status?: string
): Promise<Project[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let result = [...projects]

      // Filter theo query
      if (query?.trim()) {
        const lowerQuery = query.toLowerCase()
        result = result.filter(
          (p) =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.description?.toLowerCase().includes(lowerQuery)
        )
      }

      // Filter theo status
      if (status && status !== "all") {
        result = result.filter((p) => p.status === status)
      }

      resolve(result)
    }, 300)
  })
}

/**
 * Lấy chi tiết project theo ID
 */
export const getProjectById = async (id: string): Promise<Project> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const project = projects.find((p) => p.id === id)
      if (project) {
        resolve(project)
      } else {
        reject(new Error("Project not found"))
      }
    }, 300)
  })
}

/**
 * Tạo project mới
 */
export const createProject = async (payload: {
  name: string
  description?: string
  databases: DatabaseItem[]
  backends: BackendItem[]
  frontends: FrontendItem[]
}): Promise<Project> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newProject: Project = {
        id: String(Date.now()),
        name: payload.name,
        description: payload.description,
        status: "deploying",
        updatedAt: new Date().toISOString(),
        components: {
          databases: payload.databases,
          backends: payload.backends,
          frontends: payload.frontends,
        },
      }

      projects.push(newProject)
      saveProjects(projects)

      resolve(newProject)
    }, 500)
  })
}

/**
 * Deploy project (mock)
 */
export const deployProject = async (projectId: string): Promise<{ jobId: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ jobId: `job-${Date.now()}` })
    }, 500)
  })
}

/**
 * Thêm database vào project
 */
export const addDatabaseToProject = async (
  projectId: string,
  database: Omit<DatabaseItem, "id" | "status">
): Promise<Project> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const project = projects.find((p) => p.id === projectId)
      if (!project) {
        reject(new Error("Project not found"))
        return
      }

      const newDatabase: DatabaseItem = {
        ...database,
        id: `db-${Date.now()}`,
        status: "pending",
      }

      project.components.databases.push(newDatabase)
      project.updatedAt = new Date().toISOString()
      saveProjects(projects)

      resolve(project)
    }, 300)
  })
}

/**
 * Thêm backend vào project
 */
export const addBackendToProject = async (
  projectId: string,
  backend: Omit<BackendItem, "id" | "status">
): Promise<Project> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const project = projects.find((p) => p.id === projectId)
      if (!project) {
        reject(new Error("Project not found"))
        return
      }

      const newBackend: BackendItem = {
        ...backend,
        id: `be-${Date.now()}`,
        status: "pending",
      }

      project.components.backends.push(newBackend)
      project.updatedAt = new Date().toISOString()
      saveProjects(projects)

      resolve(project)
    }, 300)
  })
}

/**
 * Thêm frontend vào project
 */
export const addFrontendToProject = async (
  projectId: string,
  frontend: Omit<FrontendItem, "id" | "status">
): Promise<Project> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const project = projects.find((p) => p.id === projectId)
      if (!project) {
        reject(new Error("Project not found"))
        return
      }

      const newFrontend: FrontendItem = {
        ...frontend,
        id: `fe-${Date.now()}`,
        status: "pending",
      }

      project.components.frontends.push(newFrontend)
      project.updatedAt = new Date().toISOString()
      saveProjects(projects)

      resolve(project)
    }, 300)
  })
}

