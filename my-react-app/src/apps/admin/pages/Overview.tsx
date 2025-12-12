import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Server,
  Network,
  Users,
  Database,
  Container,
  Layers,
  Globe,
  HardDrive,
  Shield,
  Settings,
  BarChart3,
} from "lucide-react";

/**
 * Trang Overview/Introduction cho Admin
 * Giới thiệu về hệ thống quản lý cluster và dịch vụ
 */
export function Overview() {
  const features = [
    {
      icon: Server,
      title: "Quản lý Infrastructure",
      description: "Gán servers vào cluster, cài đặt và quản lý cluster Kubernetes cùng nodes và tài nguyên hệ thống.",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Users,
      title: "Quản lý Người dùng",
      description: "Xem và quản lý các dự án, dịch vụ của người dùng đang triển khai trên hệ thống.",
      color: "text-green-600 dark:text-green-400",
    },
    {
      icon: Container,
      title: "Quản lý Workloads",
      description: "Giám sát deployments, pods, statefulsets và các tài nguyên container đang chạy.",
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      icon: Globe,
      title: "Service Discovery",
      description: "Quản lý services, ingress và các endpoint để kết nối các dịch vụ với nhau.",
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      icon: HardDrive,
      title: "Quản lý Storage",
      description: "Theo dõi Persistent Volumes (PV) và Persistent Volume Claims (PVC) của hệ thống.",
      color: "text-red-600 dark:text-red-400",
    },
    {
      icon: Shield,
      title: "Phê duyệt Yêu cầu",
      description: "Xem xét và phê duyệt các yêu cầu điều chỉnh replicas từ người dùng.",
      color: "text-amber-600 dark:text-amber-400",
    },
  ];

  const managementModules = [
    {
      title: "Infrastructure",
      items: ["Hosts", "Cluster Assign Hosts", "Nodes", "Namespaces"],
      icon: Network,
    },
    {
      title: "Workloads",
      items: ["Deployments", "Pods", "Statefulsets"],
      icon: Layers,
    },
    {
      title: "Service Discovery",
      items: ["Services", "Ingress"],
      icon: Globe,
    },
    {
      title: "Storage",
      items: ["PVC", "PV"],
      icon: Database,
    },
    {
      title: "User Services",
      items: ["Services", "Replica Requests", "Accounts"],
      icon: Users,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Chào mừng đến với CICT-Hosting Services Admin</h1>
        <p className="text-lg text-muted-foreground">
          Hệ thống quản lý cluster Kubernetes và dịch vụ của người dùng
        </p>
      </div>

      {/* Introduction Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Giới thiệu về hệ thống
          </CardTitle>
          <CardDescription>
            CICT-Hosting Services Admin là nền tảng quản lý toàn diện cho infrastructure và dịch vụ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Hệ thống này cung cấp các công cụ mạnh mẽ để quản trị viên có thể:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Quản lý và giám sát infrastructure (servers, clusters, nodes)</li>
              <li>Theo dõi các workloads đang chạy trên Kubernetes cluster</li>
              <li>Quản lý dịch vụ của người dùng và các yêu cầu điều chỉnh tài nguyên</li>
              <li>Giám sát storage và tài nguyên hệ thống</li>
              <li>Phê duyệt các yêu cầu từ người dùng về điều chỉnh replicas</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Các chức năng chính</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${feature.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Management Modules */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Các module quản lý</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {managementModules.map((module, index) => {
            const Icon = module.icon;
            return (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {module.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {module.items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="text-sm text-muted-foreground flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Start */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Bắt đầu sử dụng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-muted-foreground">
            <p>
              Sử dụng menu điều hướng bên trái để truy cập các chức năng:
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <span className="text-primary font-semibold">•</span>
                <span>
                  <strong className="text-foreground">Infrastructure:</strong> Gán servers vào cluster để cài đặt và quản lý cluster
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-semibold">•</span>
                <span>
                  <strong className="text-foreground">Kubernetes Cluster:</strong> Xem nodes và namespaces
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-semibold">•</span>
                <span>
                  <strong className="text-foreground">Workloads:</strong> Quản lý deployments và pods
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-semibold">•</span>
                <span>
                  <strong className="text-foreground">User Services:</strong> Quản lý dự án và phê duyệt yêu cầu
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
