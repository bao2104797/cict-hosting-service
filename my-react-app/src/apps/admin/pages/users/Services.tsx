import React, { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { adminAPI } from "@/lib/admin-api";
import type {
  AdminUser,
  AdminUserProject,
  AdminProjectDetail,
  AdminProjectComponent,
  AdminOverviewResponse,
  ClusterCapacityResponse,
  AdminUserProjectSummaryResponse,
  AdminUserProjectListResponse,
  AdminProjectResourceDetailResponse,
  AdminDatabaseDetailResponse,
  AdminBackendDetailResponse,
  AdminFrontendDetailResponse,
} from "@/types/admin";
import { ResourceTable } from "../../components/ResourceTable";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  ArrowLeft,
  Users,
  FolderTree,
  Cpu,
  MemoryStick,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Trash2,
  Eye,
  Database,
  Server,
  Network,
  Box,
  HardDrive,
  HardDriveIcon,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  Activity,
  Settings,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { toast } from "sonner";

type ViewState = "users" | "projects" | "projectDetail";

export function Services() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [clusterCapacity, setClusterCapacity] = useState<ClusterCapacityResponse | null>(null);
  const [clusterCapacityLoading, setClusterCapacityLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [projects, setProjects] = useState<AdminUserProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [userSummary, setUserSummary] = useState<AdminUserProjectSummaryResponse | null>(null);
  const [userProjectsDetail, setUserProjectsDetail] = useState<AdminUserProjectListResponse | null>(null);
  const [userViewClusterCapacity, setUserViewClusterCapacity] = useState<ClusterCapacityResponse | null>(null);

  const [selectedProject, setSelectedProject] = useState<AdminUserProject | null>(null);
  const [projectDetail, setProjectDetail] = useState<AdminProjectDetail | null>(null);
  const [projectDetailLoading, setProjectDetailLoading] = useState(false);
  const [componentDetail, setComponentDetail] = useState<{
    item: AdminProjectComponent;
    type: "databases" | "backends" | "frontends";
  } | null>(null);
  const [isComponentDialogOpen, setComponentDialogOpen] = useState(false);
  const [databaseDetail, setDatabaseDetail] = useState<AdminDatabaseDetailResponse | null>(null);
  const [databaseDetailLoading, setDatabaseDetailLoading] = useState(false);
  const [databaseDetailError, setDatabaseDetailError] = useState<string | null>(null);
  const [backendDetail, setBackendDetail] = useState<AdminBackendDetailResponse | null>(null);
  const [backendDetailLoading, setBackendDetailLoading] = useState(false);
  const [backendDetailError, setBackendDetailError] = useState<string | null>(null);
  const [frontendDetail, setFrontendDetail] = useState<AdminFrontendDetailResponse | null>(null);
  const [frontendDetailLoading, setFrontendDetailLoading] = useState(false);
  const [frontendDetailError, setFrontendDetailError] = useState<string | null>(null);

  const [view, setView] = useState<ViewState>("users");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentProjectPage, setCurrentProjectPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Expandable rows state
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [userProjectsMap, setUserProjectsMap] = useState<Record<string, {
    projects: AdminUserProject[];
    summary: AdminUserProjectSummaryResponse | null;
    loading: boolean;
  }>>({});
  const [projectDetailsMap, setProjectDetailsMap] = useState<Record<string, {
    detail: AdminProjectDetail | null;
    loading: boolean;
  }>>({});

  // Sử dụng overview cho số lượng users và projects
  const totalUsers = overview?.totalUsers ?? users.length;
  const totalProjects = overview?.totalProjects ?? users.reduce((sum, user) => sum + user.projectCount, 0);
  // Sử dụng overview cho tổng CPU/Memory đang dùng
  const totalCpuUsed = overview?.totalCpuCores ?? users.reduce((sum, user) => sum + user.cpuUsage.used, 0);
  // Sử dụng cluster capacity từ API mới cho phần sau dấu /
  const totalCpuCapacity = clusterCapacity?.totalCpuCores ?? 0;
  const totalMemUsed = overview?.totalMemoryGb ?? users.reduce((sum, user) => sum + user.memoryUsage.used, 0);
  const totalMemCapacity = clusterCapacity?.totalMemoryGb ?? 0;

  useEffect(() => {
    const loadData = async () => {
      try {
        setUsersLoading(true);
        setOverviewLoading(true);
        setClusterCapacityLoading(true);
        
        // Gọi 3 API song song
        const [usersData, overviewData, capacityData] = await Promise.all([
          adminAPI.getAdminUsers(),
          adminAPI.getOverview(),
          adminAPI.getClusterCapacity(),
        ]);
        
        setUsers(usersData);
        setOverview(overviewData);
        setClusterCapacity(capacityData);
      } catch (error) {
        toast.error("Không thể tải dữ liệu");
        console.error("Error loading data:", error);
      } finally {
        setUsersLoading(false);
        setOverviewLoading(false);
        setClusterCapacityLoading(false);
      }
    };
    loadData();
  }, []);

  // Restore state from URL params on mount
  useEffect(() => {
    if (users.length === 0) return; // Wait for users to load

    const userId = searchParams.get("userId");
    const projectId = searchParams.get("projectId");
    const viewParam = searchParams.get("view") as ViewState | null;

    if (!viewParam || !userId) return; // No state to restore

    const user = users.find((u) => u.id === userId);
    if (!user) return; // User not found

    setSelectedUser(user);
    setView(viewParam);

    if (viewParam === "projects") {
      // Load projects for user
      const loadProjects = async () => {
        try {
          setProjectsLoading(true);
          
          // Gọi 3 API song song
          const [summaryData, projectsData, capacityData] = await Promise.all([
            adminAPI.getUserSummary(user.id),
            adminAPI.getUserProjectsDetail(user.id),
            adminAPI.getClusterCapacity(),
          ]);
          
          setUserSummary(summaryData);
          setUserProjectsDetail(projectsData);
          setUserViewClusterCapacity(capacityData);
          
          // Map dữ liệu từ API response sang format AdminUserProject
          const mappedProjects: AdminUserProject[] = projectsData.projects.map((project) => ({
            id: String(project.projectId),
            name: project.projectName,
            databaseCount: project.databaseCount,
            backendCount: project.backendCount,
            frontendCount: project.frontendCount,
            cpuUsage: {
              used: project.cpuCores,
              total: capacityData.totalCpuCores,
            },
            memoryUsage: {
              used: project.memoryGb,
              total: capacityData.totalMemoryGb,
            },
          }));
          
          setProjects(mappedProjects);
        } catch (error) {
          toast.error("Không thể tải danh sách dự án của người dùng");
          console.error("Error loading user projects:", error);
        } finally {
          setProjectsLoading(false);
        }
      };
      loadProjects();
    } else if (viewParam === "projectDetail" && projectId) {
      // Load projects and project detail
      const loadProjectDetail = async () => {
        try {
          setProjectsLoading(true);
          
          // Gọi 3 API song song
          const [summaryData, projectsData, capacityData] = await Promise.all([
            adminAPI.getUserSummary(user.id),
            adminAPI.getUserProjectsDetail(user.id),
            adminAPI.getClusterCapacity(),
          ]);
          
          setUserSummary(summaryData);
          setUserProjectsDetail(projectsData);
          setUserViewClusterCapacity(capacityData);
          
          // Map dữ liệu từ API response sang format AdminUserProject
          const mappedProjects: AdminUserProject[] = projectsData.projects.map((project) => ({
            id: String(project.projectId),
            name: project.projectName,
            databaseCount: project.databaseCount,
            backendCount: project.backendCount,
            frontendCount: project.frontendCount,
            cpuUsage: {
              used: project.cpuCores,
              total: capacityData.totalCpuCores,
            },
            memoryUsage: {
              used: project.memoryGb,
              total: capacityData.totalMemoryGb,
            },
          }));
          
          setProjects(mappedProjects);
          const project = mappedProjects.find((p) => p.id === projectId);
          if (project) {
            setSelectedProject(project);
            setProjectDetailLoading(true);
            
            try {
              const resourceDetail = await adminAPI.getProjectResources(project.id);
              
              // Map dữ liệu từ AdminProjectResourceDetailResponse sang AdminProjectDetail
              const mappedDetail: AdminProjectDetail = {
                id: String(resourceDetail.projectId),
                name: resourceDetail.projectName,
                databases: resourceDetail.databases.map((db) => ({
                  id: String(db.id),
                  name: `database-${db.id}`,
                  status: db.status.toLowerCase() as "running" | "stopped" | "error",
                  cpu: `${db.cpuCores} cores`,
                  memory: `${db.memoryGb} GB`,
                  cpuUsed: `${db.cpuCores} cores`,
                  memoryUsed: `${db.memoryGb} GB`,
                  projectName: db.projectName,
                })),
                backends: resourceDetail.backends.map((be) => ({
                  id: String(be.id),
                  name: `backend-${be.id}`,
                  status: be.status.toLowerCase() as "running" | "stopped" | "error",
                  cpu: `${be.cpuCores} cores`,
                  memory: `${be.memoryGb} GB`,
                  cpuUsed: `${be.cpuCores} cores`,
                  memoryUsed: `${be.memoryGb} GB`,
                  projectName: be.projectName,
                })),
                frontends: resourceDetail.frontends.map((fe) => ({
                  id: String(fe.id),
                  name: `frontend-${fe.id}`,
                  status: fe.status.toLowerCase() as "running" | "stopped" | "error",
                  cpu: `${fe.cpuCores} cores`,
                  memory: `${fe.memoryGb} GB`,
                  cpuUsed: `${fe.cpuCores} cores`,
                  memoryUsed: `${fe.memoryGb} GB`,
                  projectName: fe.projectName,
                })),
              };
              
              setProjectDetail(mappedDetail);
            } catch (error) {
              console.error("Error loading project resources:", error);
              toast.error("Không thể tải chi tiết dự án");
            } finally {
              setProjectDetailLoading(false);
            }
          }
        } catch (error) {
          toast.error("Không thể tải chi tiết dự án");
          console.error("Error loading project detail:", error);
        } finally {
          setProjectsLoading(false);
        }
      };
      loadProjectDetail();
    }
  }, [users, searchParams]);

  // Toggle expand user và load projects - chỉ cho phép 1 user expand tại một thời điểm
  const toggleUserExpand = async (user: AdminUser) => {
    const isExpanded = expandedUsers.has(user.id);
    
    if (isExpanded) {
      // Nếu đang expanded, đóng lại
      setExpandedUsers(new Set());
      // Đóng tất cả projects của user này
      const userProjectKeys = Array.from(expandedProjects).filter(key => key.startsWith(`${user.id}-`));
      if (userProjectKeys.length > 0) {
        const newExpandedProjects = new Set(expandedProjects);
        userProjectKeys.forEach(key => newExpandedProjects.delete(key));
        setExpandedProjects(newExpandedProjects);
      }
    } else {
      // Đóng tất cả users khác và projects của chúng
      setExpandedUsers(new Set([user.id]));
      setExpandedProjects(new Set());
      
      // Load projects nếu chưa có
      if (!userProjectsMap[user.id]) {
        setUserProjectsMap(prev => ({
          ...prev,
          [user.id]: { projects: [], summary: null, loading: true }
        }));
        
        try {
      const [summaryData, projectsData, capacityData] = await Promise.all([
        adminAPI.getUserSummary(user.id),
        adminAPI.getUserProjectsDetail(user.id),
        adminAPI.getClusterCapacity(),
      ]);
      
      const mappedProjects: AdminUserProject[] = projectsData.projects.map((project) => ({
        id: String(project.projectId),
        name: project.projectName,
        databaseCount: project.databaseCount,
        backendCount: project.backendCount,
        frontendCount: project.frontendCount,
        cpuUsage: {
          used: project.cpuCores,
              total: capacityData.totalCpuCores,
        },
        memoryUsage: {
          used: project.memoryGb,
              total: capacityData.totalMemoryGb,
        },
      }));
      
          setUserProjectsMap(prev => ({
            ...prev,
            [user.id]: { projects: mappedProjects, summary: summaryData, loading: false }
          }));
    } catch (error) {
      toast.error("Không thể tải danh sách dự án của người dùng");
          setUserProjectsMap(prev => ({
            ...prev,
            [user.id]: { projects: [], summary: null, loading: false }
          }));
        }
      }
    }
  };

  // Toggle expand project và load components
  const toggleProjectExpand = async (project: AdminUserProject, userId: string) => {
    const projectKey = `${userId}-${project.id}`;
    const isExpanded = expandedProjects.has(projectKey);
    const newExpanded = new Set(expandedProjects);
    
    if (isExpanded) {
      newExpanded.delete(projectKey);
      setExpandedProjects(newExpanded);
    } else {
      newExpanded.add(projectKey);
      setExpandedProjects(newExpanded);
      
      // Load project detail nếu chưa có
      if (!projectDetailsMap[project.id]) {
        setProjectDetailsMap(prev => ({
          ...prev,
          [project.id]: { detail: null, loading: true }
        }));
        
        try {
          const resourceDetail = await adminAPI.getProjectResources(project.id);
          
          const mappedDetail: AdminProjectDetail = {
            id: String(resourceDetail.projectId),
            name: resourceDetail.projectName,
            databases: resourceDetail.databases.map((db) => ({
              id: String(db.id),
              name: `database-${db.id}`,
              status: db.status.toLowerCase() as "running" | "stopped" | "error",
              cpu: `${db.cpuCores} cores`,
              memory: `${db.memoryGb} GB`,
              cpuUsed: `${db.cpuCores} cores`,
              memoryUsed: `${db.memoryGb} GB`,
              projectName: db.projectName,
            })),
            backends: resourceDetail.backends.map((be) => ({
              id: String(be.id),
              name: `backend-${be.id}`,
              status: be.status.toLowerCase() as "running" | "stopped" | "error",
              cpu: `${be.cpuCores} cores`,
              memory: `${be.memoryGb} GB`,
              cpuUsed: `${be.cpuCores} cores`,
              memoryUsed: `${be.memoryGb} GB`,
              projectName: be.projectName,
            })),
            frontends: resourceDetail.frontends.map((fe) => ({
              id: String(fe.id),
              name: `frontend-${fe.id}`,
              status: fe.status.toLowerCase() as "running" | "stopped" | "error",
              cpu: `${fe.cpuCores} cores`,
              memory: `${fe.memoryGb} GB`,
              cpuUsed: `${fe.cpuCores} cores`,
              memoryUsed: `${fe.memoryGb} GB`,
              projectName: fe.projectName,
            })),
          };
          
          setProjectDetailsMap(prev => ({
            ...prev,
            [project.id]: { detail: mappedDetail, loading: false }
          }));
        } catch (error) {
          toast.error("Không thể tải chi tiết dự án");
          setProjectDetailsMap(prev => ({
            ...prev,
            [project.id]: { detail: null, loading: false }
          }));
    }
      }
    }
  };

  // Giữ lại handleViewUser cho backward compatibility (nếu cần)
  const handleViewUser = async (user: AdminUser) => {
    await toggleUserExpand(user);
  };

  const handleViewProject = async (project: AdminUserProject) => {
    setSelectedProject(project);
    setProjectDetail(null);
    setView("projectDetail");
    if (selectedUser) {
      setSearchParams({
        view: "projectDetail",
        userId: selectedUser.id,
        projectId: project.id,
      });
    }
    try {
      setProjectDetailLoading(true);
      const resourceDetail = await adminAPI.getProjectResources(project.id);
      
      // Map dữ liệu từ AdminProjectResourceDetailResponse sang AdminProjectDetail
      const mappedDetail: AdminProjectDetail = {
        id: String(resourceDetail.projectId),
        name: resourceDetail.projectName,
        databases: resourceDetail.databases.map((db) => ({
          id: String(db.id),
          name: `database-${db.id}`, // API không trả về name, tạo tên từ id
          status: db.status.toLowerCase() as "running" | "stopped" | "error",
          cpu: `${db.cpuCores} cores`,
          memory: `${db.memoryGb} GB`,
          cpuUsed: `${db.cpuCores} cores`,
          memoryUsed: `${db.memoryGb} GB`,
          projectName: db.projectName,
        })),
        backends: resourceDetail.backends.map((be) => ({
          id: String(be.id),
          name: `backend-${be.id}`, // API không trả về name, tạo tên từ id
          status: be.status.toLowerCase() as "running" | "stopped" | "error",
          cpu: `${be.cpuCores} cores`,
          memory: `${be.memoryGb} GB`,
          cpuUsed: `${be.cpuCores} cores`,
          memoryUsed: `${be.memoryGb} GB`,
          projectName: be.projectName,
        })),
        frontends: resourceDetail.frontends.map((fe) => ({
          id: String(fe.id),
          name: `frontend-${fe.id}`, // API không trả về name, tạo tên từ id
          status: fe.status.toLowerCase() as "running" | "stopped" | "error",
          cpu: `${fe.cpuCores} cores`,
          memory: `${fe.memoryGb} GB`,
          cpuUsed: `${fe.cpuCores} cores`,
          memoryUsed: `${fe.memoryGb} GB`,
          projectName: fe.projectName,
        })),
      };
      
      setProjectDetail(mappedDetail);
    } catch (error) {
      toast.error("Không thể tải chi tiết dự án");
      setProjectDetail(null);
      console.error("Error loading project resources:", error);
    } finally {
      setProjectDetailLoading(false);
    }
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setSelectedProject(null);
    setProjectDetail(null);
    setUserSummary(null);
    setUserProjectsDetail(null);
    setUserViewClusterCapacity(null);
    setView("users");
    setSearchParams({});
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setProjectDetail(null);
    setView("projects");
    if (selectedUser) {
      setSearchParams({ view: "projects", userId: selectedUser.id });
    }
  };

  const userColumns = [
    {
      key: "name",
      label: "Tên người dùng",
    },
    {
      key: "username",
      label: "Username",
    },
    {
      key: "projectCount",
      label: "Số dự án",
      align: "center" as const,
    },
    {
      key: "tier",
      label: "Cấp bậc",
      align: "center" as const,
      render: (user: AdminUser) => (
        <Badge variant={user.tier === "premium" ? "success" : "secondary"} className="uppercase">
          {user.tier}
        </Badge>
      ),
    },
    {
      key: "cpuUsage",
      label: "CPU",
      align: "center" as const,
      render: (user: AdminUser) => `${user.cpuUsage.used} cores`,
    },
    {
      key: "memoryUsage",
      label: "Memory",
      align: "center" as const,
      render: (user: AdminUser) => `${user.memoryUsage.used} GB`,
    },
  ];

  const projectColumns = [
    {
      key: "name",
      label: "Tên dự án",
    },
    {
      key: "databaseCount",
      label: "Database",
      align: "center" as const,
    },
    {
      key: "backendCount",
      label: "Backend",
      align: "center" as const,
    },
    {
      key: "frontendCount",
      label: "Frontend",
      align: "center" as const,
    },
    {
      key: "cpuUsage",
      label: "CPU",
      align: "center" as const,
      render: (project: AdminUserProject) => `${project.cpuUsage.used} cores`,
    },
    {
      key: "memoryUsage",
      label: "Memory",
      align: "center" as const,
      render: (project: AdminUserProject) => `${project.memoryUsage.used} GB`,
    },
  ];

  const handleComponentAction = async (
    component: AdminProjectComponent,
    action: "pause" | "start" | "delete" | "view",
    resourceType?: "databases" | "backends" | "frontends"
  ) => {
    if (action === "view") {
      if (resourceType) {
        setComponentDetail({ item: component, type: resourceType });
        setComponentDialogOpen(true);
        
        // Gọi API để lấy chi tiết tùy theo loại
        if (resourceType === "databases") {
          try {
            setDatabaseDetailLoading(true);
            setDatabaseDetailError(null);
            setBackendDetail(null);
            const detail = await adminAPI.getDatabaseDetail(component.id);
            setDatabaseDetail(detail);
          } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error?.message || "Không thể tải chi tiết database từ Kubernetes";
            setDatabaseDetailError(errorMessage);
            toast.error(errorMessage);
            console.error("Error loading database detail:", error);
            setDatabaseDetail(null);
          } finally {
            setDatabaseDetailLoading(false);
          }
        } else if (resourceType === "backends") {
          try {
            setBackendDetailLoading(true);
            setBackendDetailError(null);
            setDatabaseDetail(null);
            setFrontendDetail(null);
            const detail = await adminAPI.getBackendDetail(component.id);
            setBackendDetail(detail);
          } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error?.message || "Không thể tải chi tiết backend từ Kubernetes";
            setBackendDetailError(errorMessage);
            toast.error(errorMessage);
            console.error("Error loading backend detail:", error);
            setBackendDetail(null);
          } finally {
            setBackendDetailLoading(false);
          }
        } else if (resourceType === "frontends") {
          try {
            setFrontendDetailLoading(true);
            setFrontendDetailError(null);
            setDatabaseDetail(null);
            setBackendDetail(null);
            const detail = await adminAPI.getFrontendDetail(component.id);
            setFrontendDetail(detail);
          } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error?.message || "Không thể tải chi tiết frontend từ Kubernetes";
            setFrontendDetailError(errorMessage);
            toast.error(errorMessage);
            console.error("Error loading frontend detail:", error);
            setFrontendDetail(null);
          } finally {
            setFrontendDetailLoading(false);
          }
        } else {
          setDatabaseDetail(null);
          setBackendDetail(null);
          setFrontendDetail(null);
        }
      }
      return;
    }
    const actionLabel =
      action === "pause" ? "tạm dừng" : action === "start" ? "chạy" : "xóa";
    toast.success(`Đã ${actionLabel} ${component.name}`);
  };

  const renderComponents = (items: AdminProjectComponent[], type: "databases" | "backends" | "frontends") => {
    const metricLabel = (metric: "cpu" | "memory", item: AdminProjectComponent) => {
      if (type === "backends" || type === "frontends" || item.projectName) {
        return metric === "cpu" ? "CPU đang dùng" : "Memory đang dùng";
      }
      return metric === "cpu" ? "CPU" : "Memory";
    };

    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground">Chưa có thành phần nào.</p>;
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            <Card className="border hover:shadow-md transition-all duration-200 hover:border-primary/50">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold truncate">{item.name}</CardTitle>
                <Badge
                  variant={
                    item.status === "running"
                      ? "success"
                      : item.status === "error"
                        ? "destructive"
                        : "secondary"
                  }
                    className="mt-2"
                >
                  {item.status}
                </Badge>
              </div>
              <DropdownMenu
                trigger={
                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                }
                  usePortal
              >
                <DropdownMenuItem onClick={() => handleComponentAction(item, "view", type)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Xem chi tiết
                </DropdownMenuItem>
                {item.status === "running" && (
                  <DropdownMenuItem onClick={() => handleComponentAction(item, "pause", type)}>
                    <PauseCircle className="mr-2 h-4 w-4" />
                    Tạm dừng
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleComponentAction(item, "start", type)}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Chạy
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleComponentAction(item, "delete", type)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xóa
                </DropdownMenuItem>
              </DropdownMenu>
            </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <span className="text-sm text-muted-foreground">{metricLabel("cpu", item)}</span>
                  <span className="text-foreground font-semibold">{item.cpuUsed ?? item.cpu}</span>
              </div>
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <span className="text-sm text-muted-foreground">{metricLabel("memory", item)}</span>
                  <span className="text-foreground font-semibold">
                  {item.memoryUsed ?? item.memory}
                </span>
              </div>
              {item.replicas && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <span className="text-sm text-muted-foreground">Replicas</span>
                    <span className="text-foreground font-semibold">{item.replicas}</span>
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        ))}
      </div>
    );
  };

  // Copy to clipboard utility
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const handleCopy = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      toast.success("Đã sao chép!");
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast.error("Không thể sao chép");
    }
  };

  const renderComponentDetailDialog = () => {
    const type = componentDetail?.type;
    const detail = componentDetail?.item;
    const isDatabase = type === "databases";
    const isBackend = type === "backends";
    const isFrontend = type === "frontends";
    
    // Copyable detail row với copy button
    const copyableDetailRow = (label: string, value?: string | number, fieldId?: string, copyable = false) => {
      const displayValue = value ?? "-";
      const fieldKey = fieldId || label.toLowerCase().replace(/\s+/g, "-");
      const isCopied = copiedField === fieldKey;
      
      return (
        <div className="rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50 group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {copyable && displayValue !== "-" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleCopy(String(displayValue), fieldKey)}
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground break-words font-mono">{displayValue}</p>
        </div>
      );
    };
    
    const detailRow = (label: string, value?: string | number) => (
      <div className="rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-semibold text-foreground break-words">{value ?? "-"}</p>
      </div>
    );

    // Helper function để kiểm tra Kubernetes resource có missing không
    const checkK8sResourceMissing = (resourceName: string | null | undefined, resourceType: string): boolean => {
      return !resourceName || resourceName.trim() === "" || resourceName === "-";
    };

    // Helper function để render cảnh báo khi Kubernetes resource missing
    const renderK8sWarning = (missingResources: string[]) => {
      if (missingResources.length === 0) return null;
      
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cảnh báo: Kubernetes resources không tìm thấy</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Các resource sau không tồn tại trong Kubernetes cluster:</p>
            <ul className="list-disc list-inside space-y-1">
              {missingResources.map((resource, idx) => (
                <li key={idx} className="font-mono text-sm">{resource}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              Điều này có thể do: resource chưa được tạo, đã bị xóa, hoặc có vấn đề khác.
            </p>
          </AlertDescription>
        </Alert>
    );
    };

    return (
      <Dialog
        open={isComponentDialogOpen && !!detail}
        onOpenChange={(open) => {
          setComponentDialogOpen(open);
          if (!open) {
            setComponentDetail(null);
            setDatabaseDetail(null);
            setDatabaseDetailError(null);
            setBackendDetail(null);
            setBackendDetailError(null);
            setFrontendDetail(null);
            setFrontendDetailError(null);
            setCopiedField(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] flex flex-col">
          {/* Quick Info Header */}
          <DialogHeader className="pb-4 border-b flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  {isDatabase && <Database className="h-6 w-6 text-primary" />}
                  {isBackend && <Server className="h-6 w-6 text-primary" />}
                  {isFrontend && <Network className="h-6 w-6 text-primary" />}
                  <DialogTitle className="text-2xl font-bold truncate">
                    {detail?.name || "Chi tiết Component"}
                </DialogTitle>
              {detail && (
                <Badge
                  variant={
                    detail.status === "running"
                      ? "success"
                      : detail.status === "error"
                        ? "destructive"
                        : "secondary"
                  }
                      className="text-sm px-3 py-1 shrink-0"
                >
                  {detail.status}
                </Badge>
              )}
            </div>
                <DialogDescription className="mt-1">
                  <span className="text-muted-foreground">Dự án: </span>
                  <span className="font-medium text-foreground">
                    {detail?.projectName ?? selectedProject?.name ?? "-"}
                  </span>
                </DialogDescription>
              </div>
              
              {/* Quick Actions */}
            {detail && (
                <div className="flex items-center gap-2 shrink-0">
                  {detail.status === "running" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleComponentAction(detail, "pause", type)}
                    >
                      <PauseCircle className="h-4 w-4 mr-2" />
                      Tạm dừng
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleComponentAction(detail, "start", type)}
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Chạy
                  </Button>
                </div>
              )}
            </div>
            
            {/* Quick Stats - Chỉ hiển thị Replicas nếu có */}
            {detail && detail.replicas && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Replicas</p>
                    <p className="text-sm font-semibold text-foreground">{detail.replicas}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogHeader>
          {detail && (
            <div className="flex-1 overflow-hidden flex flex-col mt-4">
              {isDatabase ? (
                databaseDetailLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm">Đang tải chi tiết database...</p>
                  </div>
                ) : databaseDetailError ? (
                  <Alert variant="destructive" className="m-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Lỗi khi tải dữ liệu từ Kubernetes</AlertTitle>
                    <AlertDescription>
                      <p className="font-semibold mb-2">{databaseDetailError}</p>
                      <p className="text-xs mt-2">
                        Vui lòng kiểm tra: resource có tồn tại trong Kubernetes cluster không, namespace có đúng không, hoặc kết nối đến cluster có vấn đề.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : databaseDetail ? (
                  <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-3 shrink-0">
                      <TabsTrigger value="overview" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Overview
                      </TabsTrigger>
                      <TabsTrigger value="configuration" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configuration
                      </TabsTrigger>
                      <TabsTrigger value="resources" className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Resources
                      </TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1 overflow-y-auto mt-4 pr-2">
                      <TabsContent value="overview" className="space-y-6 mt-0">
                        {(() => {
                          const missingK8s = [];
                          if (checkK8sResourceMissing(databaseDetail.podName, "Pod")) missingK8s.push("Pod");
                          if (checkK8sResourceMissing(databaseDetail.serviceName, "Service")) missingK8s.push("Service");
                          return missingK8s.length > 0 ? renderK8sWarning(missingK8s) : null;
                        })()}
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Thông tin Database
                          </h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {copyableDetailRow("Loại", databaseDetail.databaseType)}
                            {copyableDetailRow("IP", databaseDetail.databaseIp, "db-ip", true)}
                            {copyableDetailRow("Port", databaseDetail.databasePort?.toString(), "db-port", true)}
                            {copyableDetailRow("Database name", databaseDetail.databaseName, "db-name", true)}
                            {copyableDetailRow("Username", databaseDetail.databaseUsername, "db-username", true)}
                            {copyableDetailRow("Password", databaseDetail.databasePassword, "db-password", true)}
                      </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Server className="h-4 w-4" />
                              Thông tin Pod
                            </h3>
                            <div className="grid gap-3">
                              {copyableDetailRow("Name", databaseDetail.podName, "db-pod-name", true)}
                              {copyableDetailRow("Node", databaseDetail.podNode, "db-pod-node", true)}
                        {detailRow("Trạng thái", databaseDetail.podStatus)}
                      </div>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Network className="h-4 w-4" />
                              Thông tin Service
                            </h3>
                            <div className="grid gap-3">
                              {copyableDetailRow("Name", databaseDetail.serviceName, "db-service-name", true)}
                              {copyableDetailRow("EXTERNAL-IP", databaseDetail.serviceExternalIp ?? "-", "db-service-ip", true)}
                              {copyableDetailRow("Port", databaseDetail.servicePort?.toString(), "db-service-port", true)}
                      </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="configuration" className="space-y-6 mt-0">
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Cấu hình Database
                          </h3>
                          <div className="grid gap-3 md:grid-cols-2">
                            {copyableDetailRow("Database Type", databaseDetail.databaseType)}
                            {copyableDetailRow("Database Name", databaseDetail.databaseName, "config-db-name", true)}
                            {copyableDetailRow("Username", databaseDetail.databaseUsername, "config-db-username", true)}
                            {copyableDetailRow("Password", databaseDetail.databasePassword, "config-db-password", true)}
                      </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Network className="h-4 w-4" />
                            Kết nối Database
                          </h3>
                          <div className="grid gap-3 md:grid-cols-2">
                            {copyableDetailRow("IP Address", databaseDetail.databaseIp, "config-ip", true)}
                            {copyableDetailRow("Port", databaseDetail.databasePort?.toString(), "config-port", true)}
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="resources" className="space-y-6 mt-0">
                        {(() => {
                          const missingK8s = [];
                          if (checkK8sResourceMissing(databaseDetail.statefulSetName, "StatefulSet")) missingK8s.push("StatefulSet");
                          if (checkK8sResourceMissing(databaseDetail.pvcName, "PVC")) missingK8s.push("PVC");
                          if (checkK8sResourceMissing(databaseDetail.pvName, "PV")) missingK8s.push("PV");
                          return missingK8s.length > 0 ? renderK8sWarning(missingK8s) : null;
                        })()}
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Box className="h-4 w-4" />
                            StatefulSet
                          </h3>
                          <div className="grid gap-3">
                            {copyableDetailRow("Name", databaseDetail.statefulSetName, "statefulset-name", true)}
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <HardDrive className="h-4 w-4" />
                            Persistent Volume Claim (PVC)
                          </h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            {copyableDetailRow("Name", databaseDetail.pvcName, "pvc-name", true)}
                        {detailRow("STATUS", databaseDetail.pvcStatus)}
                            {copyableDetailRow("VOLUME", databaseDetail.pvcVolume, "pvc-volume", true)}
                        {detailRow("CAPACITY", databaseDetail.pvcCapacity)}
                      </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <HardDriveIcon className="h-4 w-4" />
                            Persistent Volume (PV)
                          </h3>
                      <div className="grid gap-3 md:grid-cols-3">
                            {copyableDetailRow("Name", databaseDetail.pvName, "pv-name", true)}
                        {detailRow("CAPACITY", databaseDetail.pvCapacity)}
                            {copyableDetailRow("Node", databaseDetail.pvNode, "pv-node", true)}
                      </div>
                  </div>
                      </TabsContent>
                  </div>
                  </Tabs>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {detailRow("Project", detail.projectName ?? selectedProject?.name ?? "-")}
                    {copyableDetailRow("IP", detail.ip, "fallback-ip", true)}
                    {copyableDetailRow("Port", detail.port?.toString(), "fallback-port", true)}
                    {copyableDetailRow("Database name", detail.databaseName, "fallback-db-name", true)}
                    {copyableDetailRow("Username", detail.dbUsername, "fallback-username", true)}
                    {copyableDetailRow("Password", detail.dbPassword, "fallback-password", true)}
                    {detailRow("CPU đang dùng", detail.cpuUsed ?? detail.cpu)}
                    {detailRow("Memory đang dùng", detail.memoryUsed ?? detail.memory)}
                    {copyableDetailRow("Pod đang chạy trên node", detail.node, "fallback-node", true)}
                    {copyableDetailRow("PVC", detail.pvc, "fallback-pvc", true)}
                    {copyableDetailRow("PV", detail.pv, "fallback-pv", true)}
                  </div>
                )
              ) : isBackend ? (
                backendDetailLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm">Đang tải chi tiết backend...</p>
                  </div>
                ) : backendDetailError ? (
                  <Alert variant="destructive" className="m-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Lỗi khi tải dữ liệu từ Kubernetes</AlertTitle>
                    <AlertDescription>
                      <p className="font-semibold mb-2">{backendDetailError}</p>
                      <p className="text-xs mt-2">
                        Vui lòng kiểm tra: resource có tồn tại trong Kubernetes cluster không, namespace có đúng không, hoặc kết nối đến cluster có vấn đề.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : backendDetail ? (
                  <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-3 shrink-0">
                      <TabsTrigger value="overview" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Overview
                      </TabsTrigger>
                      <TabsTrigger value="configuration" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configuration
                      </TabsTrigger>
                      <TabsTrigger value="resources" className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Resources
                      </TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1 overflow-y-auto mt-4 pr-2">
                      <TabsContent value="overview" className="space-y-6 mt-0">
                        {(() => {
                          const missingK8s = [];
                          if (checkK8sResourceMissing(backendDetail.deploymentName, "Deployment")) missingK8s.push("Deployment");
                          if (checkK8sResourceMissing(backendDetail.podName, "Pod")) missingK8s.push("Pod");
                          return missingK8s.length > 0 ? renderK8sWarning(missingK8s) : null;
                        })()}
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            Thông tin Backend
                          </h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {detailRow("Tên", backendDetail.projectName)}
                        {detailRow("Deployment Type", backendDetail.deploymentType)}
                        {detailRow("Framework Type", backendDetail.frameworkType)}
                            {copyableDetailRow("Domain Name", backendDetail.domainNameSystem ?? "-", "be-domain", true)}
                            {copyableDetailRow("Docker Image", backendDetail.dockerImage ?? "-", "be-image", true)}
                      </div>
                      </div>

                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Box className="h-4 w-4" />
                              Thông tin Deployment
                            </h3>
                            <div className="grid gap-3">
                              {copyableDetailRow("Name", backendDetail.deploymentName ?? "-", "be-deployment-name", true)}
                        {detailRow("Replica", backendDetail.replicas?.toString() ?? "-")}
                      </div>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Server className="h-4 w-4" />
                              Thông tin Pod
                            </h3>
                            <div className="grid gap-3">
                              {copyableDetailRow("Name", backendDetail.podName ?? "-", "be-pod-name", true)}
                              {copyableDetailRow("Node", backendDetail.podNode ?? "-", "be-pod-node", true)}
                        {detailRow("Trạng thái", backendDetail.podStatus ?? "-")}
                      </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="configuration" className="space-y-6 mt-0">
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Kết nối Database
                          </h3>
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {copyableDetailRow("IP", backendDetail.databaseIp ?? "-", "config-be-db-ip", true)}
                            {copyableDetailRow("Port", backendDetail.databasePort?.toString() ?? "-", "config-be-db-port", true)}
                            {copyableDetailRow("Database name", backendDetail.databaseName ?? "-", "config-be-db-name", true)}
                            {copyableDetailRow("Username", backendDetail.databaseUsername ?? "-", "config-be-db-username", true)}
                            {copyableDetailRow("Password", backendDetail.databasePassword ?? "-", "config-be-db-password", true)}
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="resources" className="space-y-6 mt-0">
                        {(() => {
                          const missingK8s = [];
                          if (checkK8sResourceMissing(backendDetail.serviceName, "Service")) missingK8s.push("Service");
                          if (checkK8sResourceMissing(backendDetail.ingressName, "Ingress")) missingK8s.push("Ingress");
                          return missingK8s.length > 0 ? renderK8sWarning(missingK8s) : null;
                        })()}
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Network className="h-4 w-4" />
                            Service
                          </h3>
                      <div className="grid gap-3 md:grid-cols-3">
                            {copyableDetailRow("Name", backendDetail.serviceName ?? "-", "be-service-name", true)}
                        {detailRow("Type", backendDetail.serviceType ?? "-")}
                            {copyableDetailRow("Port", backendDetail.servicePort ?? "-", "be-service-port", true)}
                      </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Network className="h-4 w-4" />
                            Ingress
                          </h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {copyableDetailRow("Name", backendDetail.ingressName ?? "-", "be-ingress-name", true)}
                            {copyableDetailRow("Hosts", backendDetail.ingressHosts ?? "-", "be-ingress-hosts", true)}
                            {copyableDetailRow("Address", backendDetail.ingressAddress ?? "-", "be-ingress-address", true)}
                            {copyableDetailRow("Port", backendDetail.ingressPort ?? "-", "be-ingress-port", true)}
                        {detailRow("Class", backendDetail.ingressClass ?? "-")}
                      </div>
                  </div>
                      </TabsContent>
                  </div>
                  </Tabs>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {detailRow("Project", detail.projectName ?? selectedProject?.name ?? "-")}
                    {detailRow("CPU đang dùng", detail.cpuUsed ?? detail.cpu)}
                    {detailRow("Memory đang dùng", detail.memoryUsed ?? detail.memory)}
                    {detailRow("Replicas", detail.replicas)}
                    {detailRow("Trạng thái", detail.status)}
                  </div>
                )
              ) : isFrontend ? (
                frontendDetailLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm">Đang tải chi tiết frontend...</p>
                  </div>
                ) : frontendDetailError ? (
                  <Alert variant="destructive" className="m-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Lỗi khi tải dữ liệu từ Kubernetes</AlertTitle>
                    <AlertDescription>
                      <p className="font-semibold mb-2">{frontendDetailError}</p>
                      <p className="text-xs mt-2">
                        Vui lòng kiểm tra: resource có tồn tại trong Kubernetes cluster không, namespace có đúng không, hoặc kết nối đến cluster có vấn đề.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : frontendDetail ? (
                  <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-3 shrink-0">
                      <TabsTrigger value="overview" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Overview
                      </TabsTrigger>
                      <TabsTrigger value="configuration" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configuration
                      </TabsTrigger>
                      <TabsTrigger value="resources" className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Resources
                      </TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1 overflow-y-auto mt-4 pr-2">
                      <TabsContent value="overview" className="space-y-6 mt-0">
                        {(() => {
                          const missingK8s = [];
                          if (checkK8sResourceMissing(frontendDetail.deploymentName, "Deployment")) missingK8s.push("Deployment");
                          if (checkK8sResourceMissing(frontendDetail.podName, "Pod")) missingK8s.push("Pod");
                          return missingK8s.length > 0 ? renderK8sWarning(missingK8s) : null;
                        })()}
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            Thông tin Frontend
                          </h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {detailRow("Tên", frontendDetail.projectName)}
                        {detailRow("Deployment Type", frontendDetail.deploymentType)}
                        {detailRow("Framework Type", frontendDetail.frameworkType)}
                            {copyableDetailRow("Domain Name", frontendDetail.domainNameSystem ?? "-", "fe-domain", true)}
                            {copyableDetailRow("Docker Image", frontendDetail.dockerImage ?? "-", "fe-image", true)}
                      </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Box className="h-4 w-4" />
                              Thông tin Deployment
                            </h3>
                            <div className="grid gap-3">
                              {copyableDetailRow("Name", frontendDetail.deploymentName ?? "-", "fe-deployment-name", true)}
                        {detailRow("Replica", frontendDetail.replicas?.toString() ?? "-")}
                      </div>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Server className="h-4 w-4" />
                              Thông tin Pod
                            </h3>
                            <div className="grid gap-3">
                              {copyableDetailRow("Name", frontendDetail.podName ?? "-", "fe-pod-name", true)}
                              {copyableDetailRow("Node", frontendDetail.podNode ?? "-", "fe-pod-node", true)}
                        {detailRow("Trạng thái", frontendDetail.podStatus ?? "-")}
                      </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="configuration" className="space-y-6 mt-0">
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            Cấu hình Frontend
                          </h3>
                          <div className="text-sm text-muted-foreground">
                            Thông tin cấu hình đã được hiển thị trong tab Overview.
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="resources" className="space-y-6 mt-0">
                        {(() => {
                          const missingK8s = [];
                          if (checkK8sResourceMissing(frontendDetail.serviceName, "Service")) missingK8s.push("Service");
                          if (checkK8sResourceMissing(frontendDetail.ingressName, "Ingress")) missingK8s.push("Ingress");
                          return missingK8s.length > 0 ? renderK8sWarning(missingK8s) : null;
                        })()}
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Network className="h-4 w-4" />
                            Service
                          </h3>
                      <div className="grid gap-3 md:grid-cols-3">
                            {copyableDetailRow("Name", frontendDetail.serviceName ?? "-", "fe-service-name", true)}
                        {detailRow("Type", frontendDetail.serviceType ?? "-")}
                            {copyableDetailRow("Port", frontendDetail.servicePort ?? "-", "fe-service-port", true)}
                      </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Network className="h-4 w-4" />
                            Ingress
                          </h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {copyableDetailRow("Name", frontendDetail.ingressName ?? "-", "fe-ingress-name", true)}
                            {copyableDetailRow("Hosts", frontendDetail.ingressHosts ?? "-", "fe-ingress-hosts", true)}
                            {copyableDetailRow("Address", frontendDetail.ingressAddress ?? "-", "fe-ingress-address", true)}
                            {copyableDetailRow("Port", frontendDetail.ingressPort ?? "-", "fe-ingress-port", true)}
                        {detailRow("Class", frontendDetail.ingressClass ?? "-")}
                      </div>
                  </div>
                      </TabsContent>
                  </div>
                  </Tabs>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {detailRow("Project", detail.projectName ?? selectedProject?.name ?? "-")}
                    {detailRow("CPU đang dùng", detail.cpuUsed ?? detail.cpu)}
                    {detailRow("Memory đang dùng", detail.memoryUsed ?? detail.memory)}
                    {detailRow("Replicas", detail.replicas)}
                    {detailRow("Trạng thái", detail.status)}
                  </div>
                )
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {detailRow("Project", detail.projectName ?? selectedProject?.name ?? "-")}
                  {detailRow("CPU đang dùng", detail.cpuUsed ?? detail.cpu)}
                  {detailRow("Memory đang dùng", detail.memoryUsed ?? detail.memory)}
                  {detailRow("Replicas", detail.replicas)}
                  {detailRow("Trạng thái", detail.status)}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  const StatCard = ({
    icon: Icon,
    label,
    value,
    subtext,
  }: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
    subtext?: string;
  }) => (
    <Card className="border shadow-sm group hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setUsersLoading(true);
      setOverviewLoading(true);
      setClusterCapacityLoading(true);
      
      // Gọi 3 API song song
      const [usersData, overviewData, capacityData] = await Promise.all([
        adminAPI.getAdminUsers(),
        adminAPI.getOverview(),
        adminAPI.getClusterCapacity(),
      ]);
      
      setUsers(usersData);
      setOverview(overviewData);
      setClusterCapacity(capacityData);
      toast.success("Đã làm mới dữ liệu");
    } catch (error) {
      toast.error("Không thể làm mới dữ liệu");
      console.error("Error refreshing data:", error);
    } finally {
      setIsRefreshing(false);
      setUsersLoading(false);
      setOverviewLoading(false);
      setClusterCapacityLoading(false);
    }
  };

  // Helper function for tier filter label
  const getTierLabel = (value: string) => {
    switch (value) {
      case "all":
        return "Tất cả cấp bậc";
      case "standard":
        return "Standard";
      case "premium":
        return "Premium";
      default:
        return value;
    }
  };

  // Get unique tiers from users
  const tierOptions = Array.from(new Set(users.map((user) => user.tier).filter(Boolean))).sort();

  // Filter logic
  const filteredUsers = users.filter((user) => {
    // Search filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const nameMatch = user.name.toLowerCase().includes(query);
      const usernameMatch = user.username.toLowerCase().includes(query);
      if (!nameMatch && !usernameMatch) return false;
    }

    // Tier filter
    if (tierFilter !== "all") {
      if (user.tier !== tierFilter) return false;
    }

    return true;
  });

  const totalCount = users.length;
  const filteredCount = filteredUsers.length;
  const tableTitle =
    filteredCount === totalCount
      ? `Danh sách người dùng (${totalCount})`
      : `Danh sách người dùng (${filteredCount}/${totalCount})`;

  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm người dùng..."
          className="pl-9"
        />
      </div>
      <div className="w-full sm:w-48">
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger>
            <SelectValue>{getTierLabel(tierFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả cấp bậc</SelectItem>
            {tierOptions.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {tier === "premium" ? "Premium" : "Standard"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={handleRefresh}
        disabled={isRefreshing || usersLoading || overviewLoading || clusterCapacityLoading}
      >
        {(isRefreshing || usersLoading || overviewLoading || clusterCapacityLoading) ? (
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
      {view === "users" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dịch vụ người dùng</h1>
              <p className="text-muted-foreground mt-1">
                Giám sát tài nguyên và các dịch vụ đang chạy của từng người dùng trong hệ thống.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={usersLoading || overviewLoading || clusterCapacityLoading}
              className="w-full md:w-auto"
            >
              {(usersLoading || overviewLoading || clusterCapacityLoading) ? (
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label="Tổng người dùng"
              value={totalUsers.toString()}
              subtext="Tổng tài khoản"
            />
            <StatCard
              icon={FolderTree}
              label="Tổng dự án"
              value={totalProjects.toString()}
              subtext="Bao gồm tất cả người dùng"
            />
            <StatCard
              icon={Cpu}
              label="CPU đang dùng"
              value={`${totalCpuUsed.toFixed(2)} cores`}
              subtext="Tổng CPU đang sử dụng của tất cả người dùng"
            />
            <StatCard
              icon={MemoryStick}
              label="Memory đang dùng"
              value={`${totalMemUsed.toFixed(2)} GB`}
              subtext="Tổng Memory đang sử dụng của tất cả người dùng"
            />
          </div>

          {(usersLoading || overviewLoading || clusterCapacityLoading) ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Đang tải danh sách...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-bold">{tableTitle}</h2>
              </div>
              {filterToolbar}
              
              {/* Custom Expandable Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-foreground w-12"></th>
                        {userColumns.map((col) => (
                          <th
                            key={String(col.key)}
                            className={`px-4 py-3 text-sm font-medium text-foreground ${
                              col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                            }`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={userColumns.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                            Không tìm thấy người dùng phù hợp
                          </td>
                        </tr>
                      ) : (
                        filteredUsers
                          .slice((currentPage - 1) * 5, currentPage * 5)
                          .map((user) => {
                          const isUserExpanded = expandedUsers.has(user.id);
                          const userProjects = userProjectsMap[user.id];
                          
                          return (
                            <React.Fragment key={user.id}>
                              {/* User Row */}
                              <tr
                                className={`border-t transition-all duration-200 cursor-pointer ${
                                  isUserExpanded 
                                    ? "bg-primary/5 hover:bg-primary/10" 
                                    : "hover:bg-muted/50"
                                }`}
                                onClick={() => toggleUserExpand(user)}
                              >
                                <td className="px-4 py-4">
                                  <motion.div
                                    animate={{ rotate: isUserExpanded ? 90 : 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="inline-block"
                                  >
                                    <ChevronRight className="h-4 w-4 text-primary" />
                                  </motion.div>
                                </td>
                                {userColumns.map((col) => (
                                  <td
                                    key={String(col.key)}
                                    className={`px-4 py-4 text-sm ${
                                      col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                                    }`}
                                  >
                                    {col.render ? col.render(user) : String(user[col.key as keyof AdminUser] ?? "")}
                                  </td>
                                ))}
                              </tr>
                              
                              {/* Expanded Projects Row */}
                              <AnimatePresence>
                                {isUserExpanded && (
                                  <tr>
                                    <td colSpan={userColumns.length + 1} className="px-0 py-0">
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="overflow-hidden bg-gradient-to-b from-primary/5 to-muted/20"
                                      >
                                        <div className="p-6 border-t-2 border-primary/20">
                                      {userProjects?.loading ? (
                                        <div className="flex items-center justify-center py-8">
                                          <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
                                          <span className="text-sm text-muted-foreground">Đang tải dự án...</span>
                                        </div>
                                      ) : userProjects?.projects && userProjects.projects.length > 0 ? (
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-primary/20">
                                            <FolderTree className="h-5 w-5 text-primary" />
                                            <h4 className="text-base font-semibold text-foreground">
                                              Dự án ({userProjects.projects.length})
                                            </h4>
                                          </div>
                                          <div className="space-y-2">
                                            {userProjects.projects.map((project) => {
                                              const projectKey = `${user.id}-${project.id}`;
                                              const isProjectExpanded = expandedProjects.has(projectKey);
                                              const projectDetail = projectDetailsMap[project.id];
                                              
                                              return (
                                                <motion.div
                                                  key={project.id}
                                                  initial={{ opacity: 0, y: -10 }}
                                                  animate={{ opacity: 1, y: 0 }}
                                                  transition={{ duration: 0.2 }}
                                                  className="border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow"
                                                >
                                                  {/* Project Row */}
                                                  <div
                                                    className={`flex items-center gap-3 p-4 cursor-pointer transition-all duration-200 ${
                                                      isProjectExpanded
                                                        ? "bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary"
                                                        : "hover:bg-muted/50"
                                                    }`}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleProjectExpand(project, user.id);
                                                    }}
                                                  >
                                                    <motion.div
                                                      animate={{ rotate: isProjectExpanded ? 90 : 0 }}
                                                      transition={{ duration: 0.2, ease: "easeInOut" }}
                                                      className="flex-shrink-0"
                                                    >
                                                      <ChevronRight className="h-4 w-4 text-primary" />
                                                    </motion.div>
                                                    <div className="flex-1 grid grid-cols-5 gap-4 text-sm">
                                                      <div className="font-semibold text-foreground">{project.name}</div>
                                                      <div className="text-center">
                                                        <span className="text-xs text-muted-foreground">DB:</span>{" "}
                                                        <span className="font-medium">{project.databaseCount}</span>{" "}
                                                        <span className="text-xs text-muted-foreground">| BE:</span>{" "}
                                                        <span className="font-medium">{project.backendCount}</span>{" "}
                                                        <span className="text-xs text-muted-foreground">| FE:</span>{" "}
                                                        <span className="font-medium">{project.frontendCount}</span>
                                                      </div>
                                                      <div className="text-center">
                                                        <span className="text-xs text-muted-foreground">CPU:</span>{" "}
                                                        <span className="font-medium text-foreground">{project.cpuUsage.used} cores</span>
                                                      </div>
                                                      <div className="text-center">
                                                        <span className="text-xs text-muted-foreground">RAM:</span>{" "}
                                                        <span className="font-medium text-foreground">{project.memoryUsage.used} GB</span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Expanded Components */}
                                                  <AnimatePresence>
                                                    {isProjectExpanded && (
                                                      <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                                        className="overflow-hidden"
                                                      >
                                                        <div className="p-4 border-t bg-gradient-to-b from-muted/30 to-muted/10">
                                                          {projectDetail?.loading ? (
                                                            <div className="flex items-center justify-center py-6">
                                                              <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary" />
                                                              <span className="text-xs text-muted-foreground">Đang tải components...</span>
                                                            </div>
                                                          ) : projectDetail?.detail ? (
                                                            <Tabs defaultValue="databases" className="w-full">
                                                              <TabsList className="grid w-full grid-cols-3 mb-4 bg-muted/50">
                                                                <TabsTrigger value="databases" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                                                  Database ({projectDetail.detail.databases.length})
                                                                </TabsTrigger>
                                                                <TabsTrigger value="backends" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                                                  Backend ({projectDetail.detail.backends.length})
                                                                </TabsTrigger>
                                                                <TabsTrigger value="frontends" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                                                  Frontend ({projectDetail.detail.frontends.length})
                                                                </TabsTrigger>
                                                              </TabsList>
                                                              <TabsContent value="databases" className="mt-0">
                                                                {renderComponents(projectDetail.detail.databases, "databases")}
                                                              </TabsContent>
                                                              <TabsContent value="backends" className="mt-0">
                                                                {renderComponents(projectDetail.detail.backends, "backends")}
                                                              </TabsContent>
                                                              <TabsContent value="frontends" className="mt-0">
                                                                {renderComponents(projectDetail.detail.frontends, "frontends")}
                                                              </TabsContent>
                                                            </Tabs>
                                                          ) : (
                                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                              Không có components
                                                            </p>
          )}
        </div>
                                                      </motion.div>
                                                    )}
                                                  </AnimatePresence>
                                                </motion.div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-8">
                                          <FolderTree className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                          <p className="text-sm text-muted-foreground">
                                            Người dùng này chưa có dự án nào
                                          </p>
                                        </div>
                                      )}
                                        </div>
                                      </motion.div>
                                    </td>
                                  </tr>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Pagination */}
              {filteredUsers.length > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div>
                    Hiển thị {Math.min((currentPage - 1) * 5 + 1, filteredUsers.length)}-
                    {Math.min(currentPage * 5, filteredUsers.length)} trong {filteredUsers.length} mục
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                    >
                      Trước
                    </Button>
                    <span>
                      Trang {currentPage} / {Math.max(1, Math.ceil(filteredUsers.length / 5))}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(Math.ceil(filteredUsers.length / 5), currentPage + 1))}
                      disabled={currentPage >= Math.ceil(filteredUsers.length / 5)}
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === "projects" && selectedUser && (
        <div className="space-y-6">
          {/* Header with Back Button */}
          <Button
            variant="ghost"
            size="sm"
            className="px-0 text-muted-foreground hover:text-foreground"
            onClick={handleBackToUsers}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại danh sách người dùng
          </Button>

          {/* User Info and Resources Card */}
          <Card className="border shadow-sm">
            <CardContent className="pt-6">
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                {/* Column 1: User Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-foreground truncate">
                        {userSummary?.fullname ?? userProjectsDetail?.fullname ?? selectedUser.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Username:</span>{" "}
                        <span className="font-mono text-foreground">
                          {userSummary?.username ?? userProjectsDetail?.username ?? selectedUser.username}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Column 2: CPU, Memory, Project Count */}
                <div className="space-y-3">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* CPU Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground">CPU đang sử dụng</p>
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {(
                          userSummary?.cpuCores ?? 
                          selectedUser.cpuUsage.used ?? 
                          0
                        ).toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground"> cores</span>
                      </div>
                    </div>

                    {/* Memory Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MemoryStick className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground">Memory đang sử dụng</p>
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {(
                          userSummary?.memoryGb ?? 
                          selectedUser.memoryUsage.used ?? 
                          0
                        ).toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground"> GB</span>
                      </div>
                    </div>

                    {/* Project Count */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground">Số dự án</p>
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {userSummary?.projectCount ?? selectedUser.projectCount}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {projectsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Đang tải dự án...
            </div>
          ) : (
            <ResourceTable
              title="Danh sách dự án"
              columns={projectColumns}
              data={projects}
              loading={false}
              onView={handleViewProject}
              emptyMessage="Người dùng này chưa có dự án nào."
              searchPlaceholder="Tìm kiếm dự án..."
              pagination={{
                page: currentProjectPage,
                pageSize: 5,
                onPageChange: (page) => setCurrentProjectPage(page),
              }}
            />
          )}
        </div>
      )}

      {view === "projectDetail" && selectedProject && selectedUser && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="px-0 text-muted-foreground hover:text-foreground"
                onClick={handleBackToProjects}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại danh sách dự án
              </Button>
              <div>
                <h2 className="text-3xl font-semibold text-foreground">{selectedProject.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Người dùng: <span className="text-foreground font-medium">{selectedUser.name}</span>
                </p>
              </div>
            </div>
            <Card>
              <CardContent className="flex gap-6 py-4 px-6 text-sm">
                <div>
                  <p className="text-muted-foreground">CPU đang dùng</p>
                  <p className="text-xl font-semibold text-foreground">
                    {selectedProject.cpuUsage.used}/{selectedProject.cpuUsage.total} cores
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Memory đang dùng</p>
                  <p className="text-xl font-semibold text-foreground">
                    {selectedProject.memoryUsage.used}/{selectedProject.memoryUsage.total} GB
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {projectDetailLoading || !projectDetail ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Đang tải chi tiết dự án...
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Chi tiết dự án</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="databases">
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="databases">
                      Database ({projectDetail.databases.length})
                    </TabsTrigger>
                    <TabsTrigger value="backends">
                      Backend ({projectDetail.backends.length})
                    </TabsTrigger>
                    <TabsTrigger value="frontends">
                      Frontend ({projectDetail.frontends.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="databases" className="pt-4">
                    {renderComponents(projectDetail.databases, "databases")}
                  </TabsContent>
                  <TabsContent value="backends" className="pt-4">
                    {renderComponents(projectDetail.backends, "backends")}
                  </TabsContent>
                  <TabsContent value="frontends" className="pt-4">
                    {renderComponents(projectDetail.frontends, "frontends")}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {renderComponentDetailDialog()}
    </div>
  );
}

