/**
 * Types cho Project và các components
 */

export type ComponentStatus = "pending" | "building" | "deployed" | "error";

export type ProjectStatus = "running" | "deploying" | "error" | "paused";

export type DatabaseItem = {
  id: string;
  name: string;
  type: "mysql" | "mongodb";
  provision: "user" | "system";
  databaseName?: string; // Tên database thực tế trên server (khi chọn "Của người dùng")
  endpoint?: string; // host:port
  username?: string;
  hasSeedZip?: boolean;
  status: ComponentStatus;
};

export type BackendItem = {
  id: string;
  name: string;
  tech: "spring" | "node";
  source: { kind: "zip" | "image"; ref: string }; // path hoặc repo:tag
  env?: Record<string, string>;
  dns?: string;
  version?: string;
  status: ComponentStatus;
  buildCommand?: string;
  outputDir?: string;
};

export type FrontendItem = {
  id: string;
  name: string;
  tech: "react" | "vue" | "angular";
  source: { kind: "zip" | "image"; ref: string };
  runtimeEnv?: Record<string, string>;
  publicUrl?: string;
  status: ComponentStatus;
  buildCommand?: string;
  outputDir?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt?: string;
  updatedAt: string; // ISO
  endpoints?: { label: string; url: string }[];
  components: {
    databases: DatabaseItem[];
    backends: BackendItem[];
    frontends: FrontendItem[];
  };
  // Optional counts từ API (khi không có full components data)
  _counts?: {
    databases: number;
    backends: number;
    frontends: number;
  };
};

// Types cho wizard form
export type DatabaseFormData = {
  name: string;
  type: "mysql" | "mongodb";
  provision: "user" | "system";
  databaseName?: string; // Tên database thực tế trên server (khi chọn "Của người dùng")
  ip?: string;
  port?: string;
  username?: string;
  password?: string;
  seedZip?: File;
};

export type BackendFormData = {
  name: string;
  tech: "spring" | "node";
  sourceType: "zip" | "image";
  zipFile?: File;
  dockerImage?: string;
  env: Array<{ key: string; value: string }>; // Database connection env vars
  dns?: string;
};

export type FrontendFormData = {
  name: string;
  tech: "react" | "vue" | "angular";
  sourceType: "zip" | "image";
  zipFile?: File;
  dockerImage?: string;
  publicUrl?: string;
};

export type WizardData = {
  projectName: string;
  description: string;
  projectId?: number; // ID của project đã được tạo
  databases: DatabaseFormData[];
  backends: BackendFormData[];
  frontends: FrontendFormData[];
  currentStep: number;
};

