import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminAPI } from "@/lib/admin-api";
import type { 
  DashboardMetrics, 
  ClusterCapacityResponse, 
  ClusterAllocatableResponse,
  AdminOverviewResponse 
} from "@/types/admin";
import { Server, Container, Layers, Cpu, HardDrive, Activity, Info, RefreshCw, ArrowRight } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "react-router-dom";

/**
 * Trang Cluster Overview - Hiển thị tổng quan về cluster resources và statistics
 */
export function ClusterOverview() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [capacity, setCapacity] = useState<ClusterCapacityResponse | null>(null);
  const [allocatable, setAllocatable] = useState<ClusterAllocatableResponse | null>(null);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadMetrics(true);
  }, []);

  const loadMetrics = async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      // Load tất cả dữ liệu song song
      const [metricsData, capacityData, allocatableData, overviewData] = await Promise.all([
        adminAPI.getDashboardMetrics(),
        adminAPI.getClusterCapacity(),
        adminAPI.getClusterAllocatable(),
        adminAPI.getOverview(),
      ]);
      
      setMetrics(metricsData);
      setCapacity(capacityData);
      setAllocatable(allocatableData);
      setOverview(overviewData);
    } catch (error) {
      console.error("Failed to load metrics:", error);
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
        toast.success("Đã làm mới tổng quan cluster");
      }
    }
  };

  // Tính toán tỷ lệ sử dụng - dùng từ metrics (đã tính từ tất cả pods trong cluster)
  const cpuUsed = metrics?.cpuUsage?.used || 0;
  const memoryUsed = metrics?.memoryUsage?.used || 0;
  
  // Capacity: Tổng tài nguyên vật lý của cluster (100% hardware)
  const cpuCapacity = capacity?.totalCpuCores || 0;
  const memoryCapacity = capacity?.totalMemoryGb || 0;
  
  // Allocatable: Tài nguyên có thể phân bổ cho pods (Capacity - system reserved)
  // Dùng từ allocatable API hoặc từ metrics (metrics đã lấy từ allocatable)
  const cpuAllocatable = allocatable?.totalCpuCores || metrics?.cpuUsage?.total || 0;
  const memoryAllocatable = allocatable?.totalMemoryGb || metrics?.memoryUsage?.total || 0;

  // Tính phần trăm sử dụng (so với allocatable)
  const cpuUsagePercent = cpuAllocatable > 0 ? (cpuUsed / cpuAllocatable) * 100 : 0;
  const memoryUsagePercent = memoryAllocatable > 0 ? (memoryUsed / memoryAllocatable) * 100 : 0;

  // Màu sắc dựa trên mức sử dụng
  const getUsageColor = (percent: number) => {
    if (percent >= 90) return "bg-red-500";
    if (percent >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Đang tải dữ liệu cluster...</div>
      </div>
    );
  }

  if (!metrics || !capacity || !allocatable) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Không thể tải dữ liệu cluster</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cluster Overview</h1>
          <p className="text-muted-foreground mt-1">
            Tổng quan về tài nguyên và trạng thái cluster
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadMetrics(false)}
          disabled={isRefreshing}
          className="w-full md:w-auto"
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

      {/* Resource Usage Cards - CPU & Memory */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* CPU Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Resources</CardTitle>
            <Cpu className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Đang sử dụng</span>
                <span className="text-lg font-semibold">
                  {cpuUsed.toFixed(2)} / {cpuAllocatable.toFixed(2)} cores
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all ${getUsageColor(cpuUsagePercent)}`}
                  style={{ width: `${Math.min(cpuUsagePercent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{cpuUsagePercent.toFixed(1)}% sử dụng</span>
                <span>Capacity: {cpuCapacity.toFixed(2)} cores</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  Capacity
                  <Tooltip content="Tổng tài nguyên vật lý của cluster (100% hardware)">
                    <Info className="h-3 w-3 cursor-help" />
                  </Tooltip>
                </div>
                <div className="text-sm font-semibold">{cpuCapacity.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  Allocatable
                  <Tooltip content="Tài nguyên có thể phân bổ cho pods (Capacity - system reserved)">
                    <Info className="h-3 w-3 cursor-help" />
                  </Tooltip>
                </div>
                <div className="text-sm font-semibold">{cpuAllocatable.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Used</div>
                <div className="text-sm font-semibold text-primary">{cpuUsed.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Resources</CardTitle>
            <HardDrive className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Đang sử dụng</span>
                <span className="text-lg font-semibold">
                  {memoryUsed.toFixed(2)} / {memoryAllocatable.toFixed(2)} GB
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all ${getUsageColor(memoryUsagePercent)}`}
                  style={{ width: `${Math.min(memoryUsagePercent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{memoryUsagePercent.toFixed(1)}% sử dụng</span>
                <span>Capacity: {memoryCapacity.toFixed(2)} GB</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  Capacity
                  <Tooltip content="Tổng tài nguyên vật lý của cluster (100% hardware)">
                    <Info className="h-3 w-3 cursor-help" />
                  </Tooltip>
                </div>
                <div className="text-sm font-semibold">{memoryCapacity.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  Allocatable
                  <Tooltip content="Tài nguyên có thể phân bổ cho pods (Capacity - system reserved)">
                    <Info className="h-3 w-3 cursor-help" />
                  </Tooltip>
                </div>
                <div className="text-sm font-semibold">{memoryAllocatable.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Used</div>
                <div className="text-sm font-semibold text-primary">{memoryUsed.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cluster Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Cluster Statistics</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="group hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nodes</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.nodes.total}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">{metrics.nodes.healthy} healthy</span>
                  {metrics.nodes.unhealthy > 0 && (
                    <span className="text-red-600 ml-2">{metrics.nodes.unhealthy} unhealthy</span>
                  )}
                </p>
                <Link to="/admin/cluster/nodes">
                  <Button variant="ghost" size="sm" className="h-7 px-2 group-hover:text-primary">
                    <span className="text-xs">Xem chi tiết</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pods</CardTitle>
              <Container className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.pods.total}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">{metrics.pods.running} running</span>
                  {metrics.pods.pending > 0 && (
                    <span className="text-yellow-600 ml-2">{metrics.pods.pending} pending</span>
                  )}
                  {metrics.pods.failed > 0 && (
                    <span className="text-red-600 ml-2">{metrics.pods.failed} failed</span>
                  )}
                </p>
                <Link to="/admin/workloads/pods">
                  <Button variant="ghost" size="sm" className="h-7 px-2 group-hover:text-primary">
                    <span className="text-xs">Xem chi tiết</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deployments</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.deployments.total}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">{metrics.deployments.active} active</span>
                  {metrics.deployments.error > 0 && (
                    <span className="text-red-600 ml-2">{metrics.deployments.error} error</span>
                  )}
                </p>
                <Link to="/admin/workloads/deployments">
                  <Button variant="ghost" size="sm" className="h-7 px-2 group-hover:text-primary">
                    <span className="text-xs">Xem chi tiết</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* User & Project Overview */}
      <div>
        <h2 className="text-xl font-semibold mb-4">User & Project Overview</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="group hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.totalUsers ?? 0}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  Người dùng đang hoạt động
                </p>
                <Link to="/admin/accounts">
                  <Button variant="ghost" size="sm" className="h-7 px-2 group-hover:text-primary">
                    <span className="text-xs">Xem chi tiết</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.totalProjects ?? 0}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  Dự án đang triển khai
                </p>
                <Link to="/admin/users">
                  <Button variant="ghost" size="sm" className="h-7 px-2 group-hover:text-primary">
                    <span className="text-xs">Xem chi tiết</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

