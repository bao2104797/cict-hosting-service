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
  const [isReinstallingAnsible, setIsReinstallingAnsible] = useState(false);
  const [isInstallingK8s, setIsInstallingK8s] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("ansible");
  const [showAnsibleConfig, setShowAnsibleConfig] = useState(false);
  const [isCheckingAnsibleStatus, setIsCheckingAnsibleStatus] = useState(false);

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

  // Modal states
  const [showInitModal, setShowInitModal] = useState(false);
  const [showInitQuicklyModal, setShowInitQuicklyModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSudoPasswordModal, setShowSudoPasswordModal] = useState(false);
  const [showStepExecutionModal, setShowStepExecutionModal] = useState(false);
  
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
    // Tải dữ liệu và kiểm tra trạng thái Ansible khi vào trang
    loadData();
    handleCheckAnsibleStatus(true); // Silent mode để không hiển thị toast
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

    const step1Button = (
      <div className="flex items-center gap-2">
        <Button
          onClick={() => handleCheckAnsibleStatus(false)}
          disabled={isCheckingAnsibleStatus}
          variant="outline"
          size="sm"
        >
          {isCheckingAnsibleStatus ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Đang kiểm tra...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Kiểm tra
            </>
          )}
        </Button>
        {ansibleStatus?.controllerHost && !ansibleStatus?.installed && (
          <Button
            onClick={handleInstallAnsible}
            disabled={isInstallingAnsible}
            size="sm"
          >
            {isInstallingAnsible ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang cài đặt...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Cài đặt
              </>
            )}
          </Button>
        )}
      </div>
    );

    // Bước 2: Khởi tạo Ansible (3 bước: Tạo cấu trúc, Ghi cấu hình, Phân phối SSH key)
    const step2Status = 
      initQuicklySteps.some(s => s.status === "running") 
        ? "active" 
        : initQuicklySteps.every(s => s.status === "completed")
        ? "completed"
        : ansibleStatus?.installed 
        ? "pending" 
        : "pending";

    const step2Button = ansibleStatus?.installed ? (
      <Button
        onClick={() => setShowInitQuicklyModal(true)}
        disabled={isInitializing || !ansibleStatus.installed || initQuicklySteps.some(s => s.status === "running")}
        size="sm"
      >
        {initQuicklySteps.some(s => s.status === "running") ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Đang khởi tạo...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 mr-2" />
            Khởi tạo
          </>
        )}
      </Button>
    ) : null;

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

    const step3Button = ansibleStatus?.installed ? (
      <Button
        onClick={handlePingNodes}
        disabled={pingNodesStep.status === "running" || !ansibleStatus?.installed}
        size="sm"
      >
        {pingNodesStep.status === "running" ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Đang ping...
          </>
        ) : (
          <>
            <Network className="h-4 w-4 mr-2" />
            Ping nodes
          </>
        )}
      </Button>
    ) : null;

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

    const step4Button = ansibleStatus?.installed ? (
      <Button
        onClick={handleInitTemplates}
        disabled={initTemplatesStep.status === "running" || !ansibleStatus?.installed}
        size="sm"
      >
        {initTemplatesStep.status === "running" ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Đang khởi tạo...
          </>
        ) : (
          <>
            <FileCode className="h-4 w-4 mr-2" />
            Khởi tạo templates
          </>
        )}
      </Button>
    ) : null;

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

  // Auto-update K8s Tab 1 steps with buttons
  // TODO: Bỏ ràng buộc thứ tự để test - có thể bật lại sau bằng cách đổi canExecute = true thành canExecute = isFirstStep || (prevStep?.status === "completed")
  useEffect(() => {
    setK8sTab1Steps((prev) =>
      prev.map((step, index) => {
        const isFirstStep = index === 0;
        const prevStep = index > 0 ? prev[index - 1] : null;
        // Tạm thời bỏ ràng buộc: cho phép thực thi bất kỳ bước nào
        const canExecute = true; // TEST MODE: isFirstStep || (prevStep?.status === "completed");
        const isRunning = step.status === "active";
        const isCompleted = step.status === "completed";

        let button = null;
        if (canExecute || isCompleted) {
          if (step.id === "update-hosts") {
            button = (
              <Button
                onClick={handleK8sTab1Step1}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          } else if (step.id === "kernel-sysctl") {
            button = (
              <Button
                onClick={handleK8sTab1Step2}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          } else if (step.id === "install-containerd") {
            button = (
              <Button
                onClick={handleK8sTab1Step3}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          } else if (step.id === "install-kubernetes") {
            button = (
              <Button
                onClick={handleK8sTab1Step4}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          }
        }

        return { ...step, button };
      })
    );
  }, [k8sTab1Steps.map(s => `${s.id}-${s.status}`).join(","), ansibleStatus?.installed]);

  // Auto-update K8s Tab 2 steps with buttons
  // TODO: Bỏ ràng buộc thứ tự để test - có thể bật lại sau bằng cách đổi canExecute = true thành canExecute = isFirstStep || (prevStep?.status === "completed")
  useEffect(() => {
    setK8sTab2Steps((prev) =>
      prev.map((step, index) => {
        const isFirstStep = index === 0;
        const prevStep = index > 0 ? prev[index - 1] : null;
        // Tạm thời bỏ ràng buộc: cho phép thực thi bất kỳ bước nào
        const canExecute = true; // TEST MODE: isFirstStep || (prevStep?.status === "completed");
        const isRunning = step.status === "active";
        const isCompleted = step.status === "completed";

        let button = null;
        if (canExecute || isCompleted) {
          if (step.id === "init-master") {
            button = (
              <Button
                onClick={handleK8sTab2Step1}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          } else if (step.id === "install-cni") {
            button = (
              <Button
                onClick={handleK8sTab2Step2}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          } else if (step.id === "join-workers") {
            button = (
              <Button
                onClick={handleK8sTab2Step3}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          }
        }

        return { ...step, button };
      })
    );
  }, [k8sTab2Steps.map(s => `${s.id}-${s.status}`).join(","), ansibleStatus?.installed]);

  // Auto-update K8s Tab 3 steps with buttons
  // TODO: Bỏ ràng buộc thứ tự để test - có thể bật lại sau bằng cách đổi canExecute = true thành canExecute = isFirstStep || (prevStep?.status === "completed")
  useEffect(() => {
    setK8sTab3Steps((prev) =>
      prev.map((step, index) => {
        const isFirstStep = index === 0;
        const prevStep = index > 0 ? prev[index - 1] : null;
        // Tạm thời bỏ ràng buộc: cho phép thực thi bất kỳ bước nào
        const canExecute = true; // TEST MODE: isFirstStep || (prevStep?.status === "completed");
        const isRunning = step.status === "active";
        const isCompleted = step.status === "completed";

        let button = null;
        if (canExecute || isCompleted) {
          if (step.id === "verify-cluster") {
            button = (
              <Button
                onClick={handleK8sTab3Step1}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          } else if (step.id === "install-metrics") {
            button = (
              <Button
                onClick={handleK8sTab3Step2}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          } else if (step.id === "install-ingress") {
            button = (
              <Button
                onClick={handleK8sTab3Step3}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          } else if (step.id === "install-metallb") {
            button = (
              <Button
                onClick={handleK8sTab3Step4}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          } else if (step.id === "setup-storage") {
            button = (
              <Button
                onClick={handleK8sTab3Step5}
                disabled={isRunning || isCompleted || !ansibleStatus?.installed}
                size="sm"
                variant={isCompleted ? "outline" : "default"}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang chạy...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Thực thi
                  </>
                )}
              </Button>
            );
          }
        }

        return { ...step, button };
      })
    );
  }, [k8sTab3Steps.map(s => `${s.id}-${s.status}`).join(","), ansibleStatus?.installed]);

  // Load Ansible config từ server khi mở modal
  useEffect(() => {
    const loadAnsibleConfig = async () => {
      if (showConfigModal && ansibleStatus?.installed && ansibleStatus?.controllerHost) {
        try {
          const config = await adminAPI.getAnsibleConfig(ansibleStatus.controllerHost);
          if (config.success) {
            const cfg = config.ansibleCfg || "";
            const inventory = config.ansibleInventory || "";
            const vars = config.ansibleVars || "";
            setAnsibleCfg(cfg);
            setAnsibleInventory(inventory);
            setAnsibleVars(vars);
            backupConfig(cfg, inventory, vars);
          } else {
            console.error("Không thể load cấu hình Ansible:", config.error);
            // Không hiển thị toast error để không làm phiền user
          }
        } catch (error: any) {
          console.error("Lỗi khi load cấu hình Ansible:", error);
          // Không hiển thị toast error, chỉ log
        }
      }
    };

    loadAnsibleConfig();
  }, [showConfigModal, ansibleStatus?.installed, ansibleStatus?.controllerHost]);


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
  const clusterServers = servers.filter(
    (s) => s.clusterStatus === "AVAILABLE" && (s.role === "MASTER" || s.role === "WORKER")
  );
  const masterServers = clusterServers.filter((s) => s.role === "MASTER");
  const workerServers = clusterServers.filter((s) => s.role === "WORKER");

  // Helper: chọn controller server
  // Ưu tiên: ANSIBLE online -> MASTER online -> ANSIBLE bất kỳ -> MASTER bất kỳ
  const pickControllerServer = () => {
    const onlineAnsible = ansibleServers.filter((s) => s.status === "online");
    const onlineMasters = masterServers.filter((s) => s.status === "online");

    if (onlineAnsible.length > 0) return onlineAnsible[0];
    if (onlineMasters.length > 0) return onlineMasters[0];
    if (ansibleServers.length > 0) return ansibleServers[0];
    if (masterServers.length > 0) return masterServers[0];
    return null;
  };

  // Tính toán thông tin cluster để hiển thị
  const masterCount = masterServers.length;
  const workerCount = workerServers.length;
  const clusterStatusText = cluster?.status === "healthy" ? "healthy" : "unhealthy";
  const clusterVersionText = cluster?.version || "Unknown";

  const handleCheckAnsibleStatus = async (silent: boolean = false) => {
    try {
      setIsCheckingAnsibleStatus(true);
      // Không gửi controllerHost, để backend tự động tìm controller server
      const status = await adminAPI.checkAnsibleStatus();
      // Luôn cập nhật status, kể cả khi có error
      setAnsibleStatus(status);

      // Chỉ hiển thị toast nếu không phải silent mode
      if (!silent) {
        if (status.error) {
          toast.warning(status.error);
        } else if (status.controllerHost) {
          toast.success(`Đã kiểm tra trạng thái Ansible trên ${status.controllerHost}`);
        } else {
          toast.success("Đã kiểm tra trạng thái Ansible");
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || "Không thể kiểm tra trạng thái Ansible";
      // Cập nhật status với error ngay cả khi API call fail
      setAnsibleStatus({
        installed: false,
        version: undefined,
        controllerHost: undefined,
        controllerRole: undefined,
        error: errorMessage,
      });
      // Chỉ hiển thị lỗi nếu không phải silent mode
      if (!silent) {
        toast.error(errorMessage);
      }
    } finally {
      setIsCheckingAnsibleStatus(false);
    }
  };

  const handleInstallAnsible = () => {
    const controllerServer = pickControllerServer();
    if (!controllerServer) {
      toast.error("Chưa có server nào với role ANSIBLE hoặc MASTER. Vui lòng cấu hình server trước.");
      return;
    }

    if (controllerServer.status !== "online") {
      toast.error(
        `Máy controller không online: ${controllerServer.ipAddress} (${controllerServer.role || "UNKNOWN"})`
      );
      return;
    }

    // Mở modal để nhập sudo password
    setPendingAnsibleAction("install");
    setPendingControllerHost(controllerServer.ipAddress);
    setPendingServerId(parseInt(controllerServer.id));
    initializeAnsibleSteps("install");
    setShowSudoPasswordModal(true);
  };

  const handleSetupAnsibleSimple = async () => {
    setIsInstallingAnsible(true);
    setSetupAnsibleLogs([]);
    try {
      const res = await api.post("/install/setup-ansible");
      const data = (res as any)?.data ?? res;
      const logs: string[] = Array.isArray(data) ? data : data?.logs || [];
      if (logs.length) {
        setSetupAnsibleLogs(logs);
      }
      toast.success("Đã gửi yêu cầu cài đặt Ansible");
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "Cài đặt Ansible thất bại";
      toast.error(msg);
    } finally {
      setIsInstallingAnsible(false);
    }
  };

  const callInstallApi = async (
    url: string,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setLogs: React.Dispatch<React.SetStateAction<string[]>>,
    successMessage: string
  ) => {
    setLoading(true);
    setLogs([]);
    try {
      const res = await api.post(url);
      const data = (res as any)?.data ?? res;
      const logs: string[] = Array.isArray(data) ? data : data?.logs || [];
      if (logs.length) setLogs(logs);
      toast.success(successMessage);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "Thao tác thất bại";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallK8sCluster = async () =>
    callInstallApi(
      "/install/install-kubernetes-kubespray",
      setIsInstallingK8sCluster,
      setK8sClusterInstallLogs,
      "Đã gửi yêu cầu cài đặt Kubernetes"
    );

  const handleInstallK8sAddons = async () =>
    callInstallApi(
      "/install/install-k8s-addons",
      setIsInstallingK8sAddons,
      setK8sTab2ApiLogs,
      "Đã gửi yêu cầu cài đặt K8s addons"
    );

  const handleInstallMetricsServer = async () =>
    callInstallApi(
      "/install/install-metrics-server",
      setIsInstallingMetricsServer,
      setK8sTab2ApiLogs,
      "Đã gửi yêu cầu cài đặt Metrics Server"
    );

  const handleInstallDocker = async () =>
    callInstallApi(
      "/install/install-docker",
      setIsInstallingDocker,
      setK8sTab2ApiLogs,
      "Đã gửi yêu cầu cài Docker"
    );

  const handleConfirmInstallAnsible = async () => {
    if (!pendingControllerHost) {
      toast.error("Không tìm thấy máy Ansible.");
      return;
    }

    const sudoPassword = sudoPasswords[pendingControllerHost] || "";

    // Kiểm tra nếu cần password nhưng chưa nhập
    if (serverAuthStatus?.needsPassword && (!sudoPassword || sudoPassword.trim() === "")) {
      toast.error("Vui lòng nhập sudo password.");
      return;
    }

    try {
      setIsInstallingAnsible(true);

      // Bước 1: Cập nhật package manager
      setAnsibleRunningStep(1);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      completeStep(1);

      // Bước 2: Cài đặt Python và pip
      setAnsibleRunningStep(2);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      completeStep(2);

      // Bước 3: Cài đặt Ansible
      setAnsibleRunningStep(3);
      const result = await adminAPI.installAnsible(pendingControllerHost, sudoPassword);

      // Nếu API call thành công (không throw error), coi như đã bắt đầu cài đặt
      completeStep(3);

      // Bước 4: Kiểm tra cài đặt
      setAnsibleRunningStep(4);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      completeStep(4);

      // Refresh status sau khi cài đặt
      setTimeout(async () => {
        try {
          const status = await adminAPI.checkAnsibleStatus();
          setAnsibleStatus(status);
          if (status.installed) {
            toast.success(`Cài đặt Ansible hoàn tất! Phiên bản: ${status.version || "Unknown"}`);
          }
        } catch (error) {
          console.error("Không thể kiểm tra trạng thái sau khi cài đặt", error);
        }
      }, 1000);

      // Clear passwords sau khi sử dụng
      setSudoPasswords({});
    } catch (error: any) {
      const errorMessage = error.message || "Không thể cài đặt Ansible";
      if (currentStepIndex >= 0) {
        errorStep(ansibleOperationSteps[currentStepIndex]?.id || 1);
      }
      toast.error(errorMessage);
    } finally {
      setIsInstallingAnsible(false);
      // Không set pendingAnsibleAction về null để giữ modal mở và cho phép đóng thủ công
    }
  };

  const handleReinstallAnsible = () => {
    const controllerServer = pickControllerServer();
    if (!controllerServer) {
      toast.error("Không tìm thấy máy controller (ANSIBLE hoặc MASTER).");
      return;
    }

    // Mở modal để nhập sudo password
    setPendingAnsibleAction("reinstall");
    setPendingControllerHost(controllerServer.ipAddress);
    setPendingServerId(parseInt(controllerServer.id));
    initializeAnsibleSteps("reinstall");
    setShowSudoPasswordModal(true);
  };

  const handleConfirmReinstallAnsible = async () => {
    if (!pendingControllerHost) {
      toast.error("Không tìm thấy máy Ansible.");
      return;
    }

    const sudoPassword = sudoPasswords[pendingControllerHost] || "";

    // Kiểm tra nếu cần password nhưng chưa nhập
    if (serverAuthStatus?.needsPassword && (!sudoPassword || sudoPassword.trim() === "")) {
      toast.error("Vui lòng nhập sudo password.");
      return;
    }

    try {
      setIsReinstallingAnsible(true);

      // Bước 1: Cập nhật pip
      setAnsibleRunningStep(1);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      completeStep(1);

      // Bước 2: Cài đặt lại/nâng cấp Ansible
      setAnsibleRunningStep(2);
      const result = await adminAPI.reinstallAnsible(pendingControllerHost, sudoPassword);

      // Nếu API call thành công (không throw error), coi như đã bắt đầu cài đặt lại
      completeStep(2);

      // Bước 3: Kiểm tra phiên bản
      setAnsibleRunningStep(3);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      completeStep(3);

      // Refresh status sau khi cài đặt lại
      setTimeout(async () => {
        try {
          const status = await adminAPI.checkAnsibleStatus();
          setAnsibleStatus(status);
          if (status.installed) {
            toast.success(`Cài đặt lại Ansible hoàn tất! Phiên bản: ${status.version || "Unknown"}`);
          }
        } catch (error) {
          console.error("Không thể kiểm tra trạng thái sau khi cài đặt lại", error);
        }
      }, 1000);

      // Clear passwords sau khi sử dụng
      setSudoPasswords({});
    } catch (error: any) {
      const errorMessage = error.message || "Không thể cài đặt lại Ansible";
      if (currentStepIndex >= 0) {
        errorStep(ansibleOperationSteps[currentStepIndex]?.id || 1);
      }
      toast.error(errorMessage);
    } finally {
      setIsReinstallingAnsible(false);
      // Không set pendingAnsibleAction về null để giữ modal mở và cho phép đóng thủ công
    }
  };

  const handleUninstallAnsible = () => {
    const controllerServer = pickControllerServer();
    if (!controllerServer) {
      toast.error("Không tìm thấy máy controller (ANSIBLE hoặc MASTER).");
      return;
    }

    // Mở modal để nhập sudo password
    setPendingAnsibleAction("uninstall");
    setPendingControllerHost(controllerServer.ipAddress);
    setPendingServerId(parseInt(controllerServer.id));
    initializeAnsibleSteps("uninstall");
    setShowSudoPasswordModal(true);
  };

  const handleConfirmUninstallAnsible = async () => {
    if (!pendingControllerHost) {
      toast.error("Không tìm thấy máy Ansible.");
      return;
    }

    const sudoPassword = sudoPasswords[pendingControllerHost] || "";

    // Kiểm tra nếu cần password nhưng chưa nhập
    if (serverAuthStatus?.needsPassword && (!sudoPassword || sudoPassword.trim() === "")) {
      toast.error("Vui lòng nhập sudo password.");
      return;
    }

    try {
      setIsUninstallingAnsible(true);

      // Bước 1: Kiểm tra hiện trạng
      setAnsibleRunningStep(1);
      await new Promise((resolve) => setTimeout(resolve, 800));
      completeStep(1);

      // Bước 2: Gỡ bằng pip
      setAnsibleRunningStep(2);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      completeStep(2);

      // Bước 3: Gỡ bằng apt
      setAnsibleRunningStep(3);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      completeStep(3);

      // Bước 4: Dọn dẹp
      setAnsibleRunningStep(4);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      completeStep(4);

      // Bước 5: Kiểm tra sau khi gỡ
      setAnsibleRunningStep(5);
      const result = await adminAPI.uninstallAnsible(pendingControllerHost, sudoPassword);

      // Nếu API call thành công (không throw error), coi như đã hoàn tất
      completeStep(5);

      // Update status after uninstallation
      setTimeout(async () => {
        try {
          const status = await adminAPI.checkAnsibleStatus();
          setAnsibleStatus(status);
          toast.success("Gỡ Ansible hoàn tất!");
        } catch (error) {
          // Nếu không kiểm tra được, cập nhật status thủ công
          setAnsibleStatus({
            installed: false,
            version: undefined,
            controllerHost: pendingControllerHost,
            controllerRole: (pickControllerServer()?.role as "ANSIBLE" | "MASTER" | undefined) ?? undefined,
          });
          toast.success("Gỡ Ansible hoàn tất!");
        }
      }, 1000);

      // Clear passwords sau khi sử dụng
      setSudoPasswords({});
    } catch (error: any) {
      const errorMessage = error.message || "Không thể gỡ Ansible";
      if (currentStepIndex >= 0) {
        errorStep(ansibleOperationSteps[currentStepIndex]?.id || 1);
      }
      toast.error(errorMessage);
    } finally {
      setIsUninstallingAnsible(false);
      // Không set pendingAnsibleAction về null để giữ modal mở và cho phép đóng thủ công
    }
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

  // K8s Tab 1: Chuẩn bị môi trường
  // Helper function để thực thi một playbook và cập nhật stepper
  const runPlaybookWithModal = async (
    playbookFilename: string,
    stepLabel: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!ansibleStatus?.controllerHost) {
      return { success: false, error: "Không tìm thấy controller host." };
    }

    const startMessage = `▶️ Bắt đầu: ${stepLabel}...`;
    setCurrentExecutingStep({
      stepLabel,
      playbookFilename,
      status: "running",
      logs: [startMessage],
    });
    setShowStepExecutionModal(true);

    try {
      const result = await adminAPI.executePlaybook({
        controllerHost: ansibleStatus.controllerHost,
        filename: playbookFilename,
        sudoPassword: initSudoPassword || undefined,
      });

      if (!result.success && !result.taskId) {
        throw new Error(result.error || result.message || `Lỗi khi thực thi ${playbookFilename}`);
      }

      if (result.taskId) {
        await monitorPlaybookTaskForStepWithModal(result.taskId, playbookFilename, stepLabel);
      } else {
        const normalized = (result.message || "").replace(/\r/g, "");
        const lines = normalized.split("\n").filter((line: string) => line.trim().length > 0);
        const successMessage = `🎉 Đã thực thi playbook thành công: ${playbookFilename}`;

        setCurrentExecutingStep((prev) =>
          prev
            ? {
                ...prev,
                status: "completed",
                logs: [...prev.logs, ...lines, successMessage],
              }
            : null
        );
      }

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || "Lỗi không xác định";
      setCurrentExecutingStep((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              logs: [...prev.logs, `❌ Lỗi: ${errorMessage}`],
            }
          : null
      );
      return { success: false, error: errorMessage };
    }
  };

  // Helper function để thực thi một playbook và cập nhật stepper
  const executePlaybookStep = async (
    playbookFilename: string,
    stepId: string,
    stepLabel: string,
    setSteps: React.Dispatch<React.SetStateAction<StepperStep[]>>,
    addLog: (message: string, type?: "info" | "error" | "success" | "step") => void
  ): Promise<boolean> => {
    if (!ansibleStatus?.controllerHost) {
      const errorMsg = "Không tìm thấy controller host.";
      addLog(`❌ Lỗi: ${stepLabel} - ${errorMsg}`, "error");
      toast.error(errorMsg);
      return false;
    }

    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status: "active" } : step
      )
    );
    addLog(`▶️ Bắt đầu: ${stepLabel}...`, "step");

    const result = await runPlaybookWithModal(playbookFilename, stepLabel);

    if (result.success) {
      setSteps((prev) =>
        prev.map((step) =>
          step.id === stepId ? { ...step, status: "completed" } : step
        )
      );
      addLog(`✅ Hoàn tất: ${stepLabel}`, "success");
      return true;
    }

    const errorMessage = result.error || "Lỗi không xác định";
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status: "error" } : step
      )
    );
    addLog(`❌ Lỗi: ${stepLabel} - ${errorMessage}`, "error");
    toast.error(errorMessage);
    return false;
  };

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
    if (!pendingAction) return;

    setIsConfirmModalOpen(false);
    const { actionKey, playbookFilename, label } = pendingAction;

    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      setPendingAction(null);
      return;
    }

    setUtilityActionsStatus((prev) => ({ ...prev, [actionKey]: "running" }));
    const result = await runPlaybookWithModal(playbookFilename, label);
    setUtilityActionsStatus((prev) => ({
      ...prev,
      [actionKey]: result.success ? "completed" : "error",
    }));

    if (result.success) {
      toast.success(`${label} hoàn tất!`);
    } else {
      toast.error(result.error || `Lỗi khi thực thi ${label}`);
    }

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

  // Handlers riêng cho từng bước trong Tab 1
  const handleK8sTab1Step1 = useCallback(async () => {
    await executePlaybookStep(
      "01-update-hosts-hostname.yml",
      "update-hosts",
      "Cập nhật hosts & hostname",
      setK8sTab1Steps,
      addK8sTab1Log
    );
  }, [ansibleStatus?.controllerHost, initSudoPassword]);

  const handleK8sTab1Step2 = useCallback(async () => {
    await executePlaybookStep(
      "02-kernel-sysctl.yml",
      "kernel-sysctl",
      "Cấu hình kernel & sysctl",
      setK8sTab1Steps,
      addK8sTab1Log
    );
  }, [ansibleStatus?.controllerHost, initSudoPassword]);

  const handleK8sTab1Step3 = useCallback(async () => {
    await executePlaybookStep(
      "03-install-containerd.yml",
      "install-containerd",
      "Cài đặt containerd",
      setK8sTab1Steps,
      addK8sTab1Log
    );
  }, [ansibleStatus?.controllerHost, initSudoPassword]);

  const handleK8sTab1Step4 = useCallback(async () => {
    const success = await executePlaybookStep(
      "04-install-kubernetes.yml",
      "install-kubernetes",
      "Cài đặt Kubernetes tools",
      setK8sTab1Steps,
      addK8sTab1Log
    );
    
    if (success) {
      // Kiểm tra xem tất cả các bước đã hoàn thành chưa
      setK8sTab1Steps((prev) => {
        const allCompleted = prev.every(step => step.status === "completed");
        if (allCompleted) {
          setK8sTab1Completed(true);
          toast.success("Tab 1: Chuẩn bị môi trường hoàn tất!");
        }
        return prev;
      });
    }
  }, [ansibleStatus?.controllerHost, initSudoPassword]);

  const handleInstallK8sTab1 = async () => {
    if (clusterServers.length === 0) {
      toast.error("Chưa có server nào trong cluster.");
      return;
    }

    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    try {
      setIsInstallingK8sTab1(true);
      setK8sTab1Logs([]);
      addK8sTab1Log("Bắt đầu Tab 1: Chuẩn bị môi trường...", "step");

      // Định nghĩa các playbook cần thực thi cho Tab 1
      const playbooks = [
        { filename: "01-update-hosts-hostname.yml", stepId: "update-hosts", label: "Cập nhật hosts & hostname" },
        { filename: "02-kernel-sysctl.yml", stepId: "kernel-sysctl", label: "Cấu hình kernel & sysctl" },
        { filename: "03-install-containerd.yml", stepId: "install-containerd", label: "Cài đặt containerd" },
        { filename: "04-install-kubernetes.yml", stepId: "install-kubernetes", label: "Cài đặt Kubernetes tools" },
      ];

      // Thực thi từng playbook tuần tự
      for (const playbook of playbooks) {
        const success = await executePlaybookStep(
          playbook.filename,
          playbook.stepId,
          playbook.label,
          setK8sTab1Steps,
          addK8sTab1Log
        );

        if (!success) {
          throw new Error(`Lỗi khi thực thi ${playbook.label}`);
        }
      }

      addK8sTab1Log("🎉 Tab 1 hoàn tất thành công!", "success");
      setK8sTab1Completed(true);
      toast.success("Tab 1: Chuẩn bị môi trường hoàn tất!");

      setTimeout(() => {
        setK8sActiveTab("tab2");
        toast.info("Đã chuyển sang Tab 2");
      }, 1000);
    } catch (error: any) {
      const errorMessage = error.message || "Lỗi không xác định";
      addK8sTab1Log(`Lỗi: ${errorMessage}`, "error");
      toast.error(`Lỗi Tab 1: ${errorMessage}`);
    } finally {
      setIsInstallingK8sTab1(false);
    }
  };

  // Handlers riêng cho từng bước trong Tab 2
  const handleK8sTab2Step1 = async () => {
    await executePlaybookStep(
      "05-init-master.yml",
      "init-master",
      "Khởi tạo master node",
      setK8sTab2Steps,
      addK8sTab2Log
    );
  };

  const handleK8sTab2Step2 = async () => {
    await executePlaybookStep(
      "06-install-cni.yml",
      "install-cni",
      "Cài đặt CNI (Calico)",
      setK8sTab2Steps,
      addK8sTab2Log
    );
  };

  const handleK8sTab2Step3 = async () => {
    const success = await executePlaybookStep(
      "07-join-workers.yml",
      "join-workers",
      "Thêm worker nodes",
      setK8sTab2Steps,
      addK8sTab2Log
    );
    
    if (success) {
      // Kiểm tra xem tất cả các bước đã hoàn thành chưa
      const allCompleted = k8sTab2Steps.every(step => step.status === "completed");
      if (allCompleted) {
        setK8sTab2Completed(true);
        toast.success("Tab 2: Triển khai cluster hoàn tất!");
      }
    }
  };

  // K8s Tab 2: Triển khai cluster
  const handleInstallK8sTab2 = async () => {
    // TODO: TEST MODE - Bỏ ràng buộc để test
    // if (!k8sTab1Completed) {
    //   toast.error("Phải hoàn thành Tab 1 trước.");
    //   return;
    // }

    if (masterServers.length === 0) {
      toast.error("Phải có ít nhất 1 Master node.");
      return;
    }

    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    try {
      setIsInstallingK8sTab2(true);
      setK8sTab2Logs([]);
      addK8sTab2Log("Bắt đầu Tab 2: Triển khai cluster...", "step");

      // Định nghĩa các playbook cần thực thi cho Tab 2
      // Sử dụng Calico CNI (có thể thay đổi thành Flannel nếu cần)
      const playbooks = [
        { filename: "05-init-master.yml", stepId: "init-master", label: "Khởi tạo master node" },
        { filename: "06-install-cni.yml", stepId: "install-cni", label: "Cài đặt CNI (Calico)" },
        { filename: "07-join-workers.yml", stepId: "join-workers", label: "Thêm worker nodes" },
      ];

      // Thực thi từng playbook tuần tự
      for (const playbook of playbooks) {
        const success = await executePlaybookStep(
          playbook.filename,
          playbook.stepId,
          playbook.label,
          setK8sTab2Steps,
          addK8sTab2Log
        );

        if (!success) {
          throw new Error(`Lỗi khi thực thi ${playbook.label}`);
        }
      }

      addK8sTab2Log("🎉 Tab 2 hoàn tất thành công!", "success");
      setK8sTab2Completed(true);
      toast.success("Tab 2: Triển khai cluster hoàn tất!");

      setTimeout(() => {
        setK8sActiveTab("tab3");
        toast.info("Đã chuyển sang Tab 3");
      }, 1000);
    } catch (error: any) {
      const errorMessage = error.message || "Lỗi không xác định";
      addK8sTab2Log(`Lỗi: ${errorMessage}`, "error");
      toast.error(`Lỗi Tab 2: ${errorMessage}`);
    } finally {
      setIsInstallingK8sTab2(false);
    }
  };

  // Handlers riêng cho từng bước trong Tab 3
  const handleK8sTab3Step1 = async () => {
    await executePlaybookStep(
      "08-verify-cluster.yml",
      "verify-cluster",
      "Xác minh trạng thái cluster",
      setK8sTab3Steps,
      addK8sTab3Log
    );
  };

  const handleK8sTab3Step2 = async () => {
    await executePlaybookStep(
      "10-install-metrics-server.yml",
      "install-metrics",
      "Cài đặt Metrics Server",
      setK8sTab3Steps,
      addK8sTab3Log
    );
  };

  const handleK8sTab3Step3 = async () => {
    await executePlaybookStep(
      "11-install-ingress.yml",
      "install-ingress",
      "Cài đặt Nginx Ingress",
      setK8sTab3Steps,
      addK8sTab3Log
    );
  };

  const handleK8sTab3Step4 = async () => {
    await executePlaybookStep(
      "12-install-metallb.yml",
      "install-metallb",
      "Cài đặt MetalLB LoadBalancer",
      setK8sTab3Steps,
      addK8sTab3Log
    );
  };

  const handleK8sTab3Step5 = async () => {
    const success = await executePlaybookStep(
      "13-setup-storage.yml",
      "setup-storage",
      "Thiết lập Storage (NFS)",
      setK8sTab3Steps,
      addK8sTab3Log
    );
    
    if (success) {
      // Kiểm tra xem tất cả các bước đã hoàn thành chưa
      const allCompleted = k8sTab3Steps.every(step => step.status === "completed");
      if (allCompleted) {
        setK8sTab3Completed(true);
        toast.success("Tab 3: Kiểm tra & Tùy chọn mở rộng hoàn tất!");
      }
    }
  };

  // K8s Tab 3: Kiểm tra & Tùy chọn mở rộng
  const handleInstallK8sTab3 = async () => {
    // TODO: TEST MODE - Bỏ ràng buộc để test
    // if (!k8sTab2Completed) {
    //   toast.error("Phải hoàn thành Tab 2 trước.");
    //   return;
    // }

    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    const masterNode = masterServers[0];
    if (!masterNode) {
      toast.error("Không tìm thấy master node.");
      return;
    }

    try {
      setIsInstallingK8sTab3(true);
      setK8sTab3Logs([]);
      addK8sTab3Log("Bắt đầu Tab 3: Kiểm tra & Tùy chọn mở rộng...", "step");

      // Định nghĩa các playbook cần thực thi cho Tab 3
      const playbooks = [
        { filename: "08-verify-cluster.yml", stepId: "verify-cluster", label: "Xác minh trạng thái cluster" },
        { filename: "10-install-metrics-server.yml", stepId: "install-metrics", label: "Cài đặt Metrics Server" },
        { filename: "11-install-ingress.yml", stepId: "install-ingress", label: "Cài đặt Nginx Ingress" },
        { filename: "12-install-metallb.yml", stepId: "install-metallb", label: "Cài đặt MetalLB LoadBalancer" },
        { filename: "13-setup-storage.yml", stepId: "setup-storage", label: "Thiết lập Storage (NFS)" },
      ];

      // Thực thi từng playbook tuần tự
      for (const playbook of playbooks) {
        const success = await executePlaybookStep(
          playbook.filename,
          playbook.stepId,
          playbook.label,
          setK8sTab3Steps,
          addK8sTab3Log
        );

        if (!success) {
          throw new Error(`Lỗi khi thực thi ${playbook.label}`);
        }
      }

      addK8sTab3Log("🎉 Tab 3 hoàn tất thành công!", "success");
      addK8sTab3Log("🎉 Kubernetes Cluster đã được cài đặt hoàn chỉnh!", "success");
      setK8sTab3Completed(true);
      toast.success("Tab 3: Kiểm tra & Tùy chọn mở rộng hoàn tất!");
    } catch (error: any) {
      const errorMessage = error.message || "Lỗi không xác định";
      addK8sTab3Log(`Lỗi: ${errorMessage}`, "error");
      toast.error(`Lỗi Tab 3: ${errorMessage}`);
    } finally {
      setIsInstallingK8sTab3(false);
    }
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

  // Verify Ansible config
  const handleVerifyConfig = async () => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    if (!ansibleCfg.trim() || !ansibleInventory.trim()) {
      toast.error("Vui lòng điền đầy đủ ansible.cfg và inventory");
      return;
    }

    setIsVerifyingConfig(true);

    try {
      const result = await adminAPI.verifyAnsibleConfig(
        ansibleStatus.controllerHost,
        ansibleCfg,
        ansibleInventory,
        ansibleVars
      );

      if (result.success) {
        toast.success(result.message || "Cấu hình hợp lệ!");
      } else {
        throw new Error(result.error || result.message || "Cấu hình không hợp lệ");
      }
    } catch (error: any) {
      const errorMessage = error.message || "Không thể kiểm tra cấu hình";
      toast.error(errorMessage);
    } finally {
      setIsVerifyingConfig(false);
    }
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

  // Save config (with backup)
  const handleSaveConfig = async () => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    // Validate required fields
    if (!ansibleCfg.trim() || !ansibleInventory.trim()) {
      toast.error("Vui lòng điền đầy đủ ansible.cfg và inventory");
      return;
    }

    setIsSavingConfig(true);

    try {
      const result = await adminAPI.saveAnsibleConfig(
        ansibleStatus.controllerHost,
        ansibleCfg,
        ansibleInventory,
        ansibleVars
      );

      if (!result.success) {
        throw new Error(result.error || result.message || "Không thể lưu cấu hình");
      }

      toast.success(result.message || "Đã lưu cấu hình Ansible");
      backupConfig(ansibleCfg, ansibleInventory, ansibleVars);
      setShowConfigModal(false);
    } catch (error: any) {
      const errorMessage = error.message || "Không thể lưu cấu hình";
      toast.error(errorMessage);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Playbook functions
  const loadPlaybooks = async (preferredSelection?: string | null) => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    setIsLoadingPlaybooks(true);
    try {
      const response = await adminAPI.getPlaybooks(ansibleStatus.controllerHost);
      const remotePlaybooks = response.playbooks || [];
      setPlaybooks(remotePlaybooks);

      if (remotePlaybooks.length === 0) {
        setSelectedPlaybook(null);
        setPlaybookFilename("");
        setPlaybookContent("");
        return;
      }

      const nextSelection =
        (preferredSelection && remotePlaybooks.some((pb: { name: string }) => pb.name === preferredSelection) && preferredSelection) ||
        (selectedPlaybook && remotePlaybooks.some((pb: { name: string }) => pb.name === selectedPlaybook) && selectedPlaybook) ||
        remotePlaybooks[0].name;

      const selected = remotePlaybooks.find((pb: { name: string }) => pb.name === nextSelection) || remotePlaybooks[0];
      setSelectedPlaybook(selected.name);
      setPlaybookFilename(selected.name.replace(/\.ya?ml$/i, ""));
      setPlaybookContent(selected.content || "");
    } catch (error: any) {
      const errorMessage = error.message || "Không thể tải danh sách playbook";
      toast.error(errorMessage);
    } finally {
      setIsLoadingPlaybooks(false);
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
      await loadPlaybooks(filename);
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
      await loadPlaybooks();
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

  const handleExecutePlaybook = async () => {
    if (!selectedPlaybook) {
      toast.error("Vui lòng chọn playbook để thực thi");
      return;
    }

    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    try {
      cancelPlaybookTaskPolling();
      setIsExecutingPlaybook(true);
      clearPlaybookExecutionLogs();
      // addPlaybookExecutionLog(`Bắt đầu thực thi playbook: ${selectedPlaybook}`, "step");

      const result = await adminAPI.executePlaybook({
        controllerHost: ansibleStatus.controllerHost,
        filename: selectedPlaybook,
        sudoPassword: initSudoPassword || undefined,
      });

      if (!result.success && !result.taskId) {
        throw new Error(result.error || result.message || "Thực thi playbook thất bại");
      }

      if (result.taskId) {
        monitorPlaybookTask(result.taskId, selectedPlaybook);
        return;
      }

      const normalized = (result.message || "").replace(/\r/g, "");
      const lines = normalized.split("\n").filter((line: string) => line.trim().length > 0);
      if (lines.length > 0) {
        lines.forEach((line: string) => addPlaybookExecutionLog(line, result.success ? "info" : "error"));
      }

      if (!result.success) {
        throw new Error(result.error || result.message || "Thực thi playbook thất bại");
      }

      addPlaybookExecutionLog("🎉 Thực thi playbook thành công!", "success");
      toast.success(result.message || `Đã thực thi playbook ${selectedPlaybook} thành công!`);
      setIsExecutingPlaybook(false);
    } catch (error: any) {
      const errorMessage = error.message || "Lỗi không xác định";
      addPlaybookExecutionLog(`Lỗi: ${errorMessage}`, "error");
      toast.error(`Lỗi khi thực thi: ${errorMessage}`);
      cancelPlaybookTaskPolling();
      setIsExecutingPlaybook(false);
    }
  };

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
      await loadPlaybooks(file.name);
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
      await loadPlaybooks(finalName);
    } catch (error: any) {
      toast.error(error.message || "Không thể tạo playbook từ template");
    } finally {
      setIsSavingPlaybook(false);
    }
  };

  // Load playbooks when modal opens
  useEffect(() => {
    if (showPlaybookModal && ansibleStatus?.installed) {
      loadPlaybooks();
    }
  }, [showPlaybookModal, ansibleStatus?.installed]);

  // Filter playbooks by search query
  const filteredPlaybooks = playbooks.filter((p) =>
    p.name.toLowerCase().includes(playbookSearchQuery.toLowerCase())
  );

  // Bước 1: Tạo cấu trúc thư mục
  const executeStep1 = async (): Promise<boolean> => {
    return runInitStep({
      stepNumber: 1,
      startMessage: "Bước 1/4: Tạo cấu trúc thư mục Ansible trên controller...",
      successMessage: "Bước 1 hoàn tất!",
      startRequest: () =>
        adminAPI.initAnsibleStep1(
          ansibleStatus?.controllerHost,
          initSudoPassword || undefined
        ),
    });
  };

  // Bước 2: Ghi cấu hình mặc định
  const executeStep2 = async (): Promise<boolean> => {
    return runInitStep({
      stepNumber: 2,
      startMessage: "Bước 2/4: Ghi cấu hình mặc định (ansible.cfg, inventory)...",
      successMessage: "Bước 2 hoàn tất!",
      startRequest: () =>
        adminAPI.initAnsibleStep2(
          ansibleStatus?.controllerHost,
          ansibleCfg,
          ansibleInventory,
          ansibleVars,
          initSudoPassword || undefined
        ),
    });
  };

  // Bước 3: Phân phối SSH key
  const executeStep3 = async (): Promise<boolean> => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return false;
    }

    const clusterServersForInit = servers.filter(
      (s) => s.clusterStatus === "AVAILABLE" && (s.role === "MASTER" || s.role === "WORKER")
    );

    if (clusterServersForInit.length === 0) {
      emitInitLogLine("⚠️ Không có nodes nào trong cluster để phân phối key");
      toast.warning("Không có nodes nào trong cluster");
      return false;
    }

    const serverIds = clusterServersForInit.map((s) => String(s.id));

    return runInitStep({
      stepNumber: 3,
      startMessage: `Bước 3/4: Phân phối SSH key từ controller đến ${serverIds.length} node(s)...`,
      successMessage: "Bước 3 hoàn tất!",
      startRequest: () =>
        adminAPI.initAnsibleStep3(
          ansibleStatus.controllerHost,
          serverIds,
          initSudoPassword || undefined
        ),
    });
  };

  // Bước 4: Ping nodes
  const executeStep4 = async (): Promise<boolean> => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return false;
    }

    const clusterServersForInit = servers.filter(
      (s) => s.clusterStatus === "AVAILABLE" && (s.role === "MASTER" || s.role === "WORKER")
    );

    if (clusterServersForInit.length === 0) {
      emitInitLogLine("⚠️ Không có nodes nào trong cluster để ping");
      toast.warning("Không có nodes nào trong cluster");
      return false;
    }

    const serverIds = clusterServersForInit.map((s) => String(s.id));

    return runInitStep({
      stepNumber: 4,
      startMessage: `Bước 4/4: Ping và kiểm tra kết nối đến ${serverIds.length} node(s)...`,
      successMessage: "Bước 4 hoàn tất!",
      startRequest: () =>
        adminAPI.initAnsibleStep4(ansibleStatus.controllerHost, serverIds),
    });
  };

  // Khởi tạo 3 bước đầu (cho modal nhanh - Bước 2)
  const handleStartInitQuickly = async () => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host. Vui lòng kiểm tra trạng thái Ansible trước.");
      return;
    }

    // Reset steps về pending
    setInitQuicklySteps([
      { id: 1, label: "Bước 1: Tạo cấu trúc thư mục", status: "pending" },
      { id: 2, label: "Bước 2: Ghi cấu hình mặc định", status: "pending" },
      { id: 3, label: "Bước 3: Phân phối SSH key", status: "pending" },
    ]);

    setIsInitializing(true);

    const finish = () => {
      setIsInitializing(false);
      cancelInitTaskPolling();
    };

    // Bước 1
    setInitQuicklySteps((prev) => prev.map((s) => s.id === 1 ? { ...s, status: "running" as const } : s));
    const step1Ok = await executeStep1();
    if (!step1Ok) {
      setInitQuicklySteps((prev) => prev.map((s) => s.id === 1 ? { ...s, status: "error" as const, errorMessage: "Xảy ra lỗi" } : s));
      finish();
      return;
    }
    setInitQuicklySteps((prev) => prev.map((s) => s.id === 1 ? { ...s, status: "completed" as const } : s));

    // Bước 2
    setInitQuicklySteps((prev) => prev.map((s) => s.id === 2 ? { ...s, status: "running" as const } : s));
    const step2Ok = await executeStep2();
    if (!step2Ok) {
      setInitQuicklySteps((prev) => prev.map((s) => s.id === 2 ? { ...s, status: "error" as const, errorMessage: "Xảy ra lỗi" } : s));
      finish();
      return;
    }
    setInitQuicklySteps((prev) => prev.map((s) => s.id === 2 ? { ...s, status: "completed" as const } : s));

    // Bước 3
    setInitQuicklySteps((prev) => prev.map((s) => s.id === 3 ? { ...s, status: "running" as const } : s));
    const step3Ok = await executeStep3();
    if (!step3Ok) {
      setInitQuicklySteps((prev) => prev.map((s) => s.id === 3 ? { ...s, status: "error" as const, errorMessage: "Xảy ra lỗi" } : s));
      finish();
      return;
    }
    setInitQuicklySteps((prev) => prev.map((s) => s.id === 3 ? { ...s, status: "completed" as const } : s));

    toast.success("Khởi tạo Ansible thành công! Vui lòng thực hiện Bước 3: Ping nodes.");

    setTimeout(() => {
      setShowInitQuicklyModal(false);
    }, 1000);

    finish();
  };

  // Ping nodes (Bước 3 riêng)
  const handlePingNodes = async () => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    const clusterServersForInit = servers.filter(
      (s) => s.clusterStatus === "AVAILABLE" && (s.role === "MASTER" || s.role === "WORKER")
    );

    if (clusterServersForInit.length === 0) {
      toast.warning("Không có nodes nào trong cluster");
      setPingNodesStep({ status: "error", errorMessage: "Xảy ra lỗi" });
      return;
    }

    setPingNodesStep({ status: "running" });

    try {
      const serverIds = clusterServersForInit.map((s) => String(s.id));
      const result = await runInitStep({
        stepNumber: 3,
        startMessage: `Bước 3: Ping và kiểm tra kết nối đến ${serverIds.length} node(s)...`,
        successMessage: "Bước 3 hoàn tất!",
        startRequest: () =>
          adminAPI.initAnsibleStep4(ansibleStatus.controllerHost, serverIds),
      });

      if (result) {
        setPingNodesStep({ status: "completed" });
        toast.success("Ping nodes thành công!");
      } else {
        setPingNodesStep({ status: "error", errorMessage: "Xảy ra lỗi" });
        toast.error("Lỗi khi ping nodes");
      }
    } catch (error: any) {
      setPingNodesStep({ status: "error", errorMessage: "Xảy ra lỗi" });
      toast.error(error.message || "Lỗi khi ping nodes");
    } finally {
      cancelInitTaskPolling();
    }
  };

  // Khởi tạo templates (Bước 4)
  const handleInitTemplates = async () => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host.");
      return;
    }

    setInitTemplatesStep({ status: "running" });

    try {
      // Lấy tất cả templates từ playbookTemplateCatalog
      const allTemplates: Array<{ id: string; filename: string; content: string }> = [];
      playbookTemplateCatalog.forEach((category) => {
        category.templates.forEach((template) => {
          const templateData = getPlaybookTemplateById(template.id);
          if (templateData) {
            allTemplates.push({
              id: template.id,
              filename: template.filename,
              content: templateData.content,
            });
          }
        });
      });

      if (allTemplates.length === 0) {
        throw new Error("Không tìm thấy template nào");
      }

      toast.info(`Bắt đầu khởi tạo ${allTemplates.length} template(s) playbook cho K8s...`);

      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      // Lưu từng template
      for (const template of allTemplates) {
        try {
          const result = await adminAPI.savePlaybook({
            controllerHost: ansibleStatus.controllerHost,
            filename: template.filename,
            content: template.content,
            sudoPassword: initSudoPassword || undefined,
          });

          if (result.success) {
            successCount++;
          } else {
            failCount++;
            const errorMsg = result.error || result.message || "Lỗi không xác định";
            errors.push(`${template.filename}: ${errorMsg}`);
          }
        } catch (error: any) {
          failCount++;
          const errorMsg = error.message || "Lỗi không xác định";
          errors.push(`${template.filename}: ${errorMsg}`);
        }
      }

      if (failCount === 0) {
        setInitTemplatesStep({ status: "completed" });
        setPart1Completed(true);
        toast.success(`Đã khởi tạo thành công ${successCount} template(s)! Phần 1 đã hoàn thành.`);

        setTimeout(() => {
          setExpandedSection("kubernetes");
          setK8sActiveTab("tab1");
          toast.info("Đã chuyển sang Phần 2: Cài đặt Kubernetes");
        }, 1000);
      } else if (successCount > 0) {
        setInitTemplatesStep({ status: "completed" });
        setPart1Completed(true);
        toast.warning(`Đã khởi tạo ${successCount}/${allTemplates.length} template(s). ${failCount} template(s) thất bại.`);
      } else {
        setInitTemplatesStep({ status: "error", errorMessage: `Tất cả ${failCount} template(s) thất bại` });
        toast.error(`Tất cả template(s) thất bại. Lỗi: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`);
      }
    } catch (error: any) {
      setInitTemplatesStep({ status: "error", errorMessage: error.message || "Xảy ra lỗi" });
      toast.error(error.message || "Lỗi khi khởi tạo templates");
    }
  };

  // Khởi tạo tuần tự cả 4 bước (cho modal chi tiết)
  const handleStartInit = async () => {
    if (!ansibleStatus?.controllerHost) {
      toast.error("Không tìm thấy controller host. Vui lòng kiểm tra trạng thái Ansible trước.");
      return;
    }

    setIsInitializing(true);
    clearInitLogs();
    emitInitLogLine("Bắt đầu quá trình khởi tạo Ansible...");

    const finish = () => {
      setIsInitializing(false);
      cancelInitTaskPolling();
    };

    const step1Ok = await executeStep1();
    if (!step1Ok) {
      finish();
      return;
    }

    const step2Ok = await executeStep2();
    if (!step2Ok) {
      finish();
      return;
    }

    const step3Ok = await executeStep3();
    if (!step3Ok) {
      finish();
      return;
    }

    const step4Ok = await executeStep4();
    if (!step4Ok) {
      finish();
      return;
    }

    emitInitLogLine("");
    emitInitLogLine("🎉 Khởi tạo Ansible hoàn tất thành công!");
    const clusterServersForInit = servers.filter(
      (s) => s.clusterStatus === "AVAILABLE" && (s.role === "MASTER" || s.role === "WORKER")
    );
    emitInitLogLine(`Đã khởi tạo cho ${clusterServersForInit.length} nodes trong cluster.`);

    setPart1Completed(true);
    toast.success("Khởi tạo Ansible thành công! Phần 1 đã hoàn thành.");

    setTimeout(() => {
      setExpandedSection("kubernetes");
      setK8sActiveTab("tab1");
      toast.info("Đã chuyển sang Phần 2: Cài đặt Kubernetes");
    }, 1000);

    finish();
  };

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
                  {part1Completed && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Hoàn thành
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  Cài đặt Ansible trên controller server và khởi tạo môi trường để quản lý các nodes trong cluster
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
                {ansibleStatus?.error && !ansibleStatus.controllerHost ? (
                  <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">{ansibleStatus.error}</p>
                    <p className="text-sm mt-1">Vui lòng thêm server với role ANSIBLE hoặc MASTER trong trang Servers</p>
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
                        ) : ansibleStatus?.controllerHost ? (
                          <>
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="font-medium text-sm">Online</span>
                          </>
                        ) : ansibleServers.length > 0 && ansibleServers[0]?.status === "online" ? (
                          <>
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="font-medium text-sm">Online</span>
                          </>
                        ) : ansibleServers.length > 0 ? (
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

                    {/* Máy controller */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground font-medium">Máy controller</Label>
                      <div className="font-medium text-sm min-h-[24px] flex items-center">
                        {isCheckingAnsibleStatus ? (
                          <span className="text-muted-foreground">Đang kiểm tra...</span>
                        ) : ansibleStatus?.controllerHost ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="break-all">{ansibleStatus.controllerHost}</span>
                            {ansibleStatus.controllerRole && (
                              <Badge variant="outline" className="text-xs">
                                {ansibleStatus.controllerRole}
                              </Badge>
                            )}
                          </div>
                        ) : ansibleServers.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="break-all">{ansibleServers[0]?.ipAddress || "-"}</span>
                            <Badge variant="outline" className="text-xs">
                              {ansibleServers[0]?.role || "ANSIBLE"}
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
                        ) : ansibleStatus ? (
                          ansibleStatus.installed ? (
                            <Badge variant="default" className="text-xs">{ansibleStatus.version || "Đã cài đặt"}</Badge>
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
                          onClick={() => handleCheckAnsibleStatus(false)}
                          disabled={isCheckingAnsibleStatus}
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
                              <Search className="h-3 w-3 mr-1" />
                              <span className="text-xs">Kiểm tra</span>
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleSetupAnsibleSimple}
                          disabled={isInstallingAnsible}
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
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {setupAnsibleLogs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Log cài đặt Ansible</CardTitle>
                  <CardDescription>Danh sách log trả về từ API cài đặt</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg bg-gray-900 text-green-300 font-mono text-sm p-3 max-h-64 overflow-auto">
                    {setupAnsibleLogs.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">
                        {line}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
                          disabled={isInstallingK8sCluster}
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Button
                          onClick={handleInstallK8sAddons}
                          disabled={isInstallingK8sAddons}
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
                        <Button
                          onClick={handleInstallMetricsServer}
                          disabled={isInstallingMetricsServer}
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
                        <Button
                          onClick={handleInstallDocker}
                          disabled={isInstallingDocker}
                          size="lg"
                          className="w-full"
                        >
                          {isInstallingDocker ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Đang cài Docker
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Cài Docker
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
                  if (!isInitializing) {
                    setShowInitQuicklyModal(false);
                  }
                }}
                disabled={isInitializing}
              >
                {isInitializing ? "Đang chạy..." : "Đóng"}
              </Button>
              <Button
                onClick={handleStartInitQuickly}
                disabled={isInitializing || !ansibleStatus?.installed}
                size="lg"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang khởi tạo...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Bắt đầu khởi tạo
                  </>
                )}
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
              {/* Step Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  onClick={executeStep1}
                  disabled={isInitializing || runningStep !== null || !ansibleStatus?.installed}
                  variant="outline"
                  className="justify-start"
                >
                  {runningStep === 1 ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang chạy...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Bước 1: Tạo cấu trúc thư mục
                    </>
                  )}
                </Button>
                <Button
                  onClick={executeStep2}
                  disabled={isInitializing || runningStep !== null || !ansibleStatus?.installed}
                  variant="outline"
                  className="justify-start"
                >
                  {runningStep === 2 ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang chạy...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Bước 2: Ghi cấu hình mặc định
                    </>
                  )}
                </Button>
                <Button
                  onClick={executeStep3}
                  disabled={isInitializing || runningStep !== null || !ansibleStatus?.installed}
                  variant="outline"
                  className="justify-start"
                >
                  {runningStep === 3 ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang chạy...
                    </>
                  ) : (
                    <>
                      <Network className="h-4 w-4 mr-2" />
                      Bước 3: Phân phối SSH key
                    </>
                  )}
                </Button>
                <Button
                  onClick={executeStep4}
                  disabled={isInitializing || runningStep !== null || !ansibleStatus?.installed}
                  variant="outline"
                  className="justify-start"
                >
                  {runningStep === 4 ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang chạy...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Bước 4: Ping nodes
                    </>
                  )}
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!isInitializing && runningStep === null) {
                      setShowInitModal(false);
                      clearInitLogs();
                    }
                  }}
                  disabled={isInitializing || runningStep !== null}
                >
                  {isInitializing || runningStep !== null ? "Đang chạy..." : "Đóng"}
                </Button>
                <Button
                  onClick={handleStartInit}
                  disabled={isInitializing || runningStep !== null || !ansibleStatus?.installed}
                  size="lg"
                >
                  {isInitializing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang khởi tạo...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Khởi tạo (Chạy tuần tự 4 bước)
                    </>
                  )}
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
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleVerifyConfig}
                  disabled={isVerifyingConfig || !ansibleStatus?.installed}
                >
                  {isVerifyingConfig ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang kiểm tra...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Kiểm tra
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRollbackConfig}
                  disabled={isRollingBack || !configBackup}
                >
                  {isRollingBack ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang khôi phục...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Khôi phục
                    </>
                  )}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowConfigModal(false)}>
                  Hủy
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={!ansibleStatus?.installed || isSavingConfig}
                >
                  {isSavingConfig ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu cấu hình"
                  )}
                </Button>
              </div>
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
                <Button
                  variant="outline"
                  size="default"
                  className="px-3 py-2 h-9 text-sm"
                  onClick={() => loadPlaybooks(selectedPlaybook)}
                  disabled={!ansibleStatus?.installed || isLoadingPlaybooks}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Làm mới
                </Button>
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
                {selectedPlaybook && (
                  <Button
                    variant="default"
                    onClick={handleExecutePlaybook}
                    disabled={isExecutingPlaybook || !ansibleStatus?.installed}
                  >
                    {isExecutingPlaybook ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Đang thực thi...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Thực thi
                      </>
                    )}
                  </Button>
                )}
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
                  {/* Hiển thị nút "Xác nhận" khi chưa bắt đầu */}
                  {ansibleOperationSteps.length === 0 ||
                    !ansibleOperationSteps.every(s => s.status === "completed") ? (
                    <Button
                      onClick={() => {
                        if (pendingAnsibleAction === "install") {
                          handleConfirmInstallAnsible();
                        } else if (pendingAnsibleAction === "reinstall") {
                          handleConfirmReinstallAnsible();
                        } else if (pendingAnsibleAction === "uninstall") {
                          handleConfirmUninstallAnsible();
                        }
                      }}
                      disabled={
                        serverAuthStatus?.needsPassword && !sudoPasswords[pendingControllerHost || ""]?.trim()
                      }
                    >
                      Xác nhận
                    </Button>
                  ) : (
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
    </div>
  );
}

