import { useEffect, useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { adminAPI } from "@/lib/admin-api";
import api from "@/services/api";
import { playbookTemplateCatalog, getPlaybookTemplateById } from "@/lib/playbook-templates";
import type { Server, Cluster } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Settings,
  Server as ServerIcon,
  Network,
  FileText,
  Code,
  Download,
  Package,
  ChevronRight,
  ChevronDown,
  Info,
  Search,
  Trash2,
  RotateCcw,
  Zap,
  BookOpen,
  Copy,
  ShieldCheck,
  Plus,
  Upload,
  FileCode,
  PlayCircle,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type PlaybookLogType = "info" | "success" | "error" | "step";

const formatPlaybookLogLine = (message: string, type: PlaybookLogType = "info") => {
  const timestamp = new Date().toLocaleTimeString("vi-VN");
  const prefix = type === "step" ? "📋" : type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  return `[${timestamp}] ${prefix} ${message}`;
};

// Component Stepper để hiển thị các bước nhỏ
interface StepperStep {
  id: string;
  label: string;
  description?: string;
  status: "pending" | "active" | "completed" | "error";
  icon?: any; // React icon component
  button?: any; // React button component
}

interface StepperProps {
  steps: StepperStep[];
  className?: string;
}

type UtilityActionKey = "resetCluster" | "installHelm" | "joinExistingWorkers";
type UtilityActionStatus = "idle" | "running" | "completed" | "error";

const Stepper = ({ steps, className = "" }: StepperProps) => {
  // Hàm trích xuất số bước từ label (ví dụ: "Bước 5: ..." -> 5)
  const extractStepNumber = (label: string): number | null => {
    const match = label.match(/Bước\s+(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Hàm loại bỏ "Bước X: " khỏi label khi hiển thị
  const getDisplayLabel = (label: string): string => {
    return label.replace(/^Bước\s+\d+:\s*/, "");
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCompleted = step.status === "completed";
        const isActive = step.status === "active";
        const isError = step.status === "error";
        
        // Lấy số bước từ label, nếu không có thì dùng index + 1
        const stepNumber = extractStepNumber(step.label) ?? (index + 1);
        // Loại bỏ "Bước X: " khỏi label khi hiển thị
        const displayLabel = getDisplayLabel(step.label);

        return (
          <div key={step.id} className="relative">
            {/* Connector line */}
            {!isLast && (
              <div
                className={`absolute left-5 top-10 w-0.5 h-full ${
                  isCompleted ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
            )}

            <div className="flex items-start gap-4">
              {/* Step icon/number */}
              <div
                className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  isCompleted
                    ? "bg-green-500 border-green-500 text-white"
                    : isActive
                    ? "bg-primary border-primary text-primary-foreground"
                    : isError
                    ? "bg-red-500 border-red-500 text-white"
                    : "bg-muted border-gray-300 dark:border-gray-600 text-muted-foreground"
                }`}
              >
                {step.icon ? (
                  <div className="w-5 h-5">{step.icon}</div>
                ) : isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isError ? (
                  <XCircle className="w-5 h-5" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="text-sm font-semibold">{stepNumber}</span>
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pt-1">
                <div
                  className={`font-medium ${
                    isActive
                      ? "text-primary"
                      : isCompleted
                      ? "text-green-700 dark:text-green-400"
                      : isError
                      ? "text-red-700 dark:text-red-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {displayLabel}
                </div>
                {step.description && (
                  <div className="text-sm text-muted-foreground mt-1">{step.description}</div>
                )}
              </div>

              {/* Step button */}
              {step.button && (
                <div className="pt-1">
                  {step.button}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Trang Cluster Setup - Thiết lập và cấu hình Kubernetes Cluster
 */
export function ClusterSetup() {
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInstallingAnsible, setIsInstallingAnsible] = useState(false);
  const [setupAnsibleLogs, setSetupAnsibleLogs] = useState<string[]>([]);
  const [isInstallingK8sCluster, setIsInstallingK8sCluster] = useState(false);
  const [isInstallingK8sAddons, setIsInstallingK8sAddons] = useState(false);
  const [isInstallingMetricsServer, setIsInstallingMetricsServer] = useState(false);
  const [isInstallingDocker, setIsInstallingDocker] = useState(false);
  const [k8sClusterInstallLogs, setK8sClusterInstallLogs] = useState<string[]>([]);
  const [k8sTab2ApiLogs, setK8sTab2ApiLogs] = useState<string[]>([]);
  const [isUninstallingAnsible, setIsUninstallingAnsible] = useState(false);
  const [isUninstallingK8sCluster, setIsUninstallingK8sCluster] = useState(false);
  const [isUninstallingK8sAddons, setIsUninstallingK8sAddons] = useState(false);
  const [isUninstallingMetricsServer, setIsUninstallingMetricsServer] = useState(false);
  const [isUninstallingDocker, setIsUninstallingDocker] = useState(false);
  const [isReinstallingAnsible, setIsReinstallingAnsible] = useState(false);
  const [isInstallingK8s, setIsInstallingK8s] = useState(false);
  // Mặc định thu gọn tất cả các phần (Phần 1, Phần 2, Phần 3)
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAnsibleConfig, setShowAnsibleConfig] = useState(false);
  const [isCheckingAnsibleStatus, setIsCheckingAnsibleStatus] = useState(false);
  const hasCheckedAnsibleStatusOnMount = useRef(false);

  // Completion tracking states
  const [part1Completed, setPart1Completed] = useState(false);
  const [k8sActiveTab, setK8sActiveTab] = useState<string>("tab1");

  // Step tracking states for Part 1 (Ansible) - 3 bước
  const [ansibleSteps, setAnsibleSteps] = useState<StepperStep[]>([]);

  // Step tracking states for Part 2 - Tab 1 (K8s Preparation)
  const [k8sTab1Steps, setK8sTab1Steps] = useState<StepperStep[]>([
    {
      id: "update-hosts",
      label: "Bước 1: Cập nhật hosts & hostname",
      description: "Cấu hình /etc/hosts và hostname cho các nodes",
      status: "pending",
    },
    {
      id: "kernel-sysctl",
      label: "Bước 2: Cấu hình kernel & sysctl",
      description: "Thiết lập kernel modules và sysctl parameters",
      status: "pending",
    },
    {
      id: "install-containerd",
      label: "Bước 3: Cài đặt containerd",
      description: "Cài đặt và cấu hình containerd runtime",
      status: "pending",
    },
    {
      id: "install-kubernetes",
      label: "Bước 4: Cài đặt Kubernetes tools",
      description: "Cài đặt kubeadm, kubelet và kubectl",
      status: "pending",
    },
  ]);

  // Step tracking states for Part 2 - Tab 2 (K8s Deployment)
  const [k8sTab2Steps, setK8sTab2Steps] = useState<StepperStep[]>([
    {
      id: "init-master",
      label: "Bước 5: Khởi tạo master node",
      description: "Chạy kubeadm init để tạo control plane",
      status: "pending",
    },
    {
      id: "install-cni",
      label: "Bước 6: Cài đặt CNI (Calico/Flannel)",
      description: "Cài đặt network plugin cho cluster",
      status: "pending",
    },
    {
      id: "join-workers",
      label: "Bước 7: Thêm worker nodes",
      description: "Join các worker nodes vào cluster",
      status: "pending",
    },
  ]);

  // Step tracking states for Part 2 - Tab 3 (K8s Verification & Extensions)
  const [k8sTab3Steps, setK8sTab3Steps] = useState<StepperStep[]>([
    {
      id: "verify-cluster",
      label: "Bước 8: Xác minh trạng thái cluster",
      description: "Kiểm tra nodes và pods trong cluster",
      status: "pending",
    },
    {
      id: "install-metrics",
      label: "Bước 9: Cài đặt Metrics Server",
      description: "Cài đặt metrics server để monitor cluster",
      status: "pending",
    },
    {
      id: "install-ingress",
      label: "Bước 10: Cài đặt Nginx Ingress",
      description: "Cài đặt ingress controller",
      status: "pending",
    },
    {
      id: "install-metallb",
      label: "Bước 11: Cài đặt MetalLB LoadBalancer",
      description: "Cài đặt MetalLB để cung cấp LoadBalancer service",
      status: "pending",
    },
    {
      id: "setup-storage",
      label: "Bước 12: Thiết lập Storage (local storage)",
      description: "Cài đặt local storage cho persistent storage",
      status: "pending",
    },
  ]);

  // K8s installation states for 3 tabs
  const [isInstallingK8sTab1, setIsInstallingK8sTab1] = useState(false);
  const [isInstallingK8sTab2, setIsInstallingK8sTab2] = useState(false);
  const [isInstallingK8sTab3, setIsInstallingK8sTab3] = useState(false);
  const [k8sTab1Completed, setK8sTab1Completed] = useState(false);
  const [k8sTab2Completed, setK8sTab2Completed] = useState(false);
  const [k8sTab3Completed, setK8sTab3Completed] = useState(false);

  // K8s installation logs for each tab
  const [k8sTab1Logs, setK8sTab1Logs] = useState<string[]>([]);
  const [k8sTab2Logs, setK8sTab2Logs] = useState<string[]>([]);
  const [k8sTab3Logs, setK8sTab3Logs] = useState<string[]>([]);
  const k8sTab1LogRef = useRef<HTMLDivElement>(null);
  const k8sTab2LogRef = useRef<HTMLDivElement>(null);
  const k8sTab3LogRef = useRef<HTMLDivElement>(null);
  const [utilityActionsStatus, setUtilityActionsStatus] = useState<Record<UtilityActionKey, UtilityActionStatus>>({
    resetCluster: "idle",
    installHelm: "idle",
    joinExistingWorkers: "idle",
  });
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    actionKey: UtilityActionKey;
    playbookFilename: string;
    label: string;
    description: string;
  } | null>(null);
  const stepExecutionLogRef = useRef<HTMLDivElement>(null);

  // Ansible status states
  const [ansibleStatus, setAnsibleStatus] = useState<{
    installed: boolean;
    version?: string;
    controllerHost?: string;
    controllerRole?: "ANSIBLE" | "MASTER";
    error?: string;
  } | null>(null);

  // Docker status states
  const [dockerStatus, setDockerStatus] = useState<{
    installed: boolean;
    version?: string;
    dockerHost?: string;
    dockerRole?: "DOCKER";
    error?: string;
  } | null>(null);
  const [isCheckingDockerStatus, setIsCheckingDockerStatus] = useState(false);

  // Modal states
  const [showInitModal, setShowInitModal] = useState(false);
  const [showInitQuicklyModal, setShowInitQuicklyModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsModalTab, setOptionsModalTab] = useState<string>("config");
  const [optionsConfigTab, setOptionsConfigTab] = useState<"cfg" | "inventory" | "vars">("cfg");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSudoPasswordModal, setShowSudoPasswordModal] = useState(false);
  const [showStepExecutionModal, setShowStepExecutionModal] = useState(false);
  
  // Install/Uninstall Modal state
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installModalAction, setInstallModalAction] = useState<{
    url: string;
    title: string;
    type: "install" | "uninstall";
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setLogs: React.Dispatch<React.SetStateAction<string[]>>;
  } | null>(null);
  const [installModalSteps, setInstallModalSteps] = useState<StepperStep[]>([
    { id: "confirm", label: "Xác nhận", description: "Xác nhận thực hiện thao tác", status: "pending" },
    { id: "executing", label: "Đang thực thi", description: "Đang chạy lệnh...", status: "pending" },
    { id: "completed", label: "Hoàn tất", description: "Thao tác đã hoàn thành", status: "pending" },
  ]);
  const [installModalLogs, setInstallModalLogs] = useState<string[]>([]);
  const installModalLogRef = useRef<HTMLDivElement>(null);
  const installTaskPollingRef = useRef<NodeJS.Timeout | null>(null);
  const installTaskLogLengthRef = useRef<number>(0);
  
  // Install modal auth status (for Ansible installation)
  const [installModalAuthStatus, setInstallModalAuthStatus] = useState<{
    hasSshKey: boolean;
    hasSudoNopasswd: boolean | null;
    needsPassword: boolean;
    authMethod: string;
    error?: string;
  } | null>(null);
  const [isCheckingInstallModalAuth, setIsCheckingInstallModalAuth] = useState(false);
  const [installModalPassword, setInstallModalPassword] = useState<string>("");
  const [installModalServerId, setInstallModalServerId] = useState<string | null>(null);
  
  // Step execution modal state
  const [currentExecutingStep, setCurrentExecutingStep] = useState<{
    stepLabel: string;
    playbookFilename: string;
    status: "running" | "completed" | "error";
    logs: string[];
  } | null>(null);

  useEffect(() => {
    if (stepExecutionLogRef.current && currentExecutingStep?.logs.length) {
      stepExecutionLogRef.current.scrollTop = stepExecutionLogRef.current.scrollHeight;
    }
  }, [currentExecutingStep?.logs]);

  // Init quickly steps status for quick modal - Bước 2 có 3 bước con
  const [initQuicklySteps, setInitQuicklySteps] = useState<Array<{
    id: number;
    label: string;
    status: "pending" | "running" | "completed" | "error";
    errorMessage?: string;
  }>>([
    { id: 1, label: "Bước 1: Tạo cấu trúc thư mục", status: "pending" },
    { id: 2, label: "Bước 2: Ghi cấu hình mặc định", status: "pending" },
    { id: 3, label: "Bước 3: Phân phối SSH key", status: "pending" },
  ]);

  // Ping nodes step status (Bước 3 riêng)
  const [pingNodesStep, setPingNodesStep] = useState<{
    status: "pending" | "running" | "completed" | "error";
    errorMessage?: string;
  }>({ status: "pending" });

  // Init templates step status (Bước 4)
  const [initTemplatesStep, setInitTemplatesStep] = useState<{
    status: "pending" | "running" | "completed" | "error";
    errorMessage?: string;
  }>({ status: "pending" });
  const [sudoPasswords, setSudoPasswords] = useState<Record<string, string>>({});
  const [pendingAnsibleAction, setPendingAnsibleAction] = useState<"install" | "reinstall" | "uninstall" | null>(null);
  const [pendingControllerHost, setPendingControllerHost] = useState<string | null>(null);
  const [pendingServerId, setPendingServerId] = useState<number | null>(null);

  // Server auth status states
  const [serverAuthStatus, setServerAuthStatus] = useState<{
    hasSshKey: boolean;
    hasSudoNopasswd: boolean | null;
    needsPassword: boolean;
    authMethod: string;
    error?: string;
  } | null>(null);
  const [isCheckingAuthStatus, setIsCheckingAuthStatus] = useState(false);

  // Ansible operation steps (thay thế logs)
  const [ansibleOperationSteps, setAnsibleOperationSteps] = useState<Array<{
    id: number;
    label: string;
    status: "pending" | "running" | "completed" | "error";
  }>>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);

  // Config backup states (for rollback)
  const [configBackup, setConfigBackup] = useState<{
    ansibleCfg: string;
    ansibleInventory: string;
    ansibleVars: string;
  } | null>(null);
  const [isVerifyingConfig, setIsVerifyingConfig] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Playbook states
  const [playbooks, setPlaybooks] = useState<Array<{ name: string; content: string; size?: number }>>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string | null>(null);
  const [playbookFilename, setPlaybookFilename] = useState("");
  const [playbookContent, setPlaybookContent] = useState("");
  const [playbookTemplate, setPlaybookTemplate] = useState("");
  const [playbookSearchQuery, setPlaybookSearchQuery] = useState("");
  const [isSavingPlaybook, setIsSavingPlaybook] = useState(false);
  const [isExecutingPlaybook, setIsExecutingPlaybook] = useState(false);
  const [isDeletingPlaybook, setIsDeletingPlaybook] = useState(false);
  const [playbookExecutionLogs, setPlaybookExecutionLogs] = useState<string[]>([]);
  const [isLoadingPlaybooks, setIsLoadingPlaybooks] = useState(false);
  const [isUploadingPlaybook, setIsUploadingPlaybook] = useState(false);
  const playbookExecutionLogRef = useRef<HTMLDivElement>(null);
  const playbookTaskLogLengthRef = useRef(0);
  const playbookTaskPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Init Ansible log states
  const [initLogs, setInitLogs] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [runningStep, setRunningStep] = useState<number | null>(null);
  const initLogRef = useRef<HTMLDivElement>(null);
  const [initSudoPassword, setInitSudoPassword] = useState<string>("");
  const initTaskLogLengthRef = useRef(0);
  const initTaskPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Prerequisites check states
  const [prerequisites, setPrerequisites] = useState<{
    serversReady: boolean;
    masterExists: boolean;
    sshKeysConfigured: boolean;
    dockerInstalled: boolean;
  }>({
    serversReady: false,
    masterExists: false,
    sshKeysConfigured: false,
    dockerInstalled: false,
  });

  // Configuration states
  const [k8sVersion, setK8sVersion] = useState("1.28.0");
  const [podNetworkCidr, setPodNetworkCidr] = useState("10.244.0.0/16");
  const [serviceCidr, setServiceCidr] = useState("10.96.0.0/12");
  const [containerRuntime, setContainerRuntime] = useState("containerd");

  // Ansible configuration states
  const [ansibleCfg, setAnsibleCfg] = useState("");
  const [ansibleInventory, setAnsibleInventory] = useState("");
  const [ansibleVars, setAnsibleVars] = useState("");

  useEffect(() => {
    // Tải dữ liệu khi vào trang
    loadData();
    // Kiểm tra trạng thái Ansible khi vào trang (chỉ kiểm tra 1 lần)
    // Error sẽ luôn được hiển thị trong handleCheckAnsibleStatus dù silent=true
    if (!hasCheckedAnsibleStatusOnMount.current) {
      hasCheckedAnsibleStatusOnMount.current = true;
      handleCheckAnsibleStatus(true);
    }
  }, []);

  // Kiểm tra auth status khi modal mở
  useEffect(() => {
    if (showSudoPasswordModal && pendingServerId) {
      checkServerAuthStatus();
    } else {
      setServerAuthStatus(null);
    }
  }, [showSudoPasswordModal, pendingServerId]);

  // Auto-update Ansible steps based on status - 3 bước với button
  useEffect(() => {
    // Bước 1: Kiểm tra & Cài đặt Ansible
    const step1Status =
      isCheckingAnsibleStatus || isInstallingAnsible || isReinstallingAnsible
        ? "active"
        : ansibleStatus?.installed
        ? "completed"
        : "pending";

    const step1Button = null;

    // Bước 2: Khởi tạo Ansible (3 bước: Tạo cấu trúc, Ghi cấu hình, Phân phối SSH key)
    const step2Status = 
      initQuicklySteps.some(s => s.status === "running") 
        ? "active" 
        : initQuicklySteps.every(s => s.status === "completed")
        ? "completed"
        : ansibleStatus?.installed 
        ? "pending" 
        : "pending";

    const step2Button = null;

    // Bước 3: Ping nodes - Không ràng buộc với bước 2
    const step3Status = 
      pingNodesStep.status === "running"
        ? "active"
        : pingNodesStep.status === "completed"
        ? "completed"
        : pingNodesStep.status === "error"
        ? "error"
        : ansibleStatus?.installed
        ? "pending"
        : "pending";

    const step3Button = null;

    // Bước 4: Khởi tạo templates - Không ràng buộc với bước 3
    const step4Status = 
      initTemplatesStep.status === "running"
        ? "active"
        : initTemplatesStep.status === "completed"
        ? "completed"
        : initTemplatesStep.status === "error"
        ? "error"
        : ansibleStatus?.installed
        ? "pending"
        : "pending";

    const step4Button = null;

    setAnsibleSteps([
      {
        id: "step1",
        label: "Bước 1: Kiểm tra & Cài đặt Ansible",
        description: "Kiểm tra trạng thái và cài đặt Ansible trên controller host",
        status: step1Status as "pending" | "active" | "completed" | "error",
        button: step1Button,
      },
      {
        id: "step2",
        label: "Bước 2: Khởi tạo Ansible",
        description: "Tạo cấu trúc, cấu hình, phân phối SSH key (3 bước)",
        status: step2Status as "pending" | "active" | "completed" | "error",
        button: step2Button,
      },
      {
        id: "step3",
        label: "Bước 3: Ping nodes",
        description: "Ping và kiểm tra kết nối đến các nodes",
        status: step3Status as "pending" | "active" | "completed" | "error",
        button: step3Button,
      },
      {
        id: "step4",
        label: "Bước 4: Khởi tạo templates",
        description: "Tạo các template playbook cho việc cài đặt K8s",
        status: step4Status as "pending" | "active" | "completed" | "error",
        button: step4Button,
      },
    ]);
  }, [
    isCheckingAnsibleStatus,
    isInstallingAnsible,
    isReinstallingAnsible,
    ansibleStatus,
    isInitializing,
    part1Completed,
    initQuicklySteps,
    pingNodesStep,
    initTemplatesStep,
  ]);

  // Auto-update K8s Tab 1 steps with buttons - Buttons removed
  useEffect(() => {
    setK8sTab1Steps((prev) =>
      prev.map((step) => ({ ...step, button: null }))
    );
  }, [k8sTab1Steps.map(s => `${s.id}-${s.status}`).join(","), ansibleStatus?.installed]);

  // Auto-update K8s Tab 2 steps with buttons - Buttons removed
  useEffect(() => {
    setK8sTab2Steps((prev) =>
      prev.map((step) => ({ ...step, button: null }))
    );
  }, [k8sTab2Steps.map(s => `${s.id}-${s.status}`).join(","), ansibleStatus?.installed]);

  // Auto-update K8s Tab 3 steps with buttons - Buttons removed
  useEffect(() => {
    setK8sTab3Steps((prev) =>
      prev.map((step) => ({ ...step, button: null }))
    );
  }, [k8sTab3Steps.map(s => `${s.id}-${s.status}`).join(","), ansibleStatus?.installed]);

  // Load Ansible config removed - GET /api/admin/ansible/config


  const checkServerAuthStatus = async () => {
    if (!pendingServerId) return;

    setIsCheckingAuthStatus(true);
    try {
      const status = await adminAPI.checkServerAuthStatus(pendingServerId);
      setServerAuthStatus(status);
    } catch (error: any) {
      const errorMessage = error.message || "Không thể kiểm tra trạng thái xác thực";
      setServerAuthStatus({
        hasSshKey: false,
        hasSudoNopasswd: null,
        needsPassword: true,
        authMethod: "error",
        error: errorMessage,
      });
    } finally {
      setIsCheckingAuthStatus(false);
    }
  };

  // Khởi tạo các bước dựa trên action type
  const initializeAnsibleSteps = (action: "install" | "reinstall" | "uninstall") => {
    let steps: Array<{ id: number; label: string; status: "pending" | "running" | "completed" | "error" }> = [];

    if (action === "install") {
      steps = [
        { id: 1, label: "Cập nhật package manager", status: "pending" },
        { id: 2, label: "Cài đặt Python và pip", status: "pending" },
        { id: 3, label: "Cài đặt Ansible", status: "pending" },
        { id: 4, label: "Kiểm tra cài đặt", status: "pending" },
      ];
    } else if (action === "reinstall") {
      steps = [
        { id: 1, label: "Cập nhật pip", status: "pending" },
        { id: 2, label: "Cài đặt lại/nâng cấp Ansible", status: "pending" },
        { id: 3, label: "Kiểm tra phiên bản Ansible", status: "pending" },
      ];
    } else if (action === "uninstall") {
      steps = [
        { id: 1, label: "Kiểm tra hiện trạng Ansible", status: "pending" },
        { id: 2, label: "Gỡ Ansible bằng pip", status: "pending" },
        { id: 3, label: "Gỡ Ansible bằng apt (nếu có)", status: "pending" },
        { id: 4, label: "Dọn dẹp file và thư mục", status: "pending" },
        { id: 5, label: "Kiểm tra sau khi gỡ", status: "pending" },
      ];
    }

    setAnsibleOperationSteps(steps);
    setCurrentStepIndex(-1);
  };

  // Cập nhật trạng thái bước
  const updateAnsibleStep = (stepId: number, status: "pending" | "running" | "completed" | "error") => {
    setAnsibleOperationSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  // Đặt bước hiện tại đang chạy
  const setAnsibleRunningStep = (stepId: number) => {
    setCurrentStepIndex(stepId - 1);
    updateAnsibleStep(stepId, "running");
    // Đánh dấu các bước trước đó là completed
    setAnsibleOperationSteps((prev) =>
      prev.map((step) => (step.id < stepId ? { ...step, status: "completed" as const } : step))
    );
  };

  // Hoàn thành bước
  const completeStep = (stepId: number) => {
    updateAnsibleStep(stepId, "completed");
  };

  // Đánh dấu lỗi bước
  const errorStep = (stepId: number) => {
    updateAnsibleStep(stepId, "error");
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [clusterData, serversData] = await Promise.all([
        adminAPI.getCluster(),
        adminAPI.getServers(),
      ]);
      setCluster(clusterData);
      setServers(serversData);
      checkPrerequisites(clusterData, serversData);
    } catch (error: any) {
      console.error("Error loading data:", error);
      const errorMessage = error?.message || "Không thể tải dữ liệu";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const checkPrerequisites = (clusterData: Cluster | null, serversData: Server[]) => {
    const clusterServers = serversData.filter((s) => s.clusterStatus === "AVAILABLE");
    const masterServers = clusterServers.filter((s) => s.role === "MASTER");
    const onlineServers = clusterServers.filter((s) => s.status === "online");

    setPrerequisites({
      serversReady: clusterServers.length > 0 && onlineServers.length === clusterServers.length,
      masterExists: masterServers.length > 0,
      sshKeysConfigured: clusterServers.length > 0, // Simplified check
      dockerInstalled: false, // Would need to check via SSH
    });
  };

  // Get servers by role
  const ansibleServers = servers.filter((s) => s.role === "ANSIBLE");
  const dockerServers = servers.filter((s) => s.role === "DOCKER");
  const clusterServers = servers.filter(
    (s) => s.clusterStatus === "AVAILABLE" && (s.role === "MASTER" || s.role === "WORKER")
  );
  const masterServers = clusterServers.filter((s) => s.role === "MASTER");
  const workerServers = clusterServers.filter((s) => s.role === "WORKER");

  // Helper: chọn controller server
  // Chỉ sử dụng server với role=ANSIBLE (không fallback sang MASTER)
  const pickControllerServer = () => {
    const onlineAnsible = ansibleServers.filter((s) => s.status === "online");
    if (onlineAnsible.length > 0) return onlineAnsible[0];
    if (ansibleServers.length > 0) return ansibleServers[0];
    return null;
  };

  // Tính toán thông tin cluster để hiển thị
  const masterCount = masterServers.length;
  const workerCount = workerServers.length;
  const clusterStatusText = cluster?.status === "healthy" ? "healthy" : "unhealthy";
  const clusterVersionText = cluster?.version || "Unknown";


  // Open install/uninstall modal
  const openInstallModal = async (
    url: string,
    title: string,
    type: "install" | "uninstall",
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setLogs: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setInstallModalAction({ url, title, type, setLoading, setLogs });
    setInstallModalSteps([
      { id: "confirm", label: "Xác nhận", description: "Xác nhận thực hiện thao tác", status: "pending" },
      { id: "executing", label: "Đang thực thi", description: "Đang chạy lệnh...", status: "pending" },
      { id: "completed", label: "Hoàn tất", description: "Thao tác đã hoàn thành", status: "pending" },
    ]);
    setInstallModalLogs([]);
    installTaskLogLengthRef.current = 0;
    setInstallModalPassword("");
    setInstallModalServerId(null);
    setInstallModalAuthStatus(null);

    // Kiểm tra sudo NOPASSWD cho cài đặt Ansible
    if (url === "/install/setup-ansible") {
      const controllerServer = pickControllerServer();
      if (controllerServer && controllerServer.id) {
        setInstallModalServerId(controllerServer.id);
        await checkInstallModalAuthStatus(controllerServer.id);
      }
    }
    
    setShowInstallModal(true);
  };
  
  // Check auth status for install modal (Ansible only)
  const checkInstallModalAuthStatus = async (serverId: string) => {
    setIsCheckingInstallModalAuth(true);
    try {
      const serverIdNum = parseInt(serverId, 10);
      if (isNaN(serverIdNum)) {
        throw new Error("Invalid server ID");
      }
      const status = await adminAPI.checkServerAuthStatus(serverIdNum);
      setInstallModalAuthStatus(status);
    } catch (error: any) {
      const errorMessage = error.message || "Không thể kiểm tra trạng thái xác thực";
      setInstallModalAuthStatus({
        hasSshKey: false,
        hasSudoNopasswd: null,
        needsPassword: true,
        authMethod: "error",
        error: errorMessage,
      });
    } finally {
      setIsCheckingInstallModalAuth(false);
    }
  };

  // Cancel install task polling
  const cancelInstallTaskPolling = useCallback(() => {
    if (installTaskPollingRef.current) {
      clearTimeout(installTaskPollingRef.current);
      installTaskPollingRef.current = null;
        }
  }, []);

  useEffect(() => {
    return () => {
      cancelInstallTaskPolling();
    };
  }, [cancelInstallTaskPolling]);

  // Append log chunk for install modal
  const appendInstallLogChunk = useCallback((chunk: string) => {
    if (!chunk) return;
    const normalized = chunk.replace(/\r/g, "");
    const lines = normalized.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    if (lines.length === 0) return;
    const timestamp = new Date().toLocaleTimeString("vi-VN");
    setInstallModalLogs((prev) => [
      ...prev,
      ...lines.map((line) => `[${timestamp}] ${line}`),
    ]);
  }, []);

  // Monitor install task with polling
  const monitorInstallTask = useCallback(
    (taskId: string) => {
      return new Promise<void>((resolve, reject) => {
        const poll = async () => {
    try {
            const res = await api.get(`/install/status/${taskId}`);
            const status = res.data;
            
            if (status.logs) {
              const logs = status.logs;
              if (typeof logs === "string") {
                if (logs.length < installTaskLogLengthRef.current) {
                  installTaskLogLengthRef.current = 0;
    }
                const newChunk = logs.substring(installTaskLogLengthRef.current);
                installTaskLogLengthRef.current = logs.length;
                if (newChunk) {
                  appendInstallLogChunk(newChunk);
    }
              }
            }

            if (status.status === "running") {
              installTaskPollingRef.current = setTimeout(poll, 1500);
            } else if (status.status === "completed") {
              cancelInstallTaskPolling();
              appendInstallLogChunk("✅ Hoàn tất thành công!\n");
              resolve();
            } else if (status.status === "failed") {
              cancelInstallTaskPolling();
              const errorMsg = status.error || "Thao tác thất bại";
              appendInstallLogChunk(`❌ Lỗi: ${errorMsg}\n`);
              reject(new Error(errorMsg));
            } else if (status.status === "not_found") {
              cancelInstallTaskPolling();
              const errorMsg = "Không tìm thấy task hoặc task đã hết hạn";
              appendInstallLogChunk(`❌ Lỗi: ${errorMsg}\n`);
              reject(new Error(errorMsg));
            } else {
              cancelInstallTaskPolling();
              resolve();
            }
    } catch (error: any) {
            cancelInstallTaskPolling();
            const msg = error?.response?.data?.message || error?.message || "Lỗi khi poll task status";
            appendInstallLogChunk(`❌ Lỗi: ${msg}\n`);
            reject(error);
          }
        };

        poll();
      });
    },
    [appendInstallLogChunk, cancelInstallTaskPolling]
  );

  // Execute install/uninstall action
  const handleConfirmInstallAction = async () => {
    if (!installModalAction) return;

    // Update step 1 to completed and step 2 to active
    setInstallModalSteps((prev) =>
      prev.map((step) => {
        if (step.id === "confirm") return { ...step, status: "completed" as const };
        if (step.id === "executing") return { ...step, status: "active" as const };
        return step;
      })
    );

    const { url, setLoading, setLogs } = installModalAction;
    setLoading(true);
    setInstallModalLogs([]);
    installTaskLogLengthRef.current = 0;
    cancelInstallTaskPolling();

    try {
      appendInstallLogChunk("🚀 Bắt đầu thực thi...\n");
      
      // Start the task and get taskId
      const res = await api.post(url);
      const data = (res as any)?.data ?? res;
      
      let taskId: string | null = null;
      if (data?.taskId) {
        taskId = data.taskId;
      } else if (typeof data === "string") {
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(data);
          taskId = parsed.taskId;
        } catch {
          // Not JSON, treat as old format
        }
      }
      
      if (taskId) {
        // Use polling to monitor task
        appendInstallLogChunk(`📋 Task ID: ${taskId}\n`);
        await monitorInstallTask(taskId);
        
        // Update step 2 to completed and step 3 to completed
        setInstallModalSteps((prev) =>
          prev.map((step) => {
            if (step.id === "executing") return { ...step, status: "completed" as const };
            if (step.id === "completed") return { ...step, status: "completed" as const };
            return step;
          })
        );
        
        // Reload Ansible status nếu là cài đặt/gỡ Ansible
        if (url === "/install/setup-ansible" || url === "/install/uninstall-ansible") {
          appendInstallLogChunk("🔄 Đang cập nhật trạng thái Ansible...\n");
          try {
            await handleCheckAnsibleStatus();
            appendInstallLogChunk("✅ Đã cập nhật trạng thái Ansible\n");
          } catch (error) {
            appendInstallLogChunk("⚠️ Không thể cập nhật trạng thái Ansible (có thể kiểm tra thủ công)\n");
    }
        }
        
        toast.success("Thao tác hoàn tất thành công!");
      } else {
        // Fallback to old format (backward compatibility)
        const logs: string[] = Array.isArray(data) ? data : data?.logs || [];
        if (logs.length) {
          logs.forEach((log) => appendInstallLogChunk(log));
          setLogs(logs);
        }
        
        setInstallModalSteps((prev) =>
          prev.map((step) => {
            if (step.id === "executing") return { ...step, status: "completed" as const };
            if (step.id === "completed") return { ...step, status: "completed" as const };
            return step;
          })
        );
        
        appendInstallLogChunk("✅ Hoàn tất thành công!\n");
        toast.success("Thao tác hoàn tất thành công!");
      }
    } catch (error: any) {
      const msg = error?.message || error?.response?.data?.message || "Thao tác thất bại";
      appendInstallLogChunk(`❌ Lỗi: ${msg}\n`);

      // Update step 2 to error
      setInstallModalSteps((prev) =>
        prev.map((step) => {
          if (step.id === "executing") return { ...step, status: "error" as const };
          return step;
        })
      );
      
      toast.error(msg);
    } finally {
      setLoading(false);
      cancelInstallTaskPolling();
    }
  };

  const handleCloseInstallModal = () => {
    if (installModalAction?.setLoading) {
      const isLoading = installModalAction.setLoading;
      // Check if still loading (would need a ref or state check)
      // For now, just close
    }
    cancelInstallTaskPolling();
    setShowInstallModal(false);
    setInstallModalAction(null);
    setInstallModalLogs([]);
    installTaskLogLengthRef.current = 0;
    setInstallModalAuthStatus(null);
    setInstallModalPassword("");
    setInstallModalServerId(null);
  };

  // Auto-scroll install modal logs
  useEffect(() => {
    if (installModalLogRef.current && installModalAction) {
      installModalLogRef.current.scrollTop = installModalLogRef.current.scrollHeight;
    }
  }, [installModalLogs, installModalAction]);

  // Check Ansible status handler
  const handleCheckAnsibleStatus = async (silent: boolean = false) => {
    setIsCheckingAnsibleStatus(true);
        try {
          const status = await adminAPI.checkAnsibleStatus();
          setAnsibleStatus(status);
      
          // Chỉ hiển thị toast khi không silent
          if (!silent) {
            // Nếu có error thì chỉ hiển thị cho một số lỗi chung, bỏ qua thông báo offline ANSIBLE
            if (status.error) {
              const msg = status.error;
              const isAnsibleOfflineMsg = msg.includes("Server với role ANSIBLE") && msg.includes("đang offline");
              if (!isAnsibleOfflineMsg) {
                toast.warning(msg, {
                  duration: 5000,
                });
              }
            } else {
            // Chỉ hiển thị toast success/info khi không silent và không có error
              if (status.installed) {
                toast.success(`Ansible đã được cài đặt${status.version ? ` (${status.version})` : ""}`);
              } else {
                toast.info("Ansible chưa được cài đặt");
              }
            }
          }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || "Không thể kiểm tra trạng thái Ansible";
      // Luôn hiển thị error toast
      toast.error(errorMsg);
      setAnsibleStatus({
        installed: false,
        error: errorMsg,
      });
    } finally {
      setIsCheckingAnsibleStatus(false);
    }
  };

  // Check Docker status handler
  const handleCheckDockerStatus = async (silent: boolean = false) => {
    setIsCheckingDockerStatus(true);
    try {
      const status = await adminAPI.checkDockerStatus();

      setDockerStatus({
        installed: !!status.installed,
        version: status.version || undefined,
        dockerHost: status.dockerHost || undefined,
        dockerRole: (status.dockerRole as "DOCKER") || undefined,
        error: status.error || undefined,
      });

      // Chỉ hiển thị toast khi không silent
      if (!silent) {
        if (status.installed) {
          toast.success(`Docker đã được cài đặt${status.version ? ` (${status.version})` : ""}`);
        } else if (status.error) {
          toast.error(status.error);
        } else {
          toast.info("Docker chưa được cài đặt hoặc không truy cập được");
        }
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || "Không thể kiểm tra trạng thái Docker";
      // Luôn hiển thị error toast
      toast.error(errorMsg);
      setDockerStatus({
        installed: false,
        error: errorMsg,
      });
    } finally {
      setIsCheckingDockerStatus(false);
    }
  };

  // Tự động kiểm tra trạng thái Docker khi vào trang (silent mode)
  useEffect(() => {
    handleCheckDockerStatus(true);
    // Chỉ cần gọi một lần khi mount trang
  }, []);

  // Load Ansible config handler
  const handleLoadAnsibleConfig = async () => {
    try {
      setIsLoadingPlaybooks(true);
      const config = await adminAPI.getAnsibleConfig();
      if (config.success) {
        setAnsibleCfg(config.ansibleCfg || "");
        setAnsibleInventory(config.ansibleInventory || "");
        setAnsibleVars(config.ansibleVars || "");
        toast.success("Đã tải cấu hình Ansible");
      } else {
        throw new Error(config.error || "Không thể tải cấu hình");
      }
    } catch (error: any) {
      const errorMsg = error?.message || "Không thể tải cấu hình Ansible";
      toast.error(errorMsg);
    } finally {
      setIsLoadingPlaybooks(false);
    }
  };

  // Regenerate ansible.cfg & hosts.ini rồi tải lại cấu hình
  const handleUpdateAnsibleConfig = async () => {
    try {
      setIsLoadingPlaybooks(true);
      const updateResult = await adminAPI.updateAnsibleConfig();
      if (!updateResult.success) {
        throw new Error(updateResult.error || updateResult.message || "Không thể cập nhật cấu hình");
      }
      toast.success(updateResult.message || "Đã cập nhật cấu hình Ansible");
      await handleLoadAnsibleConfig();
      setOptionsModalTab("config");
      setShowOptionsModal(true);
    } catch (error: any) {
      const errorMsg = error?.message || "Không thể cập nhật cấu hình Ansible";
      toast.error(errorMsg);
    } finally {
      setIsLoadingPlaybooks(false);
    }
  };

  // Load Kubespray playbooks handler
  const handleLoadKubesprayPlaybooks = async () => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    try {
      setIsLoadingPlaybooks(true);
      const result = await adminAPI.getPlaybooks(ansibleStatus.controllerHost);

      // Filter only kubespray playbooks (thư mục ~/kubespray)
      // Các playbook kubespray thường có tên: cluster.yml, reset.yml, scale.yml, upgrade.yml
      const kubesprayPlaybooks = (result.playbooks || []).filter((p) => {
        const name = p.name.toLowerCase();
        return name.includes("kubespray") || 
               name.match(/^(cluster|reset|scale|upgrade)\.yml$/) ||
               name.includes("cluster.yml") ||
               name.includes("reset.yml");
      });
      
      setPlaybooks(kubesprayPlaybooks);
      toast.success(`Đã tải ${kubesprayPlaybooks.length} playbook kubespray`);
    } catch (error: any) {
      const errorMsg = error?.message || "Không thể tải danh sách playbook";
      toast.error(errorMsg);
    } finally {
      setIsLoadingPlaybooks(false);
    }
  };

  // Execute playbook handler
  const handleExecutePlaybook = async () => {
    if (!selectedPlaybook) {
      toast.error("Vui lòng chọn playbook để thực thi");
      return;
    }

    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    if (!confirm(`Bạn có chắc muốn thực thi playbook "${selectedPlaybook}"?`)) {
      return;
    }

    try {
      setIsExecutingPlaybook(true);
      clearPlaybookExecutionLogs();
      addPlaybookExecutionLog(`🚀 Bắt đầu thực thi playbook: ${selectedPlaybook}`, "step");

      const result = await adminAPI.executePlaybook({
        controllerHost: ansibleStatus.controllerHost,
        filename: selectedPlaybook,
        sudoPassword: initSudoPassword || undefined,
      });

      if (!result.success || !result.taskId) {
        throw new Error(result.error || result.message || "Không thể bắt đầu thực thi playbook");
        }

      await monitorPlaybookTask(result.taskId, selectedPlaybook);
    } catch (error: any) {
      const errorMessage = error.message || "Lỗi khi thực thi playbook";
      addPlaybookExecutionLog(`❌ ${errorMessage}`, "error");
      toast.error(errorMessage);
    } finally {
      setIsExecutingPlaybook(false);
      cancelPlaybookTaskPolling();
    }
  };

  const handleSetupAnsibleSimple = () => {
    openInstallModal(
      "/install/setup-ansible",
      "Cài đặt Ansible",
      "install",
      setIsInstallingAnsible,
      setSetupAnsibleLogs
    );
  };

  const handleInstallK8sCluster = () => {
    openInstallModal(
      "/install/install-kubernetes-kubespray",
      "Cài đặt Kubernetes",
      "install",
      setIsInstallingK8sCluster,
      setK8sClusterInstallLogs
    );
  };

  const handleInstallK8sAddons = () => {
    openInstallModal(
      "/install/install-k8s-addons",
      "Cài đặt K8s Addons",
      "install",
      setIsInstallingK8sAddons,
      setK8sTab2ApiLogs
    );
  };

  const handleInstallMetricsServer = () => {
    openInstallModal(
      "/install/install-metrics-server",
      "Cài đặt Metrics Server",
      "install",
      setIsInstallingMetricsServer,
      setK8sTab2ApiLogs
    );
  };

  const handleInstallDocker = () => {
    openInstallModal(
      "/install/install-docker",
      "Cài đặt Docker",
      "install",
      setIsInstallingDocker,
      setK8sTab2ApiLogs
    );
  };

  // Uninstall handlers
  const handleUninstallAnsibleSimple = () => {
    openInstallModal(
      "/install/uninstall-ansible",
      "Gỡ cài đặt Ansible",
      "uninstall",
      setIsUninstallingAnsible,
      setSetupAnsibleLogs
    );
  };

  const handleUninstallK8sCluster = () => {
    openInstallModal(
      "/install/uninstall-kubernetes-kubespray",
      "Gỡ cài đặt Kubernetes",
      "uninstall",
      setIsUninstallingK8sCluster,
      setK8sClusterInstallLogs
    );
  };

  const handleUninstallK8sAddons = () => {
    openInstallModal(
      "/install/uninstall-k8s-addons",
      "Gỡ cài đặt K8s Addons",
      "uninstall",
      setIsUninstallingK8sAddons,
      setK8sTab2ApiLogs
    );
  };

  const handleUninstallMetricsServer = () => {
    openInstallModal(
      "/install/uninstall-metrics-server",
      "Gỡ cài đặt Metrics Server",
      "uninstall",
      setIsUninstallingMetricsServer,
      setK8sTab2ApiLogs
    );
  };

  const handleUninstallDocker = () => {
    openInstallModal(
      "/install/uninstall-docker",
      "Gỡ cài đặt Docker",
      "uninstall",
      setIsUninstallingDocker,
      setK8sTab2ApiLogs
    );
  };


  // Helper functions for K8s tab logs
  const addK8sTab1Log = (message: string, type: "info" | "success" | "error" | "step" = "info") => {
    const timestamp = new Date().toLocaleTimeString("vi-VN");
    const prefix = type === "step" ? "📋" : type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
    setK8sTab1Logs((prev) => [...prev, `[${timestamp}] ${prefix} ${message}`]);
  };

  const addK8sTab2Log = (message: string, type: "info" | "success" | "error" | "step" = "info") => {
    const timestamp = new Date().toLocaleTimeString("vi-VN");
    const prefix = type === "step" ? "📋" : type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
    setK8sTab2Logs((prev) => [...prev, `[${timestamp}] ${prefix} ${message}`]);
  };

  const addK8sTab3Log = (message: string, type: "info" | "success" | "error" | "step" = "info") => {
    const timestamp = new Date().toLocaleTimeString("vi-VN");
    const prefix = type === "step" ? "📋" : type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
    setK8sTab3Logs((prev) => [...prev, `[${timestamp}] ${prefix} ${message}`]);
  };

  // Auto-scroll logs
  useEffect(() => {
    if (k8sTab1LogRef.current && isInstallingK8sTab1) {
      k8sTab1LogRef.current.scrollTop = k8sTab1LogRef.current.scrollHeight;
    }
  }, [k8sTab1Logs, isInstallingK8sTab1]);

  useEffect(() => {
    if (k8sTab2LogRef.current && isInstallingK8sTab2) {
      k8sTab2LogRef.current.scrollTop = k8sTab2LogRef.current.scrollHeight;
    }
  }, [k8sTab2Logs, isInstallingK8sTab2]);

  useEffect(() => {
    if (k8sTab3LogRef.current && isInstallingK8sTab3) {
      k8sTab3LogRef.current.scrollTop = k8sTab3LogRef.current.scrollHeight;
    }
  }, [k8sTab3Logs, isInstallingK8sTab3]);


  // Helper function để monitor playbook task và cập nhật logs (cho modal)
  const monitorPlaybookTaskForStepWithModal = async (
    taskId: string,
    playbookFilename: string,
    stepLabel: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      let lastLogLength = 0;
      const poll = async () => {
        try {
          const status = await adminAPI.getPlaybookExecutionStatus(taskId);
          
          if (status.logs) {
            const normalized = status.logs.replace(/\r/g, "");
            const allLines = normalized.split("\n").filter((line: string) => line.trim().length > 0);
            
            // Chỉ lấy các dòng mới (từ lastLogLength trở đi)
            const newLines = allLines.slice(lastLogLength);
            lastLogLength = allLines.length;
            
            // Cập nhật logs trong modal
            if (newLines.length > 0) {
              setCurrentExecutingStep((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  logs: [...prev.logs, ...newLines]
                };
              });
            }
          }

          if (status.status === "running") {
            setTimeout(poll, 1000);
          } else if (status.status === "completed") {
            const successMessage = `🎉 Đã thực thi playbook thành công: ${playbookFilename}`;
            setCurrentExecutingStep((prev) => 
              prev ? { 
                ...prev, 
                status: "completed",
                logs: [...prev.logs, successMessage] 
              } : null
            );
            resolve();
          } else if (status.status === "failed") {
            const errorMsg = status.error || "Thực thi playbook thất bại";
            setCurrentExecutingStep((prev) => 
              prev ? { 
                ...prev, 
                status: "error",
                logs: [...prev.logs, `❌ ${errorMsg}`] 
              } : null
            );
            reject(new Error(errorMsg));
          }
        } catch (error: any) {
          setCurrentExecutingStep((prev) => 
            prev ? { 
              ...prev, 
              status: "error",
              logs: [...prev.logs, `❌ Lỗi: ${error.message || "Không xác định"}`] 
            } : null
          );
          reject(error);
        }
      };
      poll();
    });
  };

  const handleUtilityActionClick = (
    actionKey: UtilityActionKey,
    playbookFilename: string,
    label: string,
    description: string
  ) => {
    setPendingAction({
      actionKey,
      playbookFilename,
      label,
      description,
    });
    setIsConfirmModalOpen(true);
  };

  const handleConfirmAction = async () => {
    toast.warning("Chức năng đã bị loại bỏ");
    setIsConfirmModalOpen(false);
    setPendingAction(null);
  };

  const handleCancelAction = () => {
    setIsConfirmModalOpen(false);
    setPendingAction(null);
  };

  const renderUtilityStatus = (status: UtilityActionStatus) => {
    if (status === "running") {
      return (
        <span className="mt-3 text-xs font-medium text-blue-600 flex items-center gap-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Đang thực thi...
        </span>
      );
    }

    if (status === "completed") {
      return (
        <span className="mt-3 text-xs font-medium text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Đã hoàn thành
        </span>
      );
    }

    if (status === "error") {
      return (
        <span className="mt-3 text-xs font-medium text-red-600 flex items-center gap-1">
          <XCircle className="h-3.5 w-3.5" />
          Thất bại, thử lại
        </span>
      );
    }

    return null;
  };



  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  // Auto-scroll log to bottom
  useEffect(() => {
    if (initLogRef.current) {
      initLogRef.current.scrollTop = initLogRef.current.scrollHeight;
    }
  }, [initLogs]);

  const clearInitLogs = () => {
    setInitLogs([]);
    initTaskLogLengthRef.current = 0;
  };

  const copyInitLogs = () => {
    const logText = initLogs.join("\n");
    navigator.clipboard.writeText(logText);
    toast.success("Đã sao chép log vào clipboard");
  };

  const appendInitLogChunk = useCallback((chunk: string) => {
    if (!chunk) return;
    const normalized = chunk.replace(/\r/g, "");
    const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) return;
    setInitLogs((prev) => [...prev, ...lines]);
  }, []);

  const emitInitLogLine = useCallback(
    (message: string) => {
      appendInitLogChunk(`${message}\n`);
    },
    [appendInitLogChunk]
  );

  const cancelInitTaskPolling = useCallback(() => {
    if (initTaskPollingRef.current) {
      clearTimeout(initTaskPollingRef.current);
      initTaskPollingRef.current = null;
    }
  }, []);


  useEffect(() => {
    return () => {
      cancelInitTaskPolling();
    };
  }, [cancelInitTaskPolling]);

  const monitorInitTask = useCallback(
    (taskId: string, stepLabel: string) => {
      return new Promise<void>((resolve, reject) => {
        const poll = async () => {
          try {
            const status = await adminAPI.getAnsibleInitStatus(taskId);
            if (status.logs) {
              const logs = status.logs;
              if (logs.length < initTaskLogLengthRef.current) {
                initTaskLogLengthRef.current = 0;
              }
              const newChunk = logs.substring(initTaskLogLengthRef.current);
              initTaskLogLengthRef.current = logs.length;
              appendInitLogChunk(newChunk);
            }

            if (status.status === "running") {
              initTaskPollingRef.current = setTimeout(poll, 1000);
            } else if (status.status === "completed") {
              cancelInitTaskPolling();
              resolve();
            } else if (status.status === "failed") {
              cancelInitTaskPolling();
              reject(new Error(status.error || `Bước ${stepLabel} thất bại`));
            } else if (status.status === "not_found") {
              cancelInitTaskPolling();
              reject(new Error("Không tìm thấy task hoặc task đã hết hạn"));
            } else {
              cancelInitTaskPolling();
              resolve();
            }
          } catch (error) {
            cancelInitTaskPolling();
            reject(error);
          }
        };

        poll();
      });
    },
    [appendInitLogChunk, cancelInitTaskPolling]
  );

  const runInitStep = useCallback(
    async ({
      stepNumber,
      startMessage,
      successMessage,
      startRequest,
    }: {
      stepNumber: number;
      startMessage: string;
      successMessage: string;
      startRequest: () => Promise<{ success: boolean; message?: string; error?: string; taskId?: string }>;
    }) => {
      if (!ansibleStatus?.controllerHost) {
        toast.error("Không tìm thấy controller host.");
        return false;
      }

      cancelInitTaskPolling();
      initTaskLogLengthRef.current = 0;
      setRunningStep(stepNumber);
      emitInitLogLine(startMessage);

      try {
        const result = await startRequest();
        if (!result.success) {
          throw new Error(result.message || result.error || "Thao tác thất bại");
        }
        if (!result.taskId) {
          throw new Error("Không nhận được taskId từ server");
        }

        await monitorInitTask(result.taskId, startMessage);
        toast.success(successMessage);
        return true;
      } catch (error: any) {
        const errorMessage = error.message || "Lỗi không xác định";
        // Không append log vì error đã được append trong logs từ backend qua markFailed()
        // Chỉ hiển thị toast để thông báo
        toast.error(errorMessage);
        return false;
      } finally {
        cancelInitTaskPolling();
        setRunningStep((prev) => (prev === stepNumber ? null : prev));
      }
    },
    [ansibleStatus?.controllerHost, cancelInitTaskPolling, emitInitLogLine, monitorInitTask]
  );


  // Backup config before saving
  const backupConfig = (
    cfg: string = ansibleCfg,
    inventory: string = ansibleInventory,
    vars: string = ansibleVars
  ) => {
    setConfigBackup({
      ansibleCfg: cfg,
      ansibleInventory: inventory,
      ansibleVars: vars,
    });
  };


  // Rollback config to backup
  const handleRollbackConfig = async () => {
    if (!configBackup) {
      toast.error("Không có bản backup để khôi phục");
      return;
    }

    if (!confirm("Bạn có chắc muốn khôi phục cấu hình về trạng thái trước đó? Các thay đổi chưa lưu sẽ bị mất.")) {
      return;
    }

    try {
      setIsRollingBack(true);

      // Restore from backup
      setAnsibleCfg(configBackup.ansibleCfg);
      setAnsibleInventory(configBackup.ansibleInventory);
      setAnsibleVars(configBackup.ansibleVars);

      toast.success("Đã khôi phục cấu hình");
    } catch (error: any) {
      const errorMessage = error.message || "Không thể khôi phục cấu hình";
      toast.error(errorMessage);
    } finally {
      setIsRollingBack(false);
    }
  };



  const handleCreatePlaybook = () => {
    setPlaybookFilename("");
    setPlaybookContent("");
    setPlaybookTemplate("");
    setSelectedPlaybook(null);
  };

  const handleSelectPlaybook = (playbookName: string) => {
    const playbook = playbooks.find((p) => p.name === playbookName);
    if (playbook) {
      setSelectedPlaybook(playbookName);
      setPlaybookFilename(playbookName.replace(".yml", ""));
      setPlaybookContent(playbook.content);
    }
  };

  const handleSavePlaybook = async () => {
    const trimmedName = playbookFilename.trim();
    if (!trimmedName) {
      toast.error("Vui lòng nhập tên file playbook");
      return;
    }

    if (!playbookContent.trim()) {
      toast.error("Vui lòng nhập nội dung playbook");
      return;
    }

    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    const filename = /\.ya?ml$/i.test(trimmedName) ? trimmedName : `${trimmedName}.yml`;

    try {
      setIsSavingPlaybook(true);
      const result = await adminAPI.savePlaybook({
        controllerHost: ansibleStatus.controllerHost,
        filename,
        content: playbookContent,
        sudoPassword: initSudoPassword || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || result.message || "Không thể lưu playbook");
      }

      toast.success(result.message || `Đã lưu playbook ${filename}`);
      setSelectedPlaybook(filename);
    } catch (error: any) {
      const errorMessage = error.message || "Không thể lưu playbook";
      toast.error(errorMessage);
    } finally {
      setIsSavingPlaybook(false);
    }
  };

  const handleDeletePlaybook = async () => {
    if (!selectedPlaybook) {
      toast.error("Vui lòng chọn playbook để xóa");
      return;
    }

    if (!confirm(`Bạn có chắc muốn xóa playbook "${selectedPlaybook}"?`)) {
      return;
    }

    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    try {
      setIsDeletingPlaybook(true);
      const result = await adminAPI.deletePlaybook({
        controllerHost: ansibleStatus.controllerHost,
        filename: selectedPlaybook,
        sudoPassword: initSudoPassword || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || result.message || "Không thể xóa playbook");
      }

      toast.success(result.message || `Đã xóa playbook ${selectedPlaybook}`);
    } catch (error: any) {
      const errorMessage = error.message || "Không thể xóa playbook";
      toast.error(errorMessage);
    } finally {
      setIsDeletingPlaybook(false);
    }
  };

  const addPlaybookExecutionLog = useCallback(
    (message: string, type: PlaybookLogType = "info") => {
      setPlaybookExecutionLogs((prev) => [...prev, formatPlaybookLogLine(message, type)]);
    },
    [setPlaybookExecutionLogs]
  );

  const appendPlaybookLogChunk = useCallback(
    (chunk: string) => {
      if (!chunk) return;
      const normalized = chunk.replace(/\r/g, "");
      const lines = normalized.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
      if (lines.length === 0) return;
      setPlaybookExecutionLogs((prev) => [
        ...prev,
        ...lines.map((line) => formatPlaybookLogLine(line, "info")),
      ]);
    },
    [setPlaybookExecutionLogs]
  );

  const clearPlaybookExecutionLogs = useCallback(() => {
    playbookTaskLogLengthRef.current = 0;
    setPlaybookExecutionLogs([]);
  }, [setPlaybookExecutionLogs]);

  const cancelPlaybookTaskPolling = useCallback(() => {
    if (playbookTaskPollingRef.current) {
      clearTimeout(playbookTaskPollingRef.current);
      playbookTaskPollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelPlaybookTaskPolling();
    };
  }, [cancelPlaybookTaskPolling]);

  // Auto-scroll execution log to bottom
  useEffect(() => {
    if (playbookExecutionLogRef.current && isExecutingPlaybook) {
      playbookExecutionLogRef.current.scrollTop = playbookExecutionLogRef.current.scrollHeight;
    }
  }, [playbookExecutionLogs, isExecutingPlaybook]);

  const monitorPlaybookTask = useCallback(
    (taskId: string, playbookName: string) => {
      const poll = async () => {
        try {
          const status = await adminAPI.getPlaybookExecutionStatus(taskId);
          if (status.logs) {
            if (status.logs.length < playbookTaskLogLengthRef.current) {
              playbookTaskLogLengthRef.current = 0;
            }
            const newChunk = status.logs.substring(playbookTaskLogLengthRef.current);
            playbookTaskLogLengthRef.current = status.logs.length;
            appendPlaybookLogChunk(newChunk);
          }

          if (status.status === "running") {
            playbookTaskPollingRef.current = setTimeout(poll, 1500);
            return;
          }

          cancelPlaybookTaskPolling();
          setIsExecutingPlaybook(false);

          if (status.status === "completed") {
            addPlaybookExecutionLog(`🎉 Thực thi playbook ${playbookName} hoàn tất!`, "success");
            toast.success(`Đã thực thi playbook ${playbookName} thành công!`);
          } else if (status.status === "failed") {
            const errorMessage = status.error || "Playbook thất bại";
            addPlaybookExecutionLog(`Lỗi: ${errorMessage}`, "error");
            toast.error(`Lỗi khi thực thi: ${errorMessage}`);
          } else if (status.status === "not_found") {
            const errorMessage = "Không tìm thấy task thực thi playbook";
            addPlaybookExecutionLog(errorMessage, "error");
            toast.error(errorMessage);
          } else {
            addPlaybookExecutionLog(`Trạng thái task: ${status.status}`, "info");
          }
        } catch (error: any) {
          cancelPlaybookTaskPolling();
          setIsExecutingPlaybook(false);
          const errorMessage = error.message || "Không thể lấy trạng thái playbook";
          addPlaybookExecutionLog(`Lỗi khi lấy trạng thái: ${errorMessage}`, "error");
          toast.error(errorMessage);
        }
      };

      poll();
    },
    [appendPlaybookLogChunk, cancelPlaybookTaskPolling, addPlaybookExecutionLog]
  );


  const handleUploadPlaybook = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      event.target.value = "";
      return;
    }

    try {
      setIsUploadingPlaybook(true);
      const result = await adminAPI.uploadPlaybookFile({
        controllerHost: ansibleStatus.controllerHost,
        file,
        sudoPassword: initSudoPassword || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || result.message || "Không thể tải lên playbook");
      }

      const content = await file.text();
      const filenameWithoutExt = file.name.replace(/\.ya?ml$/i, "");
      setPlaybookFilename(filenameWithoutExt);
      setPlaybookContent(content);
      setSelectedPlaybook(file.name.toLowerCase().endsWith(".yml") ? file.name : `${filenameWithoutExt}.yml`);
      toast.success(result.message || `Đã tải lên playbook ${file.name}`);
    } catch (error: any) {
      toast.error(error.message || "Không thể tải lên playbook");
    } finally {
      setIsUploadingPlaybook(false);
      event.target.value = "";
    }
  };

  const applyTemplateToEditor = (templateId: string, options: { showToast?: boolean } = {}) => {
    const template = getPlaybookTemplateById(templateId);
    if (!template) {
      toast.error("Không tìm thấy template đã chọn");
      return false;
    }

    setPlaybookFilename(template.filename.replace(/\.ya?ml$/i, ""));
    setPlaybookContent(template.content);
    if (options.showToast !== false) {
      toast.success(`Đã nạp template ${template.label} vào editor`);
    }
    return true;
  };

  const handleTemplateSelect = (templateId: string) => {
    setPlaybookTemplate(templateId);
    if (templateId) {
      applyTemplateToEditor(templateId, { showToast: false });
    }
  };

  const handleCreatePlaybookFromTemplate = async () => {
    if (!playbookTemplate) {
      toast.warning("Vui lòng chọn template trước");
      return;
    }
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    const template = getPlaybookTemplateById(playbookTemplate);
    if (!template) {
      toast.error("Không tìm thấy template đã chọn");
      return;
    }

    const customName = playbookFilename.trim();
    const finalName =
      customName.length > 0
        ? customName.toLowerCase().endsWith(".yml") || customName.toLowerCase().endsWith(".yaml")
          ? customName
          : `${customName}.yml`
        : template.filename;

    try {
      setIsSavingPlaybook(true);
      const result = await adminAPI.savePlaybook({
        controllerHost: ansibleStatus.controllerHost,
        filename: finalName,
        content: template.content,
        sudoPassword: initSudoPassword || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || result.message || "Không thể tạo playbook từ template");
      }

      setPlaybookFilename(finalName.replace(/\.ya?ml$/i, ""));
      setPlaybookContent(template.content);
      setSelectedPlaybook(finalName);
      toast.success(result.message || `Đã tạo playbook ${finalName}`);
    } catch (error: any) {
      toast.error(error.message || "Không thể tạo playbook từ template");
    } finally {
      setIsSavingPlaybook(false);
    }
  };

  // Load playbooks when modal opens - Removed

  // Filter playbooks by search query
  const filteredPlaybooks = playbooks.filter((p) =>
    p.name.toLowerCase().includes(playbookSearchQuery.toLowerCase())
  );


  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">⚙️ Cluster Setup</h2>
        <div className="border rounded-lg p-8 text-center">
          <div className="animate-pulse">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">⚙️ Cluster Setup</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Thiết lập và cấu hình Kubernetes Cluster
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Làm mới
        </Button>
      </div>

      {/* Cluster Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Thông tin Cluster
          </CardTitle>
          <CardDescription>
            Thông tin cluster hiện tại và trạng thái thiết lập
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Đang tải thông tin cluster...</span>
            </div>
          ) : cluster ? (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Nodes:</span>
                <span className="text-base font-medium">
                  {masterCount} Master, {workerCount} Worker
                  {cluster.nodeCount !== undefined && cluster.nodeCount !== masterCount + workerCount && (
                    <span className="text-muted-foreground ml-1">({cluster.nodeCount} total)</span>
                  )}
                </span>
                <Badge variant={cluster?.status === "healthy" ? "default" : "secondary"} className="ml-1">
                  {clusterStatusText}
                </Badge>
              </div>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Version:</span>
                <span className="text-base font-medium">{clusterVersionText}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Chưa có cluster được thiết lập. Vui lòng gán servers vào cluster để bắt đầu.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phần 1: Cài đặt và Khởi tạo Ansible */}
      <Card className="border-2">
        <CardHeader>
          <button
            onClick={() => toggleSection("ansible")}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">Phần 1: Cài đặt và Khởi tạo Ansible</CardTitle>
                  {ansibleStatus?.installed && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Hoàn thành
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  Cài đặt Ansible trên máy có role là ANSIBLE
                </CardDescription>
              </div>
            </div>
            {expandedSection === "ansible" ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </CardHeader>
        {expandedSection === "ansible" && (
          <CardContent className="space-y-4">
            {/* Card hiển thị thông tin Ansible */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Thông tin Ansible</CardTitle>
              </CardHeader>
              <CardContent>
                {ansibleServers.length === 0 ? (
                  <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Không tìm thấy server với role ANSIBLE</p>
                    <p className="text-sm mt-1">Vui lòng thêm server với role ANSIBLE trong trang Servers</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Trạng thái */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground font-medium">Trạng thái</Label>
                      <div className="flex items-center gap-2 min-h-[24px]">
                        {isCheckingAnsibleStatus ? (
                          <>
                            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
                            <span className="font-medium text-sm">Đang kiểm tra...</span>
                          </>
                        ) : ansibleStatus?.error ? (
                          // Backend báo lỗi (ví dụ: server ANSIBLE offline, SSH lỗi, v.v.)
                          <>
                            <div className="h-2 w-2 rounded-full bg-red-400"></div>
                            <span className="font-medium text-sm">Offline</span>
                          </>
                        ) : ansibleStatus?.controllerHost && ansibleStatus.controllerRole === "ANSIBLE" ? (
                          // Đã có kết quả từ API check và không có lỗi
                          <>
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="font-medium text-sm">Online</span>
                          </>
                        ) : ansibleServers.length > 0 ? (
                          // Có server trong danh sách -> hiển thị trạng thái từ server list (fallback)
                          ansibleServers[0]?.status === "online" ? (
                            <>
                              <div className="h-2 w-2 rounded-full bg-green-500"></div>
                              <span className="font-medium text-sm">Online</span>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 rounded-full bg-red-400"></div>
                              <span className="font-medium text-sm">Offline</span>
                            </>
                          )
                        ) : (
                          // Chưa có server nào
                          <>
                            <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                            <span className="font-medium text-sm">Chưa kiểm tra</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Máy controller */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground font-medium">Máy controller</Label>
                      <div className="font-medium text-sm min-h-[24px] flex items-center">
                        {isCheckingAnsibleStatus ? (
                          <span className="text-muted-foreground">Đang kiểm tra...</span>
                        ) : ansibleServers.length > 0 ? (
                          // Luôn hiển thị thông tin từ server list nếu có
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="break-all">{ansibleServers[0]?.ipAddress || ansibleStatus?.controllerHost || "-"}</span>
                            <Badge variant="outline" className="text-xs">
                              ANSIBLE
                            </Badge>
                          </div>
                        ) : ansibleStatus?.controllerHost ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="break-all">{ansibleStatus.controllerHost}</span>
                            <Badge variant="outline" className="text-xs">
                              {ansibleStatus.controllerRole || "ANSIBLE"}
                            </Badge>
                          </div>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>

                    {/* Phiên bản Ansible */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground font-medium">Phiên bản Ansible</Label>
                      <div className="font-medium min-h-[24px] flex items-center">
                        {isCheckingAnsibleStatus ? (
                          <Badge variant="outline" className="text-xs">Đang kiểm tra...</Badge>
                        ) : ansibleStatus?.installed ? (
                          <Badge variant="default" className="text-xs">
                            {ansibleStatus.version || "Đã cài đặt"}
                          </Badge>
                        ) : ansibleStatus?.error ? (
                          // Có lỗi (ví dụ: server offline, SSH lỗi, không kiểm tra được version)
                          <Badge variant="outline" className="text-xs">
                            Không kiểm tra được
                          </Badge>
                        ) : (
                          // Không có lỗi và chưa cài đặt
                          <Badge variant="secondary" className="text-xs">Chưa cài đặt</Badge>
                        )}
                      </div>
                    </div>

                    {/* Thao tác */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground font-medium">Thao tác</Label>
                      <div className="flex items-start gap-2 flex-wrap min-h-[24px]">
                        <Button
                          onClick={() => handleCheckAnsibleStatus(false)}
                          disabled={isCheckingAnsibleStatus || isInstallingAnsible || isUninstallingAnsible}
                          size="sm"
                          variant="outline"
                        >
                          {isCheckingAnsibleStatus ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              <span className="text-xs">Đang kiểm tra...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              <span className="text-xs">Kiểm tra trạng thái</span>
                            </>
                          )}
                        </Button>
                        {/* Hiển thị nút "Cài Ansible" khi chưa có phiên bản */}
                        {!ansibleStatus?.installed && (
                        <Button
                          onClick={handleSetupAnsibleSimple}
                          disabled={
                            isInstallingAnsible ||
                            isUninstallingAnsible ||
                            isCheckingAnsibleStatus ||
                            !!ansibleStatus?.error // Nếu Ansible đang ở trạng thái lỗi/offline thì không cho cài
                          }
                          size="sm"
                        >
                          {isInstallingAnsible ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              <span className="text-xs">Đang cài...</span>
                            </>
                          ) : (
                            <>
                              <Package className="h-3 w-3 mr-1" />
                              <span className="text-xs">Cài Ansible</span>
                            </>
                          )}
                        </Button>
                        )}
                        {/* Hiển thị nút "Gỡ Ansible" khi đã có phiên bản */}
                        {ansibleStatus?.installed && (
                          <Button
                            onClick={handleUninstallAnsibleSimple}
                            disabled={isInstallingAnsible || isUninstallingAnsible || isCheckingAnsibleStatus}
                            size="sm"
                            variant="destructive"
                          >
                            {isUninstallingAnsible ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                <span className="text-xs">Đang gỡ...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-3 w-3 mr-1" />
                                <span className="text-xs">Gỡ Ansible</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Phần tùy chọn: Xem cấu hình và Playbooks Kubespray */}
            {ansibleStatus?.installed && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tùy chọn</CardTitle>
                  <CardDescription>Xem cấu hình Ansible và quản lý playbooks Kubespray</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleUpdateAnsibleConfig}
                      disabled={isLoadingPlaybooks}
                      variant="outline"
                      className="flex-1"
                    >
                      {isLoadingPlaybooks ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Đang cập nhật...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Cập nhật cấu hình
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setOptionsModalTab("config");
                        setShowOptionsModal(true);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Cấu hình Ansible
                    </Button>
                    <Button
                      onClick={() => {
                        setOptionsModalTab("playbooks");
                        setShowOptionsModal(true);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      <FileCode className="h-4 w-4 mr-2" />
                      Playbooks Kubespray
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Options Modal - Hiển thị Cấu hình Ansible và Playbooks Kubespray */}
            {ansibleStatus?.installed && (
              <Dialog open={showOptionsModal} onOpenChange={setShowOptionsModal}>
                <DialogContent className="w-[75vw] h-[90vh] max-w-none max-h-none flex flex-col p-6 overflow-hidden">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Tùy chọn Ansible
                    </DialogTitle>
                    <DialogDescription>
                      Xem cấu hình Ansible và quản lý playbooks Kubespray
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-hidden flex flex-col mt-4">
                    {optionsModalTab === "config" && (
                      <div className="space-y-4 flex-1 overflow-auto">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-sm font-medium">Cấu hình Ansible</h3>
                            <p className="text-sm text-muted-foreground">
                              Xem và chỉnh sửa cấu hình Ansible (ansible.cfg, inventory, vars)
                            </p>
                          </div>
                          <Button
                            onClick={handleLoadAnsibleConfig}
                            disabled={isLoadingPlaybooks}
                            size="sm"
                            variant="outline"
                          >
                            {isLoadingPlaybooks ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Đang tải...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Tải cấu hình
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <Button
                              variant={optionsConfigTab === "cfg" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setOptionsConfigTab("cfg")}
                            >
                              ansible.cfg
                            </Button>
                            <Button
                              variant={optionsConfigTab === "inventory" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setOptionsConfigTab("inventory")}
                            >
                              inventory
                            </Button>
                            <Button
                              variant={optionsConfigTab === "vars" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setOptionsConfigTab("vars")}
                            >
                              group_vars/all.yml
                            </Button>
                          </div>

                          {optionsConfigTab === "cfg" && (
                            <div className="space-y-2">
                              <Label>ansible.cfg</Label>
                              <Textarea
                                value={ansibleCfg}
                                onChange={(e) => setAnsibleCfg(e.target.value)}
                                placeholder="Nội dung ansible.cfg..."
                              className="font-mono text-xs w-full"
                                rows={15}
                              />
                            </div>
                          )}

                          {optionsConfigTab === "inventory" && (
                            <div className="space-y-2">
                              <Label>inventory</Label>
                              <Textarea
                                value={ansibleInventory}
                                onChange={(e) => setAnsibleInventory(e.target.value)}
                                placeholder="Nội dung inventory..."
                              className="font-mono text-xs w-full"
                                rows={15}
                              />
                            </div>
                          )}

                          {optionsConfigTab === "vars" && (
                            <div className="space-y-2">
                              <Label>group_vars/all.yml</Label>
                              <Textarea
                                value={ansibleVars}
                                onChange={(e) => setAnsibleVars(e.target.value)}
                                placeholder="Nội dung group_vars/all.yml..."
                              className="font-mono text-xs w-full"
                                rows={15} 
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {optionsModalTab === "playbooks" && (
                      <div className="space-y-4 flex-1 overflow-auto">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-sm font-medium">Playbooks Kubespray</h3>
                            <p className="text-sm text-muted-foreground">
                              Xem, chỉnh sửa, xóa và thực thi các playbook của Kubespray
                            </p>
                          </div>
                          <Button
                            onClick={handleLoadKubesprayPlaybooks}
                            disabled={isLoadingPlaybooks}
                            size="sm"
                            variant="outline"
                          >
                            {isLoadingPlaybooks ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Đang tải...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Tải danh sách
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Danh sách playbooks */}
                          <div className="space-y-2">
                            <Label>Danh sách playbooks ({playbooks.length})</Label>
                            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                              {playbooks.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                  Chưa có playbook. Nhấn "Tải danh sách" để tải playbooks từ server.
                                </div>
                              ) : (
                                <div className="divide-y">
                                  {playbooks.map((playbook) => (
                                    <div
                                      key={playbook.name}
                                      className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                                        selectedPlaybook === playbook.name ? "bg-accent" : ""
                                      }`}
                                      onClick={() => handleSelectPlaybook(playbook.name)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="font-medium text-sm">{playbook.name}</div>
                                          {playbook.size && (
                                            <div className="text-xs text-muted-foreground">
                                              {(playbook.size / 1024).toFixed(2)} KB
                                            </div>
                                          )}
                                        </div>
                                        {selectedPlaybook === playbook.name && (
                                          <CheckCircle2 className="h-4 w-4 text-primary" />
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Editor và actions */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Nội dung playbook</Label>
                              {selectedPlaybook && (
                                <div className="flex gap-2">
                                  <Button
                                    onClick={handleExecutePlaybook}
                                    disabled={isExecutingPlaybook || !selectedPlaybook}
                                    size="sm"
                                    variant="default"
                                  >
                                    {isExecutingPlaybook ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Đang chạy...
                                      </>
                                    ) : (
                                      <>
                                        <PlayCircle className="h-3 w-3 mr-1" />
                                        Thực thi
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    onClick={handleDeletePlaybook}
                                    disabled={isDeletingPlaybook || !selectedPlaybook}
                                    size="sm"
                                    variant="destructive"
                                  >
                                    {isDeletingPlaybook ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Đang xóa...
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Xóa
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                            <Textarea
                              value={playbookContent}
                              onChange={(e) => setPlaybookContent(e.target.value)}
                              placeholder="Chọn một playbook từ danh sách bên trái..."
                              className="font-mono text-xs"
                              rows={15}
                            />
                            {selectedPlaybook && (
                              <div className="flex gap-2">
                                <Button
                                  onClick={handleSavePlaybook}
                                  disabled={isSavingPlaybook || !selectedPlaybook}
                                  size="sm"
                                >
                                  {isSavingPlaybook ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Đang lưu...
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="h-3 w-3 mr-1" />
                                      Lưu thay đổi
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}

                            {/* Execution logs */}
                            {isExecutingPlaybook && playbookExecutionLogs.length > 0 && (
                              <div className="space-y-2">
                                <Label>Log thực thi</Label>
                                <div
                                  ref={playbookExecutionLogRef}
                                  className="border rounded-lg p-3 bg-black text-green-400 font-mono text-xs max-h-[200px] overflow-y-auto"
                                >
                                  {playbookExecutionLogs.map((log, idx) => (
                                    <div key={idx}>{log}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                    <Button variant="outline" onClick={() => setShowOptionsModal(false)}>
                      Đóng
                    </Button>
                    {optionsModalTab === "config" && (
                      <Button
                        onClick={async () => {
                          if (!ansibleStatus?.controllerHost) {
                            toast.error("Không tìm thấy controller host.");
                            return;
                          }
                          try {
                            setIsSavingConfig(true);
                            backupConfig();
                            const result = await adminAPI.saveAnsibleConfig(
                              ansibleStatus.controllerHost,
                              ansibleCfg,
                              ansibleInventory,
                              ansibleVars,
                              initSudoPassword || undefined
                            );
                            if (result.success) {
                              toast.success("Đã lưu cấu hình");
                            } else {
                              throw new Error(result.error || "Lỗi khi lưu cấu hình");
                            }
                          } catch (error: any) {
                            toast.error(error.message || "Không thể lưu cấu hình");
                          } finally {
                            setIsSavingConfig(false);
                          }
                        }}
                        disabled={isSavingConfig}
                        variant="default"
                      >
                        {isSavingConfig ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Đang lưu...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Lưu cấu hình
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        )}
      </Card>

      {/* Phần 2: Cài đặt Kubernetes */}
      <Card className="border-2">
        <CardHeader>
          <button
            onClick={() => toggleSection("kubernetes")}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Network className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">Phần 2: Cài đặt Kubernetes Cluster</CardTitle>
                  {k8sTab3Completed && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Hoàn thành
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  Cài đặt Kubernetes trên các server có cluster_status=AVAILABLE và role=MASTER/WORKER
                </CardDescription>
              </div>
            </div>
            {expandedSection === "kubernetes" ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </CardHeader>
        {expandedSection === "kubernetes" && (
          <CardContent className="space-y-6">
            <Tabs
                value={k8sActiveTab}
                onValueChange={(value) => {
                  // TODO: TEST MODE - Bỏ ràng buộc để test
                  // if (value === "tab2" && !k8sTab1Completed) {
                  //   toast.warning("Phải hoàn thành Tab 1 trước");
                  //   return;
                  // }
                  // if (value === "tab3" && !k8sTab2Completed) {
                  //   toast.warning("Phải hoàn thành Tab 2 trước");
                  //   return;
                  // }
                  setK8sActiveTab(value);
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="tab1" className="flex items-center gap-2">
                    Tab 1: Chuẩn bị môi trường
                    {k8sTab1Completed && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </TabsTrigger>
                  <TabsTrigger
                    value="tab2"
                    className="flex items-center gap-2"
                  >
                    Tab 2: Triển khai cluster
                    {k8sTab2Completed && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Chuẩn bị môi trường */}
                <TabsContent value="tab1" className="space-y-4 mt-4">
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Network className="h-4 w-4 text-primary" />
                        Tab 1: Chuẩn bị môi trường
                      </CardTitle>
                      <CardDescription>
                        Cài đặt nhanh Kubernetes (Kubespray) trên các node khả dụng.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={handleInstallK8sCluster}
                          disabled={isInstallingK8sCluster || isUninstallingK8sCluster}
                          size="lg"
                          className="min-w-[200px]"
                        >
                          {isInstallingK8sCluster ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Đang cài Kubernetes...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Cài đặt Kubernetes
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleUninstallK8sCluster}
                          disabled={isInstallingK8sCluster || isUninstallingK8sCluster}
                          size="lg"
                          variant="destructive"
                          className="min-w-[200px]"
                        >
                          {isUninstallingK8sCluster ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Đang gỡ Kubernetes...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Gỡ cài đặt Kubernetes
                            </>
                          )}
                        </Button>
                        {k8sClusterInstallLogs.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {k8sClusterInstallLogs.length} dòng log
                          </Badge>
                        )}
                      </div>
                      {k8sClusterInstallLogs.length > 0 && (
                        <div className="border rounded-lg bg-gray-900 text-green-300 font-mono text-sm p-3 max-h-64 overflow-auto">
                          {k8sClusterInstallLogs.map((line, idx) => (
                            <div key={idx} className="whitespace-pre-wrap">
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 2: Triển khai cluster */}
                <TabsContent value="tab2" className="space-y-4 mt-4">
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="h-4 w-4 text-primary" />
                        Tab 2: Triển khai cluster
                      </CardTitle>
                      <CardDescription>
                        Thực thi nhanh các bước bổ sung sau khi Kubespray: addons, metrics server và Docker.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* 1 hàng 4 cột trên màn hình rộng, 1 cột trên mobile */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Cài K8s Addons */}
                        <Button
                          onClick={handleInstallK8sAddons}
                          disabled={isInstallingK8sAddons || isUninstallingK8sAddons}
                          size="lg"
                          className="w-full"
                        >
                          {isInstallingK8sAddons ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Đang cài Addons
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Cài K8s Addons
                            </>
                          )}
                        </Button>

                        {/* Gỡ K8s Addons */}
                        <Button
                          onClick={handleUninstallK8sAddons}
                          disabled={isInstallingK8sAddons || isUninstallingK8sAddons}
                          size="lg"
                          variant="destructive"
                          className="w-full"
                        >
                          {isUninstallingK8sAddons ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Đang gỡ Addons
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Gỡ K8s Addons
                            </>
                          )}
                        </Button>

                        {/* Cài Metrics Server */}
                        <Button
                          onClick={handleInstallMetricsServer}
                          disabled={isInstallingMetricsServer || isUninstallingMetricsServer}
                          size="lg"
                          className="w-full"
                        >
                          {isInstallingMetricsServer ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Đang cài Metrics
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Cài Metrics Server
                            </>
                          )}
                        </Button>

                        {/* Gỡ Metrics Server */}
                        <Button
                          onClick={handleUninstallMetricsServer}
                          disabled={isInstallingMetricsServer || isUninstallingMetricsServer}
                          size="lg"
                          variant="destructive"
                          className="w-full"
                        >
                          {isUninstallingMetricsServer ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Đang gỡ Metrics
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Gỡ Metrics Server
                            </>
                          )}
                        </Button>
                      </div>

                      {k8sTab2ApiLogs.length > 0 && (
                        <div className="border rounded-lg bg-gray-900 text-green-300 font-mono text-sm p-3 max-h-64 overflow-auto">
                          {k8sTab2ApiLogs.map((line, idx) => (
                            <div key={idx} className="whitespace-pre-wrap">
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

              </Tabs>
            
            
          </CardContent>
        )}
      </Card>

      {/* Phần 3: Cài đặt Docker */}
      <Card className="border-2">
        <CardHeader>
          <button
            onClick={() => toggleSection("docker")}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">Phần 3: Cài đặt Docker</CardTitle>
                  {dockerStatus?.installed && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Hoàn thành
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  Cài đặt Docker trên máy có role là DOCKER.
                </CardDescription>
              </div>
            </div>
            {expandedSection === "docker" ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </CardHeader>
        {expandedSection === "docker" && (
          <CardContent className="space-y-4">
            {/* Card hiển thị thông tin Docker */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Thông tin Docker</CardTitle>
              </CardHeader>
              <CardContent>
                {dockerStatus?.error && !dockerStatus.dockerHost ? (
                  <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">{dockerStatus.error}</p>
                    <p className="text-sm mt-1">Vui lòng thêm server với role DOCKER trong trang Servers</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Trạng thái */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground font-medium">Trạng thái</Label>
                      <div className="flex items-center gap-2 min-h-[24px]">
                        {isCheckingDockerStatus ? (
                          <>
                            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
                            <span className="font-medium text-sm">Đang kiểm tra...</span>
                          </>
                        ) : dockerStatus?.dockerHost ? (
                          <>
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="font-medium text-sm">Online</span>
                          </>
                        ) : dockerServers.length > 0 && dockerServers[0]?.status === "online" ? (
                          <>
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="font-medium text-sm">Online</span>
                          </>
                        ) : dockerServers.length > 0 ? (
                          <>
                            <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                            <span className="font-medium text-sm">Chưa kiểm tra</span>
                          </>
                        ) : (
                          <>
                            <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                            <span className="font-medium text-sm">Offline</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Máy Docker */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground font-medium">Máy Docker</Label>
                      <div className="font-medium text-sm min-h-[24px] flex items-center">
                        {isCheckingDockerStatus ? (
                          <span className="text-muted-foreground">Đang kiểm tra...</span>
                        ) : dockerStatus?.dockerHost ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="break-all">{dockerStatus.dockerHost}</span>
                            {dockerStatus.dockerRole && (
                              <Badge variant="outline" className="text-xs">
                                {dockerStatus.dockerRole}
                              </Badge>
                            )}
                          </div>
                        ) : dockerServers.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="break-all">{dockerServers[0]?.ipAddress || "-"}</span>
                            <Badge variant="outline" className="text-xs">
                              {dockerServers[0]?.role || "DOCKER"}
                            </Badge>
                          </div>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>

                  {/* Phiên bản Docker */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-medium">Phiên bản Docker</Label>
                    <div className="font-medium min-h-[24px] flex items-center">
                      {isCheckingDockerStatus ? (
                        <Badge variant="outline" className="text-xs">Đang kiểm tra...</Badge>
                      ) : dockerStatus ? (
                        dockerStatus.installed && dockerStatus.version ? (
                          <Badge variant="default" className="text-xs">{dockerStatus.version}</Badge>
                        ) : dockerStatus.installed ? (
                          <Badge variant="default" className="text-xs">Đã cài đặt</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Chưa cài đặt</Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-xs">Chưa kiểm tra</Badge>
                      )}
                    </div>
                  </div>

                  {/* Thao tác */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground font-medium">Thao tác</Label>
                    <div className="flex items-start gap-2 flex-wrap min-h-[24px]">
                      <Button
                        onClick={() => handleCheckDockerStatus(false)}
                        disabled={isCheckingDockerStatus || isInstallingDocker || isUninstallingDocker}
                        size="sm"
                        variant="outline"
                      >
                        {isCheckingDockerStatus ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            <span className="text-xs">Đang kiểm tra...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            <span className="text-xs">Kiểm tra trạng thái</span>
                          </>
                        )}
                      </Button>
                      {/* Hiển thị nút "Cài Docker" khi chưa cài đặt */}
                      {(!dockerStatus?.installed || dockerStatus === null) && (
                        <Button
                          onClick={handleInstallDocker}
                          disabled={isInstallingDocker || isUninstallingDocker || isCheckingDockerStatus}
                          size="sm"
                        >
                          {isInstallingDocker ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              <span className="text-xs">Đang cài...</span>
                            </>
                          ) : (
                            <>
                              <Package className="h-3 w-3 mr-1" />
                              <span className="text-xs">Cài Docker</span>
                            </>
                          )}
                        </Button>
                      )}
                      {/* Hiển thị nút "Gỡ Docker" khi đã cài đặt */}
                      {dockerStatus?.installed && (
                        <Button
                          onClick={handleUninstallDocker}
                          disabled={isInstallingDocker || isUninstallingDocker || isCheckingDockerStatus}
                          size="sm"
                          variant="destructive"
                        >
                          {isUninstallingDocker ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              <span className="text-xs">Đang gỡ...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3 mr-1" />
                              <span className="text-xs">Gỡ Docker</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        )}
      </Card>

      {/* Modals */}
      {/* Info Modal - Lưu ý */}
      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Thông tin cài đặt Ansible
            </DialogTitle>
            <DialogDescription>
              Các lưu ý quan trọng khi cài đặt và sử dụng Ansible
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-2">Lưu ý quan trọng:</p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>Ansible sẽ được cài đặt trên máy Ansible duy nhất trong hệ thống</li>
                    <li>Quá trình cài đặt sẽ tự động cấu hình Python, pip và các dependencies cần thiết</li>
                    <li>Sau khi cài đặt xong, Ansible có thể được sử dụng để quản lý các server khác</li>
                    <li>Máy Ansible phải đang online để có thể cài đặt</li>
                    <li>Đảm bảo máy Ansible có quyền truy cập SSH đến các máy khác trong cluster</li>
                    <li>Khuyến nghị cấu hình SSH key authentication để tránh nhập password nhiều lần</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={() => setShowInfoModal(false)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step Execution Modal - Hiển thị tiến trình thực thi từng bước */}
      <Dialog 
        open={showStepExecutionModal} 
        onOpenChange={(open) => {
          if (!open && currentExecutingStep?.status !== "running") {
            setShowStepExecutionModal(false);
            setCurrentExecutingStep(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentExecutingStep?.status === "running" ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : currentExecutingStep?.status === "completed" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : currentExecutingStep?.status === "error" ? (
                <XCircle className="h-5 w-5 text-red-500" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              {currentExecutingStep?.stepLabel || "Đang thực thi"}
            </DialogTitle>
            <DialogDescription>
              Playbook: {currentExecutingStep?.playbookFilename || "N/A"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col mt-4">
            {/* Status Badge */}
            <div className="mb-4">
              {currentExecutingStep?.status === "running" && (
                <Badge variant="default" className="bg-blue-500">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Đang thực thi...
                </Badge>
              )}
              {currentExecutingStep?.status === "completed" && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Hoàn thành
                </Badge>
              )}
              {currentExecutingStep?.status === "error" && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Thất bại
                </Badge>
              )}
            </div>

            {/* Logs Container */}
            <div 
              ref={stepExecutionLogRef}
              className="flex-1 border rounded-lg bg-gray-900 text-green-400 p-4 overflow-auto font-mono text-sm"
            >
              {currentExecutingStep?.logs.length === 0 ? (
                <div className="text-gray-500">Đang khởi tạo...</div>
              ) : (
                currentExecutingStep?.logs.map((log, index) => {
                  const isError = log.includes("❌") || log.toLowerCase().includes("lỗi") || log.toLowerCase().includes("error") || log.toLowerCase().includes("failed");
                  const isSuccess = log.includes("✅") || log.includes("🎉") || log.includes("Hoàn tất") || log.toLowerCase().includes("success");
                  const isStep = log.includes("▶️") || log.includes("Bắt đầu");
                  
                  return (
                    <div
                      key={index}
                      className={`mb-1 whitespace-pre-wrap break-words ${
                        isError
                          ? "text-red-400"
                          : isSuccess
                          ? "text-green-400"
                          : isStep
                          ? "text-yellow-400 font-semibold"
                          : "text-gray-300"
                      }`}
                    >
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            {currentExecutingStep?.status === "running" ? (
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang thực thi...
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  setShowStepExecutionModal(false);
                  setCurrentExecutingStep(null);
                }}
              >
                Đóng
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Init Quickly Ansible Modal */}
      <Dialog 
        open={showInitQuicklyModal} 
        onOpenChange={(open) => {
          if (!open && !isInitializing) {
            setShowInitQuicklyModal(false);
            // Reset steps khi đóng modal
            setInitQuicklySteps([
              { id: 1, label: "Bước 1: Tạo cấu trúc thư mục", status: "pending" },
              { id: 2, label: "Bước 2: Ghi cấu hình mặc định", status: "pending" },
              { id: 3, label: "Bước 3: Phân phối SSH key", status: "pending" },
            ]);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Khởi tạo nhanh Ansible
            </DialogTitle>
            <DialogDescription>
              Tự động thực hiện 3 bước: Tạo cấu trúc, Ghi cấu hình, và Phân phối SSH key
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Loading Animation */}
            {isInitializing && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Đang khởi tạo Ansible...</p>
              </div>
            )}

            {/* Steps Status */}
            <div className="space-y-3">
              {initQuicklySteps.map((step, index) => {
                const isRunning = step.status === "running";
                const isCompleted = step.status === "completed";
                const isError = step.status === "error";
                const isPending = step.status === "pending";

                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      isRunning
                        ? "bg-primary/10 border-primary/20"
                        : isCompleted
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : isError
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                        : "bg-muted/50 border-border"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isRunning ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : isError ? (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          isRunning
                            ? "text-primary"
                            : isCompleted
                            ? "text-green-700 dark:text-green-300"
                            : isError
                            ? "text-red-700 dark:text-red-300"
                            : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                      {isError && step.errorMessage && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold">
                          {step.errorMessage}
                        </p>
                      )}
                      {isRunning && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Đang thực hiện...
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                    setShowInitQuicklyModal(false);
                }}
              >
                Đóng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Init Ansible Modal */}
      <Dialog open={showInitModal} onOpenChange={setShowInitModal}>
        <DialogContent className="w-[75vw] h-[90vh] max-w-none max-h-none flex flex-col p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Khởi tạo Ansible
            </DialogTitle>
            <DialogDescription>
              Tạo cấu trúc, ghi cấu hình mặc định, phân phối SSH key từ controller đến các máy trong cụm, và ping nodes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 flex-1 flex flex-col min-h-0">
            {/* Log Console */}
            <div className="flex-1 flex flex-col min-h-0 border rounded-lg overflow-hidden bg-gray-900">
              <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-xs text-gray-300 font-mono">Kết quả thực hiện</span>
                  {initLogs.length > 0 && (
                    <span className="text-xs text-gray-400">({initLogs.length} dòng)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {initLogs.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyInitLogs}
                        className="h-7 px-2 text-xs text-gray-300 hover:text-white"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearInitLogs}
                        disabled={isInitializing}
                        className="h-7 px-2 text-xs text-gray-300 hover:text-white"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div
                ref={initLogRef}
                className="flex-1 overflow-y-auto p-4 font-mono text-sm text-green-400"
                style={{
                  minHeight: "300px",
                  maxHeight: "500px",
                }}
              >
                {initLogs.length === 0 ? (
                  <div className="text-gray-500 italic">
                    Nhấn "Bắt đầu khởi tạo" để xem log...
                  </div>
                ) : (
                  <div className="space-y-1">
                    {initLogs.map((log, index) => {
                      // Determine log type for styling
                      let logClass = "text-gray-300";
                      if (log.includes("✓") || log.includes("✅") || log.includes("🎉")) {
                        logClass = "text-green-400";
                      } else if (log.includes("❌") || log.includes("Lỗi")) {
                        logClass = "text-red-400";
                      } else if (log.includes("📋") || log.includes("Bước")) {
                        logClass = "text-yellow-400 font-semibold";
                      } else if (log.includes("→")) {
                        logClass = "text-blue-400";
                      }

                      return (
                        <div key={index} className={logClass}>
                          {log || "\u00A0"}
                        </div>
                      );
                    })}
                    {isInitializing && (
                      <div className="text-yellow-400 animate-pulse">
                        <span className="inline-block animate-bounce">▋</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>



            <div className="pt-2 border-t space-y-3">
              {/* Action Buttons */}
              <div className="flex justify-end gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                      setShowInitModal(false);
                      clearInitLogs();
                  }}
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Config Ansible Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="w-[75vw] h-[90vh] max-w-none max-h-none flex flex-col p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cấu hình Ansible
            </DialogTitle>
            <DialogDescription>
              Xem và chỉnh sửa ansible.cfg, inventory (hosts), và group_vars/all.yml trên controller.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Tabs defaultValue="ansible-cfg" className="w-full">
              <TabsList>
                <TabsTrigger value="ansible-cfg">ansible.cfg</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="variables">Variables</TabsTrigger>
              </TabsList>
              <TabsContent value="ansible-cfg" className="mt-4">
                <div className="space-y-2">
                  <Label>ansible.cfg</Label>
                  <Textarea
                    value={ansibleCfg}
                    onChange={(e) => setAnsibleCfg(e.target.value)}
                    rows={15}
                    className="font-mono text-sm"
                    placeholder="[defaults]..."
                  />
                </div>
              </TabsContent>
              <TabsContent value="inventory" className="mt-4">
                <div className="space-y-2">
                  <Label>Inventory (hosts)</Label>
                  <Textarea
                    value={ansibleInventory}
                    onChange={(e) => setAnsibleInventory(e.target.value)}
                    rows={15}
                    className="font-mono text-sm"
                    placeholder="[master]..."
                  />

                </div>
              </TabsContent>
              <TabsContent value="variables" className="mt-4">
                <div className="space-y-2">
                  <Label>Variables (group_vars/all.yml)</Label>
                  <Textarea
                    value={ansibleVars}
                    onChange={(e) => setAnsibleVars(e.target.value)}
                    rows={15}
                    className="font-mono text-sm"
                    placeholder="key: value..."
                  />
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex justify-end items-center pt-4 border-t">
                <Button variant="outline" onClick={() => setShowConfigModal(false)}>
                Đóng
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Playbook & K8s Modal */}
      <Dialog open={showPlaybookModal} onOpenChange={setShowPlaybookModal}>
        <DialogContent className="w-[75vw] h-[90vh] max-w-none max-h-none flex flex-col p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Quản lý playbook & cài đặt K8s
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4 flex-1 flex flex-col min-h-0">
            {/* Action Buttons and Search */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="default"
                  className="px-3 py-2 h-9 text-sm"
                  onClick={handleCreatePlaybook}
                  disabled={!ansibleStatus?.installed}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Tạo
                </Button>
                <Button
                  variant="default"
                  size="default"
                  className="px-3 py-2 h-9 text-sm"
                  onClick={handleCreatePlaybookFromTemplate}
                  disabled={!ansibleStatus?.installed || !playbookTemplate || isSavingPlaybook}
                >
                  {isSavingPlaybook ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-1" />
                      Tạo từ template
                    </>
                  )}
                </Button>
                <label className="cursor-pointer">
                  <Button
                    variant="outline"
                    size="default"
                    className="px-3 py-2 h-9 text-sm"
                    type="button"
                    disabled={!ansibleStatus?.installed || isUploadingPlaybook}
                    onClick={() => document.getElementById("upload-playbook-input")?.click()}
                  >
                    {isUploadingPlaybook ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Đang tải...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" />
                        Tải lên
                      </>
                    )}
                  </Button>
                  <input
                    id="upload-playbook-input"
                    type="file"
                    accept=".yml,.yaml"
                    onChange={handleUploadPlaybook}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3 flex-1 max-w-[270px]">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Tìm playbook..."
                  value={playbookSearchQuery}
                  onChange={(e) => setPlaybookSearchQuery(e.target.value)}
                  className="h-10 text-base"
                />
              </div>
            </div>

            {/* Filename and Template */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tên file playbook</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={playbookFilename}
                    onChange={(e) => setPlaybookFilename(e.target.value)}
                    placeholder="example"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.yml</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Template K8s (tùy chọn)</Label>
                <select 
                  value={playbookTemplate} 
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">-- Chọn template K8s --</option>
                  {playbookTemplateCatalog.map((category) => (
                    <optgroup key={category.id} label={category.label}>
                      {category.templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

              </div>
            </div>

            {/* Playbook List and Content */}
            <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
              {/* Playbook List */}
              <div className="col-span-12 md:col-span-4 flex flex-col min-h-0">
                <Label className="mb-2">Danh sách playbook</Label>
                <div className="border rounded-lg overflow-y-auto flex-1 bg-muted/30 min-h-0">
                  {isLoadingPlaybooks ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Đang tải playbook...
                    </div>
                  ) : filteredPlaybooks.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {playbookSearchQuery ? "Không tìm thấy playbook" : "Chưa có playbook nào"}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredPlaybooks.map((playbook) => (
                        <button
                          key={playbook.name}
                          onClick={() => handleSelectPlaybook(playbook.name)}
                          className={`w-full p-3 text-left hover:bg-muted transition-colors ${selectedPlaybook === playbook.name
                            ? "bg-primary/10 border-l-2 border-primary"
                            : ""
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{playbook.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Playbook Content / Execution Status */}
              <div className="col-span-12 md:col-span-8 flex flex-col min-h-0">
                {isExecutingPlaybook || playbookExecutionLogs.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Kết quả thực thi playbook</Label>
                      {!isExecutingPlaybook && playbookExecutionLogs.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPlaybookExecutionLogs([]);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Xem nội dung
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-lg overflow-hidden flex-1 min-h-0 bg-gray-900">
                      <div
                        ref={playbookExecutionLogRef}
                        className="flex-1 overflow-y-auto p-4 font-mono text-sm h-full"
                      >
                        {playbookExecutionLogs.length === 0 ? (
                          <div className="text-gray-500 italic">
                            Đang khởi động thực thi...
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {playbookExecutionLogs.map((log, index) => {
                              // Determine log type for styling
                              let logClass = "text-gray-300";
                              if (log.includes("✓") || log.includes("✅") || log.includes("🎉") || log.includes("ok:") || log.includes("changed:")) {
                                logClass = "text-green-400";
                              } else if (log.includes("❌") || log.includes("Lỗi") || log.includes("failed:")) {
                                logClass = "text-red-400";
                              } else if (log.includes("📋") || log.includes("PLAY") || log.includes("TASK") || log.includes("RECAP")) {
                                logClass = "text-yellow-400 font-semibold";
                              } else if (log.includes("→") || log.includes("Đang")) {
                                logClass = "text-blue-400";
                              }

                              return (
                                <div key={index} className={logClass}>
                                  {log || "\u00A0"}
                                </div>
                              );
                            })}
                            {isExecutingPlaybook && (
                              <div className="text-yellow-400 animate-pulse">
                                <span className="inline-block animate-bounce">▋</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Label className="mb-2">Nội dung playbook</Label>
                    <div className="border rounded-lg overflow-hidden flex-1 min-h-0">
                      <div className="overflow-y-auto h-full">
                        <Textarea
                          value={playbookContent}
                          onChange={(e) => setPlaybookContent(e.target.value)}
                          className="font-mono text-sm w-full h-full resize-none"
                          placeholder="---&#10;- name: Example&#10;  hosts: all&#10;  tasks:&#10;    - debug: msg=&quot;hello&quot;&#10;"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div>
                {selectedPlaybook && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeletePlaybook}
                    disabled={isDeletingPlaybook || !ansibleStatus?.installed}
                  >
                    {isDeletingPlaybook ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Đang xóa...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Xóa
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPlaybookModal(false)}>
                  Đóng
                </Button>
                <Button
                  onClick={handleSavePlaybook}
                  disabled={isSavingPlaybook || !ansibleStatus?.installed}
                >
                  {isSavingPlaybook ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Lưu
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sudo Password Modal */}
      <Dialog
        open={showSudoPasswordModal}
        onOpenChange={(open) => {
          // Chỉ cho phép đóng khi không đang xử lý
          if (!open && !isInstallingAnsible && !isReinstallingAnsible && !isUninstallingAnsible) {
            setShowSudoPasswordModal(false);
            setSudoPasswords({});
            setPendingAnsibleAction(null);
            setPendingControllerHost(null);
            setPendingServerId(null);
            setAnsibleOperationSteps([]);
            setCurrentStepIndex(-1);
            setServerAuthStatus(null);
          }
        }}
      >
        <DialogContent className="w-[75vw] h-[90vh] max-w-none max-h-none flex flex-col p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingAnsibleAction === "install" && (
                <>
                  <Package className="h-5 w-5" />
                  Cài đặt Ansible
                </>
              )}
              {pendingAnsibleAction === "reinstall" && (
                <>
                  <RotateCcw className="h-5 w-5" />
                  Cài đặt lại Ansible
                </>
              )}
              {pendingAnsibleAction === "uninstall" && (
                <>
                  <Trash2 className="h-5 w-5" />
                  Gỡ Ansible
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {pendingControllerHost && (
                <span>Controller: <span className="font-mono">{pendingControllerHost}</span></span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-3 mt-2 min-h-0">
            {/* Password input section - chỉ hiển thị khi chưa bắt đầu và cần password */}
            {!isInstallingAnsible && !isReinstallingAnsible && !isUninstallingAnsible && (
              <div className="border-b pb-3 flex-shrink-0">
                {pendingControllerHost && (
                  <div className="space-y-2">
                    {/* Auth status check - chỉ hiển thị khi đang kiểm tra hoặc cần password */}
                    {isCheckingAuthStatus ? (
                      <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Đang kiểm tra...</span>
                      </div>
                    ) : serverAuthStatus?.needsPassword ? (
                      <div className="p-2.5 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                              Cần sudo password
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Chỉ hiển thị password input khi cần password */}
                    {serverAuthStatus?.needsPassword && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="sudo-ansible" className="text-sm whitespace-nowrap">Password:</Label>
                        <Input
                          id="sudo-ansible"
                          type="password"
                          placeholder="Nhập sudo password"
                          value={sudoPasswords[pendingControllerHost] || ""}
                          onChange={(e) =>
                            setSudoPasswords((prev) => ({
                              ...prev,
                              [pendingControllerHost]: e.target.value,
                            }))
                          }
                          className="flex-1"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Steps section - thay thế console log */}
            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-background min-h-0">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${(isInstallingAnsible || isReinstallingAnsible || isUninstallingAnsible)
                    ? "bg-green-500 animate-pulse"
                    : "bg-gray-400"
                    }`}></div>
                  <span className="text-sm font-semibold">
                    {pendingAnsibleAction === "install" && "Cài đặt Ansible"}
                    {pendingAnsibleAction === "reinstall" && "Cài đặt lại Ansible"}
                    {pendingAnsibleAction === "uninstall" && "Gỡ Ansible"}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                {ansibleOperationSteps.length === 0 ? (
                  <div className="text-muted-foreground italic flex flex-col items-center justify-center h-full gap-4">
                    <Info className="h-8 w-8 text-muted-foreground/50" />
                    <p>Nhấn 'Xác nhận' để bắt đầu...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ansibleOperationSteps.map((step, index) => {
                      const isRunning = step.status === "running";
                      const isCompleted = step.status === "completed";
                      const isError = step.status === "error";

                      return (
                        <div
                          key={step.id}
                          className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${isRunning
                            ? "bg-primary/10 border border-primary/20"
                            : isCompleted
                              ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                              : isError
                                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                                : "bg-muted/50 border border-border"
                            }`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {isRunning ? (
                              <Loader2 className="h-5 w-5 text-primary animate-spin" />
                            ) : isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : isError ? (
                              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${isRunning
                                ? "text-primary"
                                : isCompleted
                                  ? "text-green-700 dark:text-green-300"
                                  : isError
                                    ? "text-red-700 dark:text-red-300"
                                    : "text-muted-foreground"
                                }`}
                            >
                              {step.label}
                            </p>
                            {isRunning && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Đang xử lý...
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t mt-4">
            <div className="flex flex-col gap-1">
              {/* Auth status - hiển thị "Không cần password" ở footer */}
              {!isInstallingAnsible && !isReinstallingAnsible && !isUninstallingAnsible &&
                serverAuthStatus && !serverAuthStatus.needsPassword && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span className="text-green-700 dark:text-green-300 font-medium">
                      Không cần password
                    </span>
                  </div>
                )}
              {/* Status messages */}
              <div className="text-sm text-muted-foreground">
                {(isInstallingAnsible || isReinstallingAnsible || isUninstallingAnsible) && (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang xử lý, vui lòng đợi...
                  </span>
                )}
                {!isInstallingAnsible && !isReinstallingAnsible && !isUninstallingAnsible &&
                  ansibleOperationSteps.length > 0 &&
                  ansibleOperationSteps.every(s => s.status === "completed") && (
                    <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Hoàn tất!
                    </span>
                  )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSudoPasswordModal(false);
                  setSudoPasswords({});
                  setPendingAnsibleAction(null);
                  setPendingControllerHost(null);
                  setPendingServerId(null);
                  setAnsibleOperationSteps([]);
                  setCurrentStepIndex(-1);
                  setServerAuthStatus(null);
                }}
                disabled={
                  isInstallingAnsible ||
                  isReinstallingAnsible ||
                  isUninstallingAnsible
                }
              >
                {ansibleOperationSteps.length > 0 &&
                  ansibleOperationSteps.every(s => s.status === "completed")
                  ? "Đóng"
                  : "Hủy"}
              </Button>
              {!isInstallingAnsible && !isReinstallingAnsible && !isUninstallingAnsible && (
                <>
                  {/* Hiển thị nút "Xác nhận" khi chưa bắt đầu - Removed */}
                  {ansibleOperationSteps.length > 0 &&
                    ansibleOperationSteps.every(s => s.status === "completed") && (
                    /* Hiển thị nút "Đóng" khi đã hoàn tất */
                    <Button
                      onClick={() => {
                        setShowSudoPasswordModal(false);
                        setSudoPasswords({});
                        setPendingAnsibleAction(null);
                        setPendingControllerHost(null);
                        setPendingServerId(null);
                        setAnsibleOperationSteps([]);
                        setCurrentStepIndex(-1);
                        setServerAuthStatus(null);
                      }}
                    >
                      Hoàn tất
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal xác nhận cho Tùy chọn khác */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Xác nhận thực hiện
            </DialogTitle>
            <DialogDescription className="pt-2">
              Bạn có chắc chắn muốn thực hiện hành động này?
            </DialogDescription>
          </DialogHeader>
          {pendingAction && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">{pendingAction.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">{pendingAction.description}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>Hành động này sẽ được thực thi ngay sau khi bạn xác nhận.</span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCancelAction}>
              Hủy
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={!pendingAction}
            >
              Xác nhận
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Install/Uninstall Modal */}
      <Dialog open={showInstallModal} onOpenChange={(open) => !open && handleCloseInstallModal()}>
        <DialogContent className="w-[75vw] h-[90vh] max-w-none max-h-none flex flex-col p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {installModalAction?.type === "install" ? (
                <Download className="h-5 w-5 text-green-600" />
              ) : (
                <Trash2 className="h-5 w-5 text-red-600" />
              )}
              {installModalAction?.title || "Thực thi thao tác"}
            </DialogTitle>
            <DialogDescription>
              Xác nhận và theo dõi quá trình thực thi
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
            {/* Horizontal Stepper */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                {installModalSteps.map((step, index) => {
                  const isLast = index === installModalSteps.length - 1;
                  const isCompleted = step.status === "completed";
                  const isActive = step.status === "active";
                  const isError = step.status === "error";
                  const stepNumber = index + 1;

                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      {/* Step content */}
                      <div className="flex flex-col items-center flex-1">
                        {/* Step icon/number */}
                        <div
                          className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors mb-1.5 ${
                            isCompleted
                              ? "bg-green-500 border-green-500 text-white"
                              : isActive
                              ? "bg-primary border-primary text-primary-foreground"
                              : isError
                              ? "bg-red-500 border-red-500 text-white"
                              : "bg-muted border-gray-300 dark:border-gray-600 text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isError ? (
                            <XCircle className="w-4 h-4" />
                          ) : isActive ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <span className="text-xs font-semibold">{stepNumber}</span>
                          )}
                        </div>
                        {/* Step label */}
                        <div
                          className={`text-xs font-medium mb-0.5 text-center ${
                            isActive
                              ? "text-primary"
                              : isCompleted
                              ? "text-green-700 dark:text-green-400"
                              : isError
                              ? "text-red-700 dark:text-red-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </div>
                        {/* Step description */}
                        {step.description && (
                          <div className="text-[10px] text-muted-foreground text-center max-w-[160px] leading-tight">
                            {step.description}
                          </div>
                        )}
                      </div>
                      {/* Connector line */}
                      {!isLast && (
                        <div
                          className={`flex-1 h-0.5 mx-1.5 ${
                            isCompleted ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Logs */}
            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b bg-muted/50">
                <Label className="text-sm font-medium">Log thực thi</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const logText = installModalLogs.join("\n");
                    navigator.clipboard.writeText(logText);
                    toast.success("Đã sao chép log vào clipboard");
                  }}
                  disabled={installModalLogs.length === 0}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Sao chép
                </Button>
              </div>
              <div
                ref={installModalLogRef}
                className="flex-1 overflow-y-auto p-4 bg-black text-green-400 font-mono text-sm"
                style={{ minHeight: "300px" }}
              >
                {installModalLogs.length === 0 ? (
                  <div className="text-muted-foreground">Chờ xác nhận để bắt đầu...</div>
                ) : (
                  installModalLogs.map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap break-words">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer: Kiểm tra quyền truy cập và Action Buttons */}
          <div className={`flex ${installModalAction?.url === "/install/setup-ansible" && installModalSteps[0]?.status === "pending" && (isCheckingInstallModalAuth || installModalAuthStatus?.needsPassword) ? "justify-between" : "justify-end"} items-start gap-4 pt-4 border-t`}>
            {/* Kiểm tra quyền truy cập - Bên trái - CHỈ hiển thị khi đang kiểm tra HOẶC CẦN password */}
            {installModalAction?.url === "/install/setup-ansible" && 
             installModalSteps[0]?.status === "pending" && 
             (isCheckingInstallModalAuth || installModalAuthStatus?.needsPassword) && (
              <div className="flex-1 min-w-0">
                <div className="space-y-2">
                  {isCheckingInstallModalAuth ? (
                    <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Đang kiểm tra sudo NOPASSWD...</span>
                    </div>
                  ) : installModalAuthStatus?.needsPassword ? (
                    <div className="space-y-2">
                      <div className="p-2 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                              Cần sudo password
                            </p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                              Server chưa được cấu hình sudo NOPASSWD
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="install-modal-password" className="text-sm whitespace-nowrap">
                          Sudo Password:
                        </Label>
                        <Input
                          id="install-modal-password"
                          type="password"
                          placeholder="Nhập sudo password"
                          value={installModalPassword}
                          onChange={(e) => setInstallModalPassword(e.target.value)}
                          className="flex-1 max-w-[200px]"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Action Buttons - Bên phải */}
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                onClick={handleCloseInstallModal}
                disabled={installModalSteps.some((s) => s.status === "active")}
              >
                {installModalSteps.some((s) => s.status === "active") ? "Đang xử lý..." : "Đóng"}
              </Button>
              {installModalSteps[0]?.status === "pending" && (
                <Button
                  onClick={handleConfirmInstallAction}
                  disabled={
                    !installModalAction || 
                    isCheckingInstallModalAuth ||
                    (installModalAction?.url === "/install/setup-ansible" && 
                     installModalAuthStatus?.needsPassword && 
                     !installModalPassword.trim())
                  }
                  variant={installModalAction?.type === "uninstall" ? "destructive" : "default"}
                >
                  {installModalAction?.type === "install" ? (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Xác nhận cài đặt
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Xác nhận gỡ cài đặt
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

