package my_spring_app.my_spring_app.service.impl;

import my_spring_app.my_spring_app.dto.reponse.CheckClusterInstalledResponse;
import my_spring_app.my_spring_app.dto.reponse.CreateServerResponse;
import my_spring_app.my_spring_app.dto.reponse.ExecuteCommandResponse;
import my_spring_app.my_spring_app.dto.reponse.InstallClusterResponse;
import my_spring_app.my_spring_app.dto.reponse.ServerResponse;
import my_spring_app.my_spring_app.dto.request.CreateServerRequest;
import my_spring_app.my_spring_app.dto.request.ExecuteCommandRequest;
import my_spring_app.my_spring_app.dto.request.InstallClusterRequest;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.service.SSHService;
import my_spring_app.my_spring_app.service.ServerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Service implementation cho Server
 * Xử lý các nghiệp vụ liên quan đến quản lý server
 */
@Service
@Transactional
public class ServerServiceImpl implements ServerService {

    // Repository để truy vấn Server entities
    @Autowired
    private ServerRepository serverRepository;
    
    // Service để thực thi lệnh SSH
    @Autowired
    private SSHService sshService;

    /**
     * Lấy tất cả server từ database và lấy thông tin tài nguyên realtime qua SSH
     * @return Danh sách tất cả server với thông tin CPU/Memory/Disk realtime
     */
    @Override
    public List<ServerResponse> findAll() {
        System.out.println("[findAll] Lấy tất cả server từ database");
        List<ServerEntity> servers = serverRepository.findAll();
        System.out.println("[findAll] Đã lấy được " + servers.size() + " server");

        return mapServersWithMetrics(servers);
    }

    @Override
    public List<ServerResponse> findClusterMembers() {
        System.out.println("[findClusterMembers] Lấy các server có clusterStatus = IN_CLUSTER");
        List<ServerEntity> servers = serverRepository.findAllByClusterStatusIgnoreCase("IN_CLUSTER");
        System.out.println("[findClusterMembers] Đã lấy được " + servers.size() + " server trong cluster");
        return mapServersWithMetrics(servers);
    }

    @Override
    public List<String> setupAnsibleOnK8sNodes() {
        System.out.println("[setupAnsibleOnK8sNodes] Bắt đầu cài đặt Ansible cho các node MASTER/WORKER");
        List<ServerEntity> allServers = serverRepository.findAll();
        List<ServerEntity> masterAndWorker = allServers.stream()
                .filter(s -> {
                    String role = s.getRole() != null ? s.getRole().toUpperCase(Locale.ROOT) : "";
                    return "MASTER".equals(role) || "WORKER".equals(role);
                })
                .collect(Collectors.toList());

        List<String> logs = new ArrayList<>();

        if (masterAndWorker.isEmpty()) {
            logs.add("Không tìm thấy server nào có role MASTER hoặc WORKER.");
            System.out.println("[setupAnsibleOnK8sNodes] " + logs.get(0));
            return logs;
        }

        // Tìm server có role ANSIBLE để cài Ansible
        List<ServerEntity> ansibleServers = allServers.stream()
                .filter(s -> "ANSIBLE".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (ansibleServers.isEmpty()) {
            logs.add("Không tìm thấy server nào có role ANSIBLE để cài Ansible.");
            System.out.println("[setupAnsibleOnK8sNodes] " + logs.get(0));
            return logs;
        }

        List<ServerEntity> masters = masterAndWorker.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào (MASTER là control node của Kubernetes cluster).");
            System.out.println("[setupAnsibleOnK8sNodes] " + logs.get(0));
            return logs;
        }

        // Bước 1: Cài Python3 trên tất cả MASTER + WORKER
        for (ServerEntity server : masterAndWorker) {
            String header = String.format("===== Server %s (%s) role=%s =====",
                    server.getName(), server.getIp(), server.getRole());
            logs.add(header);
            System.out.println("[setupAnsibleOnK8sNodes] " + header);

            if (!isServerReachable(server)) {
                String msg = "Không thể SSH tới server, bỏ qua.";
                logs.add("  - " + msg);
                System.err.println("[setupAnsibleOnK8sNodes] " + msg + " server=" + server.getName());
                continue;
            }

            // Cài Python3
            String pythonCmd = "sudo apt-get update -y && sudo apt-get install -y python3";
            runCommandWithLog(server, "Cài đặt Python3", pythonCmd, logs);
        }

        // 3. Cài Ansible trên server ANSIBLE (máy chạy Ansible riêng, không phải control node của K8s)
        // MASTER đầu tiên vẫn là control node của Kubernetes cluster
        ServerEntity ansibleServer = ansibleServers.get(0);
        ServerEntity k8sControlNode = masters.get(0); // MASTER đầu tiên là control node của K8s
        
        String header = String.format("===== Cài Ansible trên server ANSIBLE %s (%s) =====",
                ansibleServer.getName(), ansibleServer.getIp());
        logs.add(header);
        logs.add(String.format("Lưu ý: MASTER %s (%s) là control node của Kubernetes cluster",
                k8sControlNode.getName(), k8sControlNode.getIp()));
        System.out.println("[setupAnsibleOnK8sNodes] " + header);

        if (!isServerReachable(ansibleServer)) {
            String msg = "Không thể SSH tới server ANSIBLE, bỏ qua cài Ansible.";
            logs.add("  - " + msg);
            System.err.println("[setupAnsibleOnK8sNodes] " + msg + " server=" + ansibleServer.getName());
            return logs;
        }

        // 3.0. Thiết lập sudo NOPASSWD và cài Python3 trên server ANSIBLE (nếu chưa có)
        String sudoCmd = String.format(
                "echo '%s ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/%s >/dev/null && sudo chmod 440 /etc/sudoers.d/%s",
                ansibleServer.getUsername(), ansibleServer.getUsername(), ansibleServer.getUsername());
        runCommandWithLog(ansibleServer, "Thiết lập sudo NOPASSWD trên ANSIBLE", sudoCmd, logs);
        
        String pythonCmd = "sudo apt-get update -y && sudo apt-get install -y python3";
        runCommandWithLog(ansibleServer, "Cài đặt Python3 trên ANSIBLE", pythonCmd, logs);

        // 3.1. Cài Ansible và sshpass (để copy SSH key với mật khẩu)
        String ansibleInstallCmd = String.join(" && ",
                "sudo apt-get update -y",
                "sudo apt-get install -y software-properties-common sshpass",
                "sudo add-apt-repository --yes --update ppa:ansible/ansible",
                "sudo apt-get update -y", // Update lại sau khi add PPA
                "sudo apt-get install -y ansible",
                "which ansible && ansible --version || (echo 'Ansible chưa được cài đặt, thử cài lại...' && sudo apt-get install -y ansible && ansible --version)"
        );
        runCommandWithLog(ansibleServer, "Cài đặt Ansible và sshpass trên server ANSIBLE", ansibleInstallCmd, logs);

        // 3.2. Tạo SSH key nếu chưa có
        String sshKeyPath = "~/.ssh/id_ed25519";
        String sshKeyGenCmd = String.format(
                "if [ ! -f %s ]; then ssh-keygen -t ed25519 -C \"%s@%s\" -f %s -N \"\"; else echo 'SSH key đã tồn tại'; fi",
                sshKeyPath, ansibleServer.getUsername(), ansibleServer.getIp(), sshKeyPath
        );
        runCommandWithLog(ansibleServer, "Tạo SSH key (nếu chưa có)", sshKeyGenCmd, logs);

        // 3.3. Copy SSH key từ máy ANSIBLE đến tất cả MASTER và WORKER
        for (ServerEntity target : masterAndWorker) {
            String sshCopyIdCmd = String.format(
                    "sshpass -p '%s' ssh-copy-id -o StrictHostKeyChecking=no -i %s.pub %s@%s || echo 'Đã có key hoặc lỗi copy'",
                    target.getPassword(), sshKeyPath, target.getUsername(), target.getIp()
            );
            runCommandWithLog(ansibleServer, 
                    String.format("Copy SSH key đến %s (%s)", target.getName(), target.getIp()),
                    sshCopyIdCmd, logs);
        }

        // 3.4. Kiểm tra SSH không mật khẩu từ máy ANSIBLE đến MASTER và WORKER
        for (ServerEntity target : masterAndWorker) {
            String testSshCmd = String.format("ssh -o StrictHostKeyChecking=no %s@%s 'hostname' || echo 'SSH test failed'",
                    target.getUsername(), target.getIp());
            runCommandWithLog(ansibleServer,
                    String.format("Kiểm tra SSH không mật khẩu đến %s", target.getName()),
                    testSshCmd, logs);
        }

        // 3.5. Tạo thư mục ansible-k8s trên máy ANSIBLE
        String mkdirCmd = "mkdir -p ~/ansible-k8s && cd ~/ansible-k8s && pwd";
        runCommandWithLog(ansibleServer, "Tạo thư mục ~/ansible-k8s", mkdirCmd, logs);

        // 3.6. Tạo file hosts.ini với thông tin từ database trên máy ANSIBLE
        // Format theo mẫu đã test thành công: master ansible_host=IP ansible_user=username
        String createHostsIniCmd = "cd ~/ansible-k8s && cat > hosts.ini << 'HOSTS_EOF'\n" +
                "[k8s_masters]\n";
        for (ServerEntity master : masters) {
            createHostsIniCmd += String.format("master ansible_host=%s ansible_user=%s\n",
                    master.getIp(), master.getUsername());
        }
        createHostsIniCmd += "\n[k8s_workers]\n";
        List<ServerEntity> workers = masterAndWorker.stream()
                .filter(s -> "WORKER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());
        int workerIndex = 1;
        for (ServerEntity worker : workers) {
            createHostsIniCmd += String.format("worker%d ansible_host=%s ansible_user=%s\n",
                    workerIndex++, worker.getIp(), worker.getUsername());
        }
        createHostsIniCmd += "\n[k8s_all:children]\n" +
                "k8s_masters\n" +
                "k8s_workers\n" +
                "\n[k8s_all:vars]\n" +
                "ansible_python_interpreter=/usr/bin/python3\n" +
                "HOSTS_EOF";
        runCommandWithLog(ansibleServer, "Tạo file hosts.ini", createHostsIniCmd, logs);

        // 3.7. Tạo file ansible.cfg trên máy ANSIBLE
        String createAnsibleCfgCmd = "cd ~/ansible-k8s && cat > ansible.cfg << 'CFG_EOF'\n" +
                "[defaults]\n" +
                "inventory = ./hosts.ini\n" +
                "host_key_checking = False\n" +
                "timeout = 30\n" +
                "interpreter_python = auto_silent\n" +
                "\n" +
                "[privilege_escalation]\n" +
                "become = True\n" +
                "become_method = sudo\n" +
                "CFG_EOF";
        runCommandWithLog(ansibleServer, "Tạo file ansible.cfg", createAnsibleCfgCmd, logs);

        // 3.8. Kiểm tra kết nối với ansible all -m ping từ máy ANSIBLE
        String ansiblePingCmd = "cd ~/ansible-k8s && ansible all -m ping";
        runCommandWithLog(ansibleServer, "Kiểm tra kết nối Ansible (ansible all -m ping)", ansiblePingCmd, logs);

        logs.add("Hoàn tất cài đặt và cấu hình Ansible trên control node.");
        System.out.println("[setupAnsibleOnK8sNodes] Hoàn tất.");
        return logs;
    }

    @Override
    public List<String> installKubernetesOnK8sNodes() {
        System.out.println("[installKubernetesOnK8sNodes] Bắt đầu cài đặt Kubernetes cho các node MASTER/WORKER");
        List<ServerEntity> allServers = serverRepository.findAll();
        List<ServerEntity> masterAndWorker = allServers.stream()
                .filter(s -> {
                    String role = s.getRole() != null ? s.getRole().toUpperCase(Locale.ROOT) : "";
                    return "MASTER".equals(role) || "WORKER".equals(role);
                })
                .collect(Collectors.toList());

        List<String> logs = new ArrayList<>();

        if (masterAndWorker.isEmpty()) {
            logs.add("Không tìm thấy server nào có role MASTER hoặc WORKER.");
            System.out.println("[installKubernetesOnK8sNodes] " + logs.get(0));
            return logs;
        }

        // Tìm server ANSIBLE để chạy Ansible commands
        List<ServerEntity> ansibleServers = allServers.stream()
                .filter(s -> "ANSIBLE".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (ansibleServers.isEmpty()) {
            logs.add("Không tìm thấy server nào có role ANSIBLE để chạy Ansible.");
            System.out.println("[installKubernetesOnK8sNodes] " + logs.get(0));
            return logs;
        }

        List<ServerEntity> masters = masterAndWorker.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào.");
            System.out.println("[installKubernetesOnK8sNodes] " + logs.get(0));
            return logs;
        }

        ServerEntity ansibleServer = ansibleServers.get(0);
        ServerEntity masterNode = masters.get(0);

        if (!isServerReachable(ansibleServer)) {
            logs.add("Không thể SSH tới server ANSIBLE.");
            return logs;
        }

        logs.add("===== Bắt đầu cài đặt Kubernetes trên tất cả nodes =====");

        // Bước 1: Cập nhật hệ thống và cài tiện ích
        String step1Cmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo apt update -y && sudo apt upgrade -y && sudo apt install -y curl gnupg2 software-properties-common apt-transport-https ca-certificates conntrack\"";
        runCommandWithLog(ansibleServer, "Bước 1: Cập nhật hệ thống và cài tiện ích", step1Cmd, logs);

        // Bước 2: Tắt swap vĩnh viễn
        // 2.1: Tắt swap ngay
        String step2aCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo swapoff -a\"";
        runCommandWithLog(ansibleServer, "Bước 2.1: Tắt swap ngay", step2aCmd, logs);
        
        // 2.2: Vô hiệu hóa swap trong fstab
        String step2bCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo sed -i '\\|/swap.img|s|^|#|' /etc/fstab && sudo sed -i '\\|/swapfile|s|^|#|' /etc/fstab\"";
        runCommandWithLog(ansibleServer, "Bước 2.2: Vô hiệu hóa swap trong fstab", step2bCmd, logs);
        
        // 2.3: Xóa swapfile
        String step2cCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo rm -f /swap.img /swapfile\"";
        runCommandWithLog(ansibleServer, "Bước 2.3: Xóa swapfile", step2cCmd, logs);
        
        // 2.4: Chặn systemd kích hoạt swap
        String step2dCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo systemctl mask swap.target\"";
        runCommandWithLog(ansibleServer, "Bước 2.4: Chặn systemd kích hoạt swap", step2dCmd, logs);
        
        // 2.5: Xác nhận swap đã tắt
        String step2eCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo swapon --show\"";
        runCommandWithLog(ansibleServer, "Bước 2.5: Xác nhận swap đã tắt", step2eCmd, logs);
        
        // 2.6: Thêm user vào nhóm sudo (lấy username từ master node)
        String step2fCmd = String.format("cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo usermod -aG sudo %s\"", masterNode.getUsername());
        runCommandWithLog(ansibleServer, "Bước 2.6: Thêm user vào nhóm sudo", step2fCmd, logs);

        // Bước 3: Cấu hình kernel modules và sysctl
        String step3aCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"echo -e 'overlay\\nbr_netfilter' | sudo tee /etc/modules-load.d/containerd.conf && sudo modprobe overlay && sudo modprobe br_netfilter\"";
        runCommandWithLog(ansibleServer, "Bước 3a: Cấu hình kernel modules", step3aCmd, logs);

        String step3bCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"cat <<'EOF' | sudo tee /etc/sysctl.d/kubernetes.conf\nnet.bridge.bridge-nf-call-ip6tables = 1\nnet.bridge.bridge-nf-call-iptables = 1\nnet.ipv4.ip_forward = 1\nEOF\nsudo sysctl --system\"";
        runCommandWithLog(ansibleServer, "Bước 3b: Cấu hình sysctl", step3bCmd, logs);

        // Bước 4: Cài containerd
        String step4Cmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo apt install -y containerd\"";
        runCommandWithLog(ansibleServer, "Bước 4: Cài containerd", step4Cmd, logs);

        // Bước 5: Cấu hình containerd
        String step5Cmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo mkdir -p /etc/containerd && containerd config default | sudo tee /etc/containerd/config.toml >/dev/null && sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml && sudo systemctl enable --now containerd\"";
        runCommandWithLog(ansibleServer, "Bước 5: Cấu hình containerd", step5Cmd, logs);

        // Bước 6: Thêm repo Kubernetes và cài kubelet, kubeadm, kubectl
        String step6aCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo mkdir -p /etc/apt/keyrings && curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg\"";
        runCommandWithLog(ansibleServer, "Bước 6a: Thêm GPG key Kubernetes", step6aCmd, logs);

        String step6bCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list && sudo apt update -y\"";
        runCommandWithLog(ansibleServer, "Bước 6b: Thêm repo Kubernetes", step6bCmd, logs);

        String step6cCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo apt install -y kubelet kubeadm kubectl && sudo apt-mark hold kubelet kubeadm kubectl && sudo systemctl daemon-reload && sudo systemctl restart kubelet\"";
        runCommandWithLog(ansibleServer, "Bước 6c: Cài kubelet, kubeadm, kubectl", step6cCmd, logs);

        // Bước 7: Khởi tạo cluster trên master
        String step7Cmd = "cd ~/ansible-k8s && ansible master -m shell -a \"sudo kubeadm init\"";
        runCommandWithLog(ansibleServer, "Bước 7: Khởi tạo cluster trên master", step7Cmd, logs);

        // Bước 7.1: Đợi và kiểm tra API server đã khởi động và ổn định
        logs.add("Bước 7.1: Đợi API server khởi động và ổn định...");
        // Kiểm tra port 6443 đã lắng nghe, đợi thêm để đảm bảo ổn định
        String waitApiServerCmd = "cd ~/ansible-k8s && ansible master -m shell -a \"for i in {1..90}; do if sudo ss -lntp | grep -q ':6443'; then sleep 10; if sudo ss -lntp | grep -q ':6443'; then echo 'API server đã khởi động và ổn định'; exit 0; fi; fi; sleep 2; done; echo 'Timeout: API server chưa khởi động hoặc chưa ổn định sau 180 giây'\"";
        runCommandWithLog(ansibleServer, "Bước 7.1: Kiểm tra API server", waitApiServerCmd, logs);

        // Bước 8: Cấu hình kubectl cho user trên master
        String step8Cmd = "cd ~/ansible-k8s && ansible master -m shell -a \"mkdir -p $HOME/.kube && sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config && sudo chown $(id -u):$(id -g) $HOME/.kube/config\"";
        runCommandWithLog(ansibleServer, "Bước 8: Cấu hình kubectl", step8Cmd, logs);

        // Bước 8.1: Đợi và kiểm tra kubectl có thể kết nối đến API server ổn định
        logs.add("Bước 8.1: Đợi kubectl có thể kết nối đến API server ổn định...");
        // Kiểm tra kubectl có thể kết nối và lấy được nodes, đợi thêm để đảm bảo ổn định
        String waitKubectlCmd = "cd ~/ansible-k8s && ansible master -m shell -a \"for i in {1..90}; do if kubectl get nodes 2>/dev/null | grep -q k8s-master; then sleep 5; if kubectl get nodes 2>/dev/null | grep -q k8s-master; then echo 'kubectl đã kết nối thành công và ổn định'; exit 0; fi; fi; sleep 2; done; echo 'Timeout: kubectl chưa kết nối được sau 180 giây'\"";
        runCommandWithLog(ansibleServer, "Bước 8.1: Kiểm tra kubectl", waitKubectlCmd, logs);

        // Bước 9: Cài Calico CNI trên master
        String step9Cmd = "cd ~/ansible-k8s && ansible master -m shell -a \"kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.25.0/manifests/calico.yaml\"";
        runCommandWithLog(ansibleServer, "Bước 9: Cài Calico CNI", step9Cmd, logs);

        // Bước 9.1: Đợi Calico pods khởi động xong trên master
        logs.add("Bước 9.1: Đợi Calico pods khởi động xong...");
        String waitCalicoCmd = "cd ~/ansible-k8s && ansible master -m shell -a \"for i in {1..120}; do ready_pods=$(kubectl get pods -n kube-system --no-headers 2>/dev/null | grep calico | grep -c Running || echo 0); total_pods=$(kubectl get pods -n kube-system --no-headers 2>/dev/null | grep calico | wc -l); if [ $ready_pods -gt 0 ] && [ $ready_pods -eq $total_pods ] && [ $total_pods -gt 0 ]; then echo 'Calico pods đã khởi động xong'; exit 0; fi; sleep 3; done; echo 'Timeout: Calico pods chưa khởi động xong sau 360 giây'\"";
        runCommandWithLog(ansibleServer, "Bước 9.1: Kiểm tra Calico pods", waitCalicoCmd, logs);

        // Bước 9.2: Restart containerd, daemon-reload và restart kubelet sau khi cài Calico trên master
        String step9_2Cmd = "cd ~/ansible-k8s && ansible master -m shell -a \"sudo systemctl restart containerd && sudo systemctl daemon-reload && sudo systemctl restart kubelet\"";
        runCommandWithLog(ansibleServer, "Bước 9.2: Restart containerd, daemon-reload và restart kubelet", step9_2Cmd, logs);

        // Bước 9.3: Đợi hệ thống hoạt động ổn định sau khi restart trên master
        logs.add("Bước 9.3: Đợi hệ thống hoạt động ổn định sau khi restart...");
        String waitStableCmd = "cd ~/ansible-k8s && ansible master -m shell -a \"for i in {1..60}; do containerd_status=$(sudo systemctl is-active containerd 2>/dev/null || echo inactive); kubelet_status=$(sudo systemctl is-active kubelet 2>/dev/null || echo inactive); api_ready=false; if kubectl get nodes 2>/dev/null | grep -q k8s-master; then api_ready=true; fi; if [ \\\"$containerd_status\\\" = \\\"active\\\" ] && [ \\\"$kubelet_status\\\" = \\\"active\\\" ] && [ \\\"$api_ready\\\" = \\\"true\\\" ]; then sleep 5; if kubectl get nodes 2>/dev/null | grep -q k8s-master; then echo 'Hệ thống đã hoạt động ổn định'; exit 0; fi; fi; sleep 2; done; echo 'Timeout: Hệ thống chưa ổn định sau 120 giây'\"";
        runCommandWithLog(ansibleServer, "Bước 9.3: Kiểm tra hệ thống ổn định", waitStableCmd, logs);

        // Bước 10: Lấy join command từ master và join workers
        // SSH trực tiếp đến master để lấy join command (không qua ansible để tránh output format)
        String getJoinCmd = "kubeadm token create --print-join-command";
        ExecuteCommandResponse joinResult = executeSSHCommand(masterNode, getJoinCmd);
        
        if (joinResult.isSuccess() && joinResult.getOutput() != null) {
            // Parse output để lấy chỉ dòng chứa "kubeadm join"
            String rawOutput = joinResult.getOutput();
            String joinCommand = null;
            String[] lines = rawOutput.split("\n");
            for (String line : lines) {
                if (line.trim().startsWith("kubeadm join")) {
                    joinCommand = line.trim();
                    break;
                }
            }
            
            if (joinCommand == null) {
                // Nếu không tìm thấy, thử lấy toàn bộ output và trim
                joinCommand = rawOutput.trim();
            }
            
            logs.add("Join command: " + joinCommand);
            
            List<ServerEntity> workers = masterAndWorker.stream()
                    .filter(s -> "WORKER".equalsIgnoreCase(s.getRole()))
                    .collect(Collectors.toList());
            
            // SSH trực tiếp đến từng worker để chạy lệnh join (không qua ansible)
            for (ServerEntity worker : workers) {
                String workerJoinCmd = "sudo " + joinCommand;
                runCommandWithLog(worker, "Bước 10: Join worker " + worker.getName() + " vào cluster", workerJoinCmd, logs);
            }
            
            // Bước 10.0: Cài lại Calico CNI trên master sau khi workers join (SSH trực tiếp đến master)
            String step9_5Cmd = "kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.25.0/manifests/calico.yaml";
            runCommandWithLog(masterNode, "Bước 10.0: Cài lại Calico CNI sau khi workers join", step9_5Cmd, logs);
            
            // Bước 10.1: Kiểm tra Calico pods sau khi workers join (SSH trực tiếp đến master)
            logs.add("Bước 10.1: Kiểm tra Calico pods sau khi workers join...");
            String checkCalicoAfterJoinCmd = "for i in {1..120}; do ready_pods=$(kubectl get pods -n kube-system --no-headers 2>/dev/null | grep calico | grep -c Running || echo 0); total_pods=$(kubectl get pods -n kube-system --no-headers 2>/dev/null | grep calico | wc -l); if [ $ready_pods -gt 0 ] && [ $ready_pods -eq $total_pods ] && [ $total_pods -gt 0 ]; then echo 'Calico pods vẫn hoạt động tốt sau khi workers join'; exit 0; fi; sleep 3; done; echo 'Timeout: Calico pods chưa ổn định sau 360 giây'";
            runCommandWithLog(masterNode, "Bước 10.1: Kiểm tra Calico pods sau khi workers join", checkCalicoAfterJoinCmd, logs);
            
            // Bước 10.2: Sau khi tất cả workers join xong, restart containerd, daemon-reload và restart kubelet trên master
            String step10_1Cmd = "sudo systemctl restart containerd && sudo systemctl daemon-reload && sudo systemctl restart kubelet";
            runCommandWithLog(masterNode, "Bước 10.2: Restart containerd, daemon-reload và restart kubelet trên master sau khi workers join", step10_1Cmd, logs);

            // Bước 10.3: Đợi hệ thống hoạt động ổn định sau khi restart trên master
            logs.add("Bước 10.3: Đợi hệ thống hoạt động ổn định sau khi restart...");
            String waitStableAfterJoinCmd = "for i in {1..60}; do containerd_status=$(sudo systemctl is-active containerd 2>/dev/null || echo inactive); kubelet_status=$(sudo systemctl is-active kubelet 2>/dev/null || echo inactive); api_ready=false; if kubectl get nodes 2>/dev/null | grep -q k8s-master; then api_ready=true; fi; if [ \"$containerd_status\" = \"active\" ] && [ \"$kubelet_status\" = \"active\" ] && [ \"$api_ready\" = \"true\" ]; then sleep 5; if kubectl get nodes 2>/dev/null | grep -q k8s-master; then echo 'Hệ thống đã hoạt động ổn định'; exit 0; fi; fi; sleep 2; done; echo 'Timeout: Hệ thống chưa ổn định sau 120 giây'";
            runCommandWithLog(masterNode, "Bước 10.3: Kiểm tra hệ thống ổn định sau khi workers join", waitStableAfterJoinCmd, logs);
        } else {
            logs.add("Không thể lấy join command từ master. Error: " + (joinResult.getError() != null ? joinResult.getError() : "Unknown"));
        }

        logs.add("===== Hoàn tất cài đặt Kubernetes =====");
        System.out.println("[installKubernetesOnK8sNodes] Hoàn tất.");
        return logs;
    }

    @Override
    public List<String> installKubernetesWithKubespray() {
        System.out.println("[installKubernetesWithKubespray] Bắt đầu cài đặt Kubernetes bằng Kubespray");
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        // Tìm server ANSIBLE
        List<ServerEntity> ansibleServers = allServers.stream()
                .filter(s -> "ANSIBLE".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (ansibleServers.isEmpty()) {
            logs.add("Không tìm thấy server nào có role ANSIBLE để chạy Kubespray.");
            System.out.println("[installKubernetesWithKubespray] " + logs.get(0));
            return logs;
        }

        // Tìm các server MASTER và WORKER
        List<ServerEntity> masters = allServers.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());
        
        List<ServerEntity> workers = allServers.stream()
                .filter(s -> "WORKER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào.");
            System.out.println("[installKubernetesWithKubespray] " + logs.get(0));
            return logs;
        }

        ServerEntity ansibleServer = ansibleServers.get(0);

        if (!isServerReachable(ansibleServer)) {
            logs.add("Không thể SSH tới server ANSIBLE.");
            return logs;
        }

        logs.add("===== Bắt đầu cài đặt Kubernetes bằng Kubespray =====");
        logs.add(String.format("ANSIBLE Server: %s (%s)", ansibleServer.getName(), ansibleServer.getIp()));
        logs.add(String.format("Số MASTER nodes: %d", masters.size()));
        logs.add(String.format("Số WORKER nodes: %d", workers.size()));

        // Bước 1: Clone Kubespray repository (hoặc update nếu đã có)
        String cloneKubesprayCmd = "cd ~ && if [ -d kubespray ]; then cd kubespray && git pull; else git clone https://github.com/kubernetes-sigs/kubespray.git && cd kubespray; fi";
        runCommandWithLog(ansibleServer, "Bước 1: Clone/Update Kubespray repository", cloneKubesprayCmd, logs);

        // Bước 2: Cài đặt dependencies (Python packages)
        String installDepsCmd = "cd ~/kubespray && sudo apt-get update -y && sudo apt-get install -y python3-pip && pip3 install -r requirements.txt";
        runCommandWithLog(ansibleServer, "Bước 2: Cài đặt Kubespray dependencies", installDepsCmd, logs);

        // Bước 3: Copy sample inventory và tạo thư mục cho cluster
        String copyInventoryCmd = "cd ~/kubespray && cp -rfp inventory/sample inventory/mycluster";
        runCommandWithLog(ansibleServer, "Bước 3: Copy sample inventory", copyInventoryCmd, logs);

        // Bước 4: Tạo hosts.yaml từ thông tin các server
        String hostsYaml = buildKubesprayHostsYaml(masters, workers);
        // Escape các ký tự đặc biệt trong YAML
        String createHostsYamlCmd = String.format(
                "cd ~/kubespray && cat > inventory/mycluster/hosts.yaml << 'HOSTS_EOF'\n%s\nHOSTS_EOF",
                hostsYaml
        );
        runCommandWithLog(ansibleServer, "Bước 4: Tạo hosts.yaml inventory", createHostsYamlCmd, logs);

        // Bước 5: Hiển thị nội dung hosts.yaml để kiểm tra
        String catHostsCmd = "cd ~/kubespray && cat inventory/mycluster/hosts.yaml";
        runCommandWithLog(ansibleServer, "Bước 5: Kiểm tra nội dung hosts.yaml", catHostsCmd, logs);

        // Bước 6: Chạy Kubespray playbook để cài đặt Kubernetes
        // Sử dụng --become để chạy với quyền root
        String runPlaybookCmd = "cd ~/kubespray && ansible-playbook -i inventory/mycluster/hosts.yaml --become --become-user=root cluster.yml";
        runCommandWithLog(ansibleServer, "Bước 6: Chạy Kubespray playbook (có thể mất 15-30 phút)", runPlaybookCmd, logs);

        // Bước 7: Kiểm tra cluster đã cài đặt thành công
        // SSH đến master node đầu tiên để kiểm tra
        ServerEntity masterNode = masters.get(0);
        if (isServerReachable(masterNode)) {
            String checkClusterCmd = "mkdir -p $HOME/.kube && sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config 2>/dev/null; sudo chown $(id -u):$(id -g) $HOME/.kube/config 2>/dev/null; kubectl get nodes -o wide";
            runCommandWithLog(masterNode, "Bước 7: Kiểm tra cluster trên master", checkClusterCmd, logs);
        }

        logs.add("===== Hoàn tất cài đặt Kubernetes bằng Kubespray =====");
        System.out.println("[installKubernetesWithKubespray] Hoàn tất.");
        return logs;
    }

    /**
     * Tạo nội dung file hosts.yaml cho Kubespray inventory
     * Format theo chuẩn Kubespray inventory
     */
    private String buildKubesprayHostsYaml(List<ServerEntity> masters, List<ServerEntity> workers) {
        StringBuilder yaml = new StringBuilder();
        yaml.append("all:\n");
        yaml.append("  hosts:\n");
        
        // Thêm tất cả các nodes (masters + workers)
        int nodeIndex = 1;
        for (ServerEntity master : masters) {
            String nodeName = sanitizeHostName(master.getName());
            yaml.append(String.format("    %s:\n", nodeName));
            yaml.append(String.format("      ansible_host: %s\n", master.getIp()));
            yaml.append(String.format("      ansible_user: %s\n", master.getUsername()));
            yaml.append(String.format("      ip: %s\n", master.getIp()));
            yaml.append(String.format("      access_ip: %s\n", master.getIp()));
            nodeIndex++;
        }
        for (ServerEntity worker : workers) {
            String nodeName = sanitizeHostName(worker.getName());
            yaml.append(String.format("    %s:\n", nodeName));
            yaml.append(String.format("      ansible_host: %s\n", worker.getIp()));
            yaml.append(String.format("      ansible_user: %s\n", worker.getUsername()));
            yaml.append(String.format("      ip: %s\n", worker.getIp()));
            yaml.append(String.format("      access_ip: %s\n", worker.getIp()));
            nodeIndex++;
        }
        
        yaml.append("  children:\n");
        
        // kube_control_plane - các master nodes
        yaml.append("    kube_control_plane:\n");
        yaml.append("      hosts:\n");
        for (ServerEntity master : masters) {
            yaml.append(String.format("        %s:\n", sanitizeHostName(master.getName())));
        }
        
        // kube_node - tất cả các nodes (masters + workers)
        yaml.append("    kube_node:\n");
        yaml.append("      hosts:\n");
        for (ServerEntity master : masters) {
            yaml.append(String.format("        %s:\n", sanitizeHostName(master.getName())));
        }
        for (ServerEntity worker : workers) {
            yaml.append(String.format("        %s:\n", sanitizeHostName(worker.getName())));
        }
        
        // etcd - chạy trên master nodes
        yaml.append("    etcd:\n");
        yaml.append("      hosts:\n");
        for (ServerEntity master : masters) {
            yaml.append(String.format("        %s:\n", sanitizeHostName(master.getName())));
        }
        
        // k8s_cluster - group chứa control plane và nodes
        yaml.append("    k8s_cluster:\n");
        yaml.append("      children:\n");
        yaml.append("        kube_control_plane:\n");
        yaml.append("        kube_node:\n");
        
        // calico_rr - Calico Route Reflector (để trống)
        yaml.append("    calico_rr:\n");
        yaml.append("      hosts: {}\n");
        
        return yaml.toString();
    }

    /**
     * Chuẩn hóa tên host cho Ansible inventory
     * Loại bỏ các ký tự không hợp lệ
     */
    private String sanitizeHostName(String name) {
        if (name == null || name.isEmpty()) {
            return "node";
        }
        // Thay thế các ký tự không hợp lệ bằng dấu gạch dưới
        return name.toLowerCase().replaceAll("[^a-z0-9_-]", "_");
    }

    @Override
    public List<String> cleanupKubernetesCluster() {
        System.out.println("[cleanupKubernetesCluster] Bắt đầu gỡ cài đặt và làm sạch Kubernetes cluster");
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        // Tìm các server MASTER và WORKER
        List<ServerEntity> masterAndWorker = allServers.stream()
                .filter(s -> {
                    String role = s.getRole() != null ? s.getRole().toUpperCase(Locale.ROOT) : "";
                    return "MASTER".equals(role) || "WORKER".equals(role);
                })
                .collect(Collectors.toList());

        if (masterAndWorker.isEmpty()) {
            logs.add("Không tìm thấy server nào có role MASTER hoặc WORKER.");
            System.out.println("[cleanupKubernetesCluster] " + logs.get(0));
            return logs;
        }

        // Tìm server ANSIBLE để chạy các lệnh qua Ansible
        List<ServerEntity> ansibleServers = allServers.stream()
                .filter(s -> "ANSIBLE".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        List<ServerEntity> masters = masterAndWorker.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        List<ServerEntity> workers = masterAndWorker.stream()
                .filter(s -> "WORKER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        logs.add("===== Bắt đầu gỡ cài đặt và làm sạch Kubernetes cluster =====");
        logs.add(String.format("Số MASTER nodes: %d", masters.size()));
        logs.add(String.format("Số WORKER nodes: %d", workers.size()));

        // Nếu có server ANSIBLE, sử dụng Ansible để chạy lệnh trên tất cả nodes
        if (!ansibleServers.isEmpty()) {
            ServerEntity ansibleServer = ansibleServers.get(0);
            if (isServerReachable(ansibleServer)) {
                logs.add("Sử dụng Ansible server để cleanup: " + ansibleServer.getName());
                cleanupViaAnsible(ansibleServer, logs);
            } else {
                logs.add("Không thể kết nối đến Ansible server, chuyển sang cleanup trực tiếp.");
                cleanupDirectly(masterAndWorker, logs);
            }
        } else {
            logs.add("Không tìm thấy Ansible server, cleanup trực tiếp trên từng node.");
            cleanupDirectly(masterAndWorker, logs);
        }

        // Cập nhật clusterStatus của các server về UNASSIGNED
        logs.add("===== Cập nhật trạng thái cluster của các server =====");
        for (ServerEntity server : masterAndWorker) {
            server.setClusterStatus("UNASSIGNED");
            serverRepository.save(server);
            logs.add(String.format("Đã cập nhật %s (%s) -> clusterStatus = UNASSIGNED", server.getName(), server.getIp()));
        }

        logs.add("===== Hoàn tất gỡ cài đặt và làm sạch Kubernetes cluster =====");
        System.out.println("[cleanupKubernetesCluster] Hoàn tất.");
        return logs;
    }

    /**
     * Cleanup Kubernetes cluster thông qua Ansible server
     */
    private void cleanupViaAnsible(ServerEntity ansibleServer, List<String> logs) {
        // Bước 1: Drain và remove nodes khỏi cluster (chạy trên master)
        String drainNodesCmd = "cd ~/ansible-k8s && ansible master -m shell -a \"kubectl get nodes --no-headers -o custom-columns=':metadata.name' 2>/dev/null | while read node; do kubectl drain \\$node --ignore-daemonsets --delete-emptydir-data --force 2>/dev/null || true; kubectl delete node \\$node 2>/dev/null || true; done\" || true";
        runCommandWithLog(ansibleServer, "Bước 1: Drain và remove nodes khỏi cluster", drainNodesCmd, logs);

        // Bước 2: Reset kubeadm trên tất cả nodes (workers trước, master sau)
        String resetWorkersCmd = "cd ~/ansible-k8s && ansible k8s_workers -m shell -a \"sudo kubeadm reset -f\" || true";
        runCommandWithLog(ansibleServer, "Bước 2a: Reset kubeadm trên workers", resetWorkersCmd, logs);

        String resetMastersCmd = "cd ~/ansible-k8s && ansible k8s_masters -m shell -a \"sudo kubeadm reset -f\" || true";
        runCommandWithLog(ansibleServer, "Bước 2b: Reset kubeadm trên masters", resetMastersCmd, logs);

        // Bước 3: Dừng các services
        String stopServicesCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo systemctl stop kubelet 2>/dev/null || true; sudo systemctl stop containerd 2>/dev/null || true\"";
        runCommandWithLog(ansibleServer, "Bước 3: Dừng kubelet và containerd", stopServicesCmd, logs);

        // Bước 4: Xóa các container và images (nếu có)
        String cleanContainersCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo crictl rm -af 2>/dev/null || true; sudo crictl rmi -a 2>/dev/null || true\"";
        runCommandWithLog(ansibleServer, "Bước 4: Xóa containers và images", cleanContainersCmd, logs);

        // Bước 5: Xóa các thư mục và file cấu hình Kubernetes
        String cleanK8sFilesCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"" +
                "sudo rm -rf /etc/kubernetes /var/lib/kubelet /var/lib/etcd /var/lib/cni /etc/cni /opt/cni " +
                "$HOME/.kube /var/run/kubernetes /var/lib/dockershim /var/run/calico " +
                "/etc/containerd/config.toml.bak\"";
        runCommandWithLog(ansibleServer, "Bước 5: Xóa thư mục cấu hình Kubernetes", cleanK8sFilesCmd, logs);

        // Bước 6: Gỡ cài đặt kubelet, kubeadm, kubectl
        String uninstallK8sCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"" +
                "sudo apt-mark unhold kubelet kubeadm kubectl 2>/dev/null || true; " +
                "sudo apt-get purge -y kubelet kubeadm kubectl 2>/dev/null || true; " +
                "sudo apt-get autoremove -y 2>/dev/null || true\"";
        runCommandWithLog(ansibleServer, "Bước 6: Gỡ cài đặt kubelet, kubeadm, kubectl", uninstallK8sCmd, logs);

        // Bước 7: Xóa repo Kubernetes
        String removeK8sRepoCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"" +
                "sudo rm -f /etc/apt/sources.list.d/kubernetes.list /etc/apt/keyrings/kubernetes-apt-keyring.gpg\"";
        runCommandWithLog(ansibleServer, "Bước 7: Xóa Kubernetes repository", removeK8sRepoCmd, logs);

        // Bước 8: Reset cấu hình mạng (iptables, ipvs)
        String resetNetworkCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"" +
                "sudo iptables -F && sudo iptables -t nat -F && sudo iptables -t mangle -F && sudo iptables -X; " +
                "sudo ipvsadm -C 2>/dev/null || true; " +
                "sudo ip link delete cni0 2>/dev/null || true; " +
                "sudo ip link delete flannel.1 2>/dev/null || true; " +
                "sudo ip link delete tunl0 2>/dev/null || true; " +
                "sudo ip link delete vxlan.calico 2>/dev/null || true\"";
        runCommandWithLog(ansibleServer, "Bước 8: Reset cấu hình mạng", resetNetworkCmd, logs);

        // Bước 9: Unmask swap và bật lại swap (tùy chọn)
        String unmaskSwapCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"sudo systemctl unmask swap.target 2>/dev/null || true\"";
        runCommandWithLog(ansibleServer, "Bước 9: Unmask swap target", unmaskSwapCmd, logs);

        // Bước 10: Restart containerd để đảm bảo sạch
        String restartContainerdCmd = "cd ~/ansible-k8s && ansible k8s_all -m shell -a \"" +
                "sudo mkdir -p /etc/containerd; " +
                "containerd config default | sudo tee /etc/containerd/config.toml >/dev/null; " +
                "sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml; " +
                "sudo systemctl restart containerd\"";
        runCommandWithLog(ansibleServer, "Bước 10: Reset và restart containerd", restartContainerdCmd, logs);
    }

    /**
     * Cleanup Kubernetes cluster trực tiếp trên từng node (không qua Ansible)
     */
    private void cleanupDirectly(List<ServerEntity> servers, List<String> logs) {
        for (ServerEntity server : servers) {
            String header = String.format("===== Cleanup server %s (%s) role=%s =====",
                    server.getName(), server.getIp(), server.getRole());
            logs.add(header);
            System.out.println("[cleanupKubernetesCluster] " + header);

            if (!isServerReachable(server)) {
                logs.add("  - Không thể SSH tới server, bỏ qua.");
                continue;
            }

            // Reset kubeadm
            String resetCmd = "sudo kubeadm reset -f 2>/dev/null || true";
            runCommandWithLog(server, "Reset kubeadm", resetCmd, logs);

            // Dừng services
            String stopCmd = "sudo systemctl stop kubelet 2>/dev/null || true; sudo systemctl stop containerd 2>/dev/null || true";
            runCommandWithLog(server, "Dừng kubelet và containerd", stopCmd, logs);

            // Xóa containers
            String cleanContainersCmd = "sudo crictl rm -af 2>/dev/null || true; sudo crictl rmi -a 2>/dev/null || true";
            runCommandWithLog(server, "Xóa containers và images", cleanContainersCmd, logs);

            // Xóa thư mục cấu hình
            String cleanFilesCmd = "sudo rm -rf /etc/kubernetes /var/lib/kubelet /var/lib/etcd /var/lib/cni /etc/cni /opt/cni $HOME/.kube /var/run/kubernetes /var/lib/dockershim /var/run/calico";
            runCommandWithLog(server, "Xóa thư mục cấu hình", cleanFilesCmd, logs);

            // Gỡ cài đặt packages
            String uninstallCmd = "sudo apt-mark unhold kubelet kubeadm kubectl 2>/dev/null || true; sudo apt-get purge -y kubelet kubeadm kubectl 2>/dev/null || true; sudo apt-get autoremove -y 2>/dev/null || true";
            runCommandWithLog(server, "Gỡ cài đặt kubelet, kubeadm, kubectl", uninstallCmd, logs);

            // Xóa repo
            String removeRepoCmd = "sudo rm -f /etc/apt/sources.list.d/kubernetes.list /etc/apt/keyrings/kubernetes-apt-keyring.gpg";
            runCommandWithLog(server, "Xóa Kubernetes repository", removeRepoCmd, logs);

            // Reset mạng
            String resetNetCmd = "sudo iptables -F && sudo iptables -t nat -F && sudo iptables -t mangle -F && sudo iptables -X; " +
                    "sudo ipvsadm -C 2>/dev/null || true; " +
                    "sudo ip link delete cni0 2>/dev/null || true; " +
                    "sudo ip link delete flannel.1 2>/dev/null || true; " +
                    "sudo ip link delete tunl0 2>/dev/null || true; " +
                    "sudo ip link delete vxlan.calico 2>/dev/null || true";
            runCommandWithLog(server, "Reset cấu hình mạng", resetNetCmd, logs);

            // Reset containerd
            String resetContainerdCmd = "sudo mkdir -p /etc/containerd; containerd config default | sudo tee /etc/containerd/config.toml >/dev/null; " +
                    "sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml; sudo systemctl restart containerd";
            runCommandWithLog(server, "Reset và restart containerd", resetContainerdCmd, logs);
        }
    }

    @Override
    public List<String> installK8sAddons() {
        System.out.println("[installK8sAddons] Bắt đầu cài đặt MetalLB, NGINX Ingress Controller và StorageClass");
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        // Tìm server MASTER
        List<ServerEntity> masters = allServers.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào.");
            System.out.println("[installK8sAddons] " + logs.get(0));
            return logs;
        }

        ServerEntity masterNode = masters.get(0);

        if (!isServerReachable(masterNode)) {
            logs.add("Không thể SSH tới server MASTER: " + masterNode.getName());
            return logs;
        }

        logs.add("===== Bắt đầu cài đặt Kubernetes Addons trên " + masterNode.getName() + " =====");

        // ==================== METALLB ====================
        logs.add("");
        logs.add("===== 1. CÀI ĐẶT METALLB =====");

        // Bước 1.1: Bật strict ARP mode cho kube-proxy (yêu cầu của MetalLB)
        String enableStrictArpCmd = "kubectl get configmap kube-proxy -n kube-system -o yaml | " +
                "sed -e 's/strictARP: false/strictARP: true/' | " +
                "kubectl apply -f - -n kube-system";
        runCommandWithLog(masterNode, "Bước 1.1: Bật strict ARP mode cho kube-proxy", enableStrictArpCmd, logs);

        // Bước 1.2: Cài đặt MetalLB
        String installMetalLBCmd = "kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.12/config/manifests/metallb-native.yaml";
        runCommandWithLog(masterNode, "Bước 1.2: Cài đặt MetalLB v0.13.12", installMetalLBCmd, logs);

        // Bước 1.3: Đợi MetalLB controller và speaker pods sẵn sàng
        String waitMetalLBCmd = "for i in {1..60}; do " +
                "controller=$(kubectl get pods -n metallb-system -l app=metallb,component=controller --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "speaker=$(kubectl get pods -n metallb-system -l app=metallb,component=speaker --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "if [ $controller -gt 0 ] && [ $speaker -gt 0 ]; then echo 'MetalLB pods đã sẵn sàng'; exit 0; fi; " +
                "sleep 5; done; echo 'Timeout: MetalLB pods chưa sẵn sàng'";
        runCommandWithLog(masterNode, "Bước 1.3: Đợi MetalLB pods sẵn sàng", waitMetalLBCmd, logs);

        // Bước 1.4: Tạo IPAddressPool cho MetalLB (sử dụng dải IP của master)
        // Lấy IP của master và tạo dải IP pool (ví dụ: 172.16.123.240-172.16.123.250)
        String masterIp = masterNode.getIp();
        String[] ipParts = masterIp.split("\\.");
        String ipPrefix = ipParts[0] + "." + ipParts[1] + "." + ipParts[2];
        String ipPoolStart = ipPrefix + ".240";
        String ipPoolEnd = ipPrefix + ".250";

        String createIPPoolCmd = "cat <<EOF | kubectl apply -f -\n" +
                "apiVersion: metallb.io/v1beta1\n" +
                "kind: IPAddressPool\n" +
                "metadata:\n" +
                "  name: default-pool\n" +
                "  namespace: metallb-system\n" +
                "spec:\n" +
                "  addresses:\n" +
                "  - " + ipPoolStart + "-" + ipPoolEnd + "\n" +
                "EOF";
        runCommandWithLog(masterNode, "Bước 1.4: Tạo IPAddressPool (" + ipPoolStart + "-" + ipPoolEnd + ")", createIPPoolCmd, logs);

        // Bước 1.5: Tạo L2Advertisement cho MetalLB
        String createL2AdvCmd = "cat <<EOF | kubectl apply -f -\n" +
                "apiVersion: metallb.io/v1beta1\n" +
                "kind: L2Advertisement\n" +
                "metadata:\n" +
                "  name: default-l2-advertisement\n" +
                "  namespace: metallb-system\n" +
                "spec:\n" +
                "  ipAddressPools:\n" +
                "  - default-pool\n" +
                "EOF";
        runCommandWithLog(masterNode, "Bước 1.5: Tạo L2Advertisement", createL2AdvCmd, logs);

        // ==================== NGINX INGRESS CONTROLLER ====================
        logs.add("");
        logs.add("===== 2. CÀI ĐẶT NGINX INGRESS CONTROLLER =====");

        // Bước 2.1: Cài đặt NGINX Ingress Controller
        String installNginxIngressCmd = "kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/baremetal/deploy.yaml";
        runCommandWithLog(masterNode, "Bước 2.1: Cài đặt NGINX Ingress Controller v1.9.4", installNginxIngressCmd, logs);

        // Bước 2.2: Đợi NGINX Ingress Controller pods sẵn sàng
        String waitNginxCmd = "for i in {1..90}; do " +
                "ready=$(kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "if [ $ready -gt 0 ]; then echo 'NGINX Ingress Controller đã sẵn sàng'; exit 0; fi; " +
                "sleep 5; done; echo 'Timeout: NGINX Ingress Controller chưa sẵn sàng'";
        runCommandWithLog(masterNode, "Bước 2.2: Đợi NGINX Ingress Controller sẵn sàng", waitNginxCmd, logs);

        // Bước 2.3: Patch service ingress-nginx-controller thành LoadBalancer để sử dụng MetalLB
        String patchNginxServiceCmd = "kubectl patch svc ingress-nginx-controller -n ingress-nginx " +
                "-p '{\"spec\": {\"type\": \"LoadBalancer\"}}'";
        runCommandWithLog(masterNode, "Bước 2.3: Chuyển NGINX Ingress Service sang LoadBalancer", patchNginxServiceCmd, logs);

        // Bước 2.4: Đợi External IP được cấp phát
        String waitExternalIPCmd = "for i in {1..30}; do " +
                "external_ip=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null); " +
                "if [ -n \"$external_ip\" ]; then echo \"NGINX Ingress External IP: $external_ip\"; exit 0; fi; " +
                "sleep 3; done; echo 'Chưa có External IP (có thể cần kiểm tra MetalLB)'";
        runCommandWithLog(masterNode, "Bước 2.4: Kiểm tra External IP", waitExternalIPCmd, logs);

        // ==================== STORAGECLASS (LOCAL PATH PROVISIONER) ====================
        logs.add("");
        logs.add("===== 3. CÀI ĐẶT STORAGECLASS (LOCAL PATH PROVISIONER) =====");

        // Bước 3.1: Cài đặt Local Path Provisioner (Rancher)
        String installLocalPathCmd = "kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.26/deploy/local-path-storage.yaml";
        runCommandWithLog(masterNode, "Bước 3.1: Cài đặt Local Path Provisioner v0.0.26", installLocalPathCmd, logs);

        // Bước 3.2: Đợi Local Path Provisioner pods sẵn sàng
        String waitLocalPathCmd = "for i in {1..60}; do " +
                "ready=$(kubectl get pods -n local-path-storage --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "if [ $ready -gt 0 ]; then echo 'Local Path Provisioner đã sẵn sàng'; exit 0; fi; " +
                "sleep 5; done; echo 'Timeout: Local Path Provisioner chưa sẵn sàng'";
        runCommandWithLog(masterNode, "Bước 3.2: Đợi Local Path Provisioner sẵn sàng", waitLocalPathCmd, logs);

        // Bước 3.3: Đặt local-path làm default StorageClass
        String setDefaultStorageClassCmd = "kubectl patch storageclass local-path " +
                "-p '{\"metadata\": {\"annotations\":{\"storageclass.kubernetes.io/is-default-class\":\"true\"}}}'";
        runCommandWithLog(masterNode, "Bước 3.3: Đặt local-path làm default StorageClass", setDefaultStorageClassCmd, logs);

        // ==================== KIỂM TRA KẾT QUẢ ====================
        logs.add("");
        logs.add("===== 4. KIỂM TRA KẾT QUẢ CÀI ĐẶT =====");

        // Kiểm tra MetalLB
        String checkMetalLBCmd = "kubectl get pods -n metallb-system";
        runCommandWithLog(masterNode, "Kiểm tra MetalLB pods", checkMetalLBCmd, logs);

        // Kiểm tra NGINX Ingress
        String checkNginxCmd = "kubectl get pods -n ingress-nginx && kubectl get svc -n ingress-nginx";
        runCommandWithLog(masterNode, "Kiểm tra NGINX Ingress Controller", checkNginxCmd, logs);

        // Kiểm tra StorageClass
        String checkStorageClassCmd = "kubectl get storageclass && kubectl get pods -n local-path-storage";
        runCommandWithLog(masterNode, "Kiểm tra StorageClass", checkStorageClassCmd, logs);

        logs.add("");
        logs.add("===== Hoàn tất cài đặt Kubernetes Addons =====");
        System.out.println("[installK8sAddons] Hoàn tất.");
        return logs;
    }

    @Override
    public List<String> installMetricsServer() {
        System.out.println("[installMetricsServer] Bắt đầu cài đặt Metrics Server");
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        // Tìm server MASTER
        List<ServerEntity> masters = allServers.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào.");
            System.out.println("[installMetricsServer] " + logs.get(0));
            return logs;
        }

        ServerEntity masterNode = masters.get(0);

        if (!isServerReachable(masterNode)) {
            logs.add("Không thể SSH tới server MASTER: " + masterNode.getName());
            return logs;
        }

        logs.add("===== Bắt đầu cài đặt Metrics Server trên " + masterNode.getName() + " =====");

        // Bước 1: Cài đặt Metrics Server
        // Sử dụng manifest từ Kubernetes SIG (Special Interest Group)
        // Version v0.6.4 là version ổn định và tương thích với Kubernetes 1.30
        String installMetricsServerCmd = "kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml";
        runCommandWithLog(masterNode, "Bước 1: Cài đặt Metrics Server", installMetricsServerCmd, logs);

        // Bước 2: Patch Metrics Server để bỏ qua kiểm tra TLS cho self-signed certificates
        // Cần thiết cho môi trường bare-metal hoặc development
        String patchMetricsServerCmd = "kubectl patch deployment metrics-server -n kube-system --type='json' " +
                "-p='[{\"op\": \"add\", \"path\": \"/spec/template/spec/containers/0/args/-\", \"value\": \"--kubelet-insecure-tls\"}]'";
        runCommandWithLog(masterNode, "Bước 2: Patch Metrics Server để bỏ qua TLS verification", patchMetricsServerCmd, logs);

        // Bước 3: Đợi Metrics Server pods sẵn sàng
        logs.add("Bước 3: Đợi Metrics Server pods sẵn sàng...");
        String waitMetricsServerCmd = "for i in {1..60}; do " +
                "ready=$(kubectl get pods -n kube-system -l k8s-app=metrics-server --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "if [ $ready -gt 0 ]; then echo 'Metrics Server đã sẵn sàng'; exit 0; fi; " +
                "sleep 5; done; echo 'Timeout: Metrics Server chưa sẵn sàng'";
        runCommandWithLog(masterNode, "Bước 3: Kiểm tra Metrics Server pods", waitMetricsServerCmd, logs);

        // Bước 4: Kiểm tra Metrics Server hoạt động bằng lệnh kubectl top nodes
        logs.add("Bước 4: Kiểm tra Metrics Server hoạt động...");
        String testMetricsCmd = "kubectl top nodes 2>/dev/null && echo 'Metrics Server hoạt động bình thường' || echo 'Metrics Server chưa sẵn sàng, có thể cần đợi thêm'";
        runCommandWithLog(masterNode, "Bước 4: Kiểm tra kubectl top nodes", testMetricsCmd, logs);

        // Bước 5: Kiểm tra kubectl top pods
        String testPodsMetricsCmd = "kubectl top pods --all-namespaces 2>/dev/null | head -5 && echo '...' || echo 'Chưa có pods để hiển thị metrics'";
        runCommandWithLog(masterNode, "Bước 5: Kiểm tra kubectl top pods", testPodsMetricsCmd, logs);

        // ==================== KIỂM TRA KẾT QUẢ ====================
        logs.add("");
        logs.add("===== KIỂM TRA KẾT QUẢ CÀI ĐẶT =====");

        // Kiểm tra Metrics Server pods
        String checkMetricsServerCmd = "kubectl get pods -n kube-system -l k8s-app=metrics-server";
        runCommandWithLog(masterNode, "Kiểm tra Metrics Server pods", checkMetricsServerCmd, logs);

        // Kiểm tra Metrics Server deployment
        String checkDeploymentCmd = "kubectl get deployment metrics-server -n kube-system";
        runCommandWithLog(masterNode, "Kiểm tra Metrics Server deployment", checkDeploymentCmd, logs);

        logs.add("");
        logs.add("===== Hoàn tất cài đặt Metrics Server =====");
        logs.add("Lưu ý: Metrics Server cần vài phút để thu thập metrics. Sử dụng 'kubectl top nodes' và 'kubectl top pods' để kiểm tra.");
        System.out.println("[installMetricsServer] Hoàn tất.");
        return logs;
    }

    @Override
    public List<String> installDocker() {
        System.out.println("[installDocker] Bắt đầu cài đặt Docker trên server DOCKER");
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        // Tìm server có role DOCKER
        List<ServerEntity> dockerServers = allServers.stream()
                .filter(s -> "DOCKER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (dockerServers.isEmpty()) {
            logs.add("Không tìm thấy server nào có role DOCKER để cài đặt Docker.");
            System.out.println("[installDocker] " + logs.get(0));
            return logs;
        }

        ServerEntity dockerServer = dockerServers.get(0);
        String header = String.format("===== Cài đặt Docker trên server %s (%s) =====",
                dockerServer.getName(), dockerServer.getIp());
        logs.add(header);
        System.out.println("[installDocker] " + header);

        if (!isServerReachable(dockerServer)) {
            String msg = "Không thể SSH tới server DOCKER, bỏ qua cài đặt Docker.";
            logs.add("  - " + msg);
            System.err.println("[installDocker] " + msg + " server=" + dockerServer.getName());
            return logs;
        }

        // Bước 1: Cập nhật hệ thống và cài các gói cần thiết
        String step1Cmd = String.join(" && ",
                "sudo apt-get update -y",
                "sudo apt-get install -y ca-certificates curl gnupg lsb-release"
        );
        runCommandWithLog(dockerServer, "Bước 1: Cập nhật hệ thống và cài các gói cần thiết", step1Cmd, logs);

        // Bước 2: Thêm Docker's official GPG key
        String step2Cmd = String.join(" && ",
                "sudo mkdir -p /etc/apt/keyrings",
                "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg",
                "sudo chmod a+r /etc/apt/keyrings/docker.gpg"
        );
        runCommandWithLog(dockerServer, "Bước 2: Thêm Docker's official GPG key", step2Cmd, logs);

        // Bước 3: Thêm Docker repository
        String step3Cmd = String.join(" && ",
                "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null",
                "sudo apt-get update -y"
        );
        runCommandWithLog(dockerServer, "Bước 3: Thêm Docker repository và cập nhật", step3Cmd, logs);

        // Bước 4: Cài đặt Docker Engine, Docker CLI, và containerd
        String step4Cmd = "sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin";
        runCommandWithLog(dockerServer, "Bước 4: Cài đặt Docker Engine và các plugin", step4Cmd, logs);

        // Bước 5: Thêm user vào docker group để chạy docker không cần sudo
        String step5Cmd = String.format(
                "sudo usermod -aG docker %s",
                dockerServer.getUsername()
        );
        runCommandWithLog(dockerServer, "Bước 5: Thêm user vào docker group", step5Cmd, logs);

        // Bước 6: Khởi động và enable Docker service
        String step6Cmd = String.join(" && ",
                "sudo systemctl start docker",
                "sudo systemctl enable docker",
                "sudo systemctl status docker --no-pager"
        );
        runCommandWithLog(dockerServer, "Bước 6: Khởi động và enable Docker service", step6Cmd, logs);

        // Bước 7: Kiểm tra cài đặt Docker
        String step7Cmd = "docker --version && docker ps";
        runCommandWithLog(dockerServer, "Bước 7: Kiểm tra cài đặt Docker", step7Cmd, logs);

        // Bước 8: Kiểm tra user có thể chạy docker không cần sudo
        // Lưu ý: Cần logout và login lại hoặc dùng newgrp để áp dụng group mới
        // Test bằng cách chạy docker ps không có sudo
        String step8Cmd = "docker ps 2>&1 || echo 'Lưu ý: Có thể cần logout và login lại để áp dụng thay đổi group'";
        runCommandWithLog(dockerServer, "Bước 8: Kiểm tra chạy docker không cần sudo", step8Cmd, logs);

        logs.add("");
        logs.add("===== Hoàn tất cài đặt Docker =====");
        logs.add(String.format("Docker đã được cài đặt trên server %s (%s)", dockerServer.getName(), dockerServer.getIp()));
        logs.add("Lưu ý: Nếu không thể chạy 'docker' không cần sudo, vui lòng logout và login lại để áp dụng thay đổi group.");
        System.out.println("[installDocker] Hoàn tất.");
        return logs;
    }

    /**
     * Tạo server mới
     * @param request Thông tin request để tạo server
     * @return Response chứa thông tin server đã tạo
     * @throws RuntimeException Nếu có lỗi trong quá trình tạo server
     */
    @Override
    public CreateServerResponse createServer(CreateServerRequest request) {
        System.out.println("[createServer] Bắt đầu tạo server mới với name: " + request.getName());
        
        // Validate role (MASTER, WORKER, DOCKER, DATABASE)
        System.out.println("[createServer] Kiểm tra role: " + request.getRole());
        String role = request.getRole().toUpperCase();
        if (!"MASTER".equals(role) && !"WORKER".equals(role) && 
            !"DOCKER".equals(role) && !"DATABASE".equals(role)) {
            System.err.println("[createServer] Lỗi: Role không hợp lệ: " + role);
            throw new RuntimeException("Role không hợp lệ. Chỉ hỗ trợ MASTER, WORKER, DOCKER, DATABASE");
        }
        System.out.println("[createServer] Role hợp lệ: " + role);

        // Validate server status (RUNNING, STOPPED, BUILDING, ERROR)
        System.out.println("[createServer] Kiểm tra server status: " + request.getServerStatus());
        String serverStatus = request.getServerStatus().toUpperCase();
        if (!"RUNNING".equals(serverStatus) && !"STOPPED".equals(serverStatus) && 
            !"BUILDING".equals(serverStatus) && !"ERROR".equals(serverStatus)) {
            System.err.println("[createServer] Lỗi: Server status không hợp lệ: " + serverStatus);
            throw new RuntimeException("Server status không hợp lệ. Chỉ hỗ trợ RUNNING, STOPPED, BUILDING, ERROR");
        }
        System.out.println("[createServer] Server status hợp lệ: " + serverStatus);

        // Mặc định cluster status là UNASSIGNED khi mới tạo
        final String clusterStatus = "UNASSIGNED";
        System.out.println("[createServer] Cluster status được đặt mặc định: " + clusterStatus);

        // Tạo ServerEntity mới
        System.out.println("[createServer] Tạo ServerEntity mới");
        ServerEntity serverEntity = new ServerEntity();
        serverEntity.setName(request.getName());
        serverEntity.setIp(request.getIp());
        serverEntity.setPort(request.getPort());
        serverEntity.setUsername(request.getUsername());
        serverEntity.setPassword(request.getPassword());
        serverEntity.setRole(role);
        serverEntity.setServerStatus(serverStatus);
        serverEntity.setClusterStatus(clusterStatus);
        System.out.println("[createServer] Đã thiết lập thông tin server: name=" + request.getName() + 
                          ", ip=" + request.getIp() + ", port=" + request.getPort() + 
                          ", role=" + role + ", serverStatus=" + serverStatus + ", clusterStatus=" + clusterStatus);

        // Lưu vào database
        System.out.println("[createServer] Lưu server vào database");
        ServerEntity savedServer = serverRepository.save(serverEntity);
        System.out.println("[createServer] Đã lưu server thành công với ID: " + savedServer.getId());

        // Tạo response
        System.out.println("[createServer] Tạo CreateServerResponse");
        CreateServerResponse response = new CreateServerResponse();
        response.setId(savedServer.getId());
        response.setName(savedServer.getName());
        response.setIp(savedServer.getIp());
        response.setPort(savedServer.getPort());
        response.setUsername(savedServer.getUsername());
        response.setRole(savedServer.getRole());
        response.setServerStatus(savedServer.getServerStatus());
        response.setClusterStatus(savedServer.getClusterStatus());
        response.setCreatedAt(savedServer.getCreatedAt());

        System.out.println("[createServer] Hoàn tất tạo server thành công: name=" + savedServer.getName() + 
                          ", id=" + savedServer.getId() + ", role=" + savedServer.getRole());
        return response;
    }

    private ServerResponse mapToResponse(ServerEntity serverEntity) {
        ServerResponse response = new ServerResponse();
        response.setId(serverEntity.getId());
        response.setName(serverEntity.getName());
        response.setIp(serverEntity.getIp());
        response.setPort(serverEntity.getPort());
        response.setUsername(serverEntity.getUsername());
        response.setRole(serverEntity.getRole());
        response.setServerStatus(serverEntity.getServerStatus());
        response.setClusterStatus(serverEntity.getClusterStatus());
        response.setCreatedAt(serverEntity.getCreatedAt());
        
        // Khởi tạo giá trị mặc định cho resource info
        response.setCpu(new ServerResponse.ResourceInfo(0, 0));
        response.setMemory(new ServerResponse.ResourceInfo(0, 0));
        response.setDisk(new ServerResponse.ResourceInfo(0, 0));
        
        return response;
    }

    private List<ServerResponse> mapServersWithMetrics(List<ServerEntity> servers) {
        return servers.stream()
                .map(server -> {
                    ServerResponse response = mapToResponse(server);
                    fetchServerMetrics(server, response);
                    return response;
                })
                .collect(Collectors.toList());
    }
    
    /**
     * Lấy thông tin tài nguyên (CPU, Memory, Disk) từ server qua SSH
     * @param server Entity chứa thông tin kết nối server
     * @param response Response object để cập nhật thông tin tài nguyên
     */
    private void fetchServerMetrics(ServerEntity server, ServerResponse response) {
        System.out.println("[fetchServerMetrics] Đang lấy metrics từ server: " + server.getName() + " (" + server.getIp() + ")");

        if (!isServerReachable(server)) {
            System.err.println("[fetchServerMetrics] Không thể kết nối SSH tới server: " + server.getName());
            updateServerStatus(server, "STOPPED");
            return;
        }

        updateServerStatus(server, "RUNNING");

        try {
            fetchCpuMetrics(server, response);
        } catch (Exception e) {
            System.err.println("[fetchServerMetrics] Lỗi khi lấy CPU metrics từ server " + server.getName() + ": " + e.getMessage());
        }

        try {
            fetchMemoryMetrics(server, response);
        } catch (Exception e) {
            System.err.println("[fetchServerMetrics] Lỗi khi lấy Memory metrics từ server " + server.getName() + ": " + e.getMessage());
        }

        try {
            fetchDiskMetrics(server, response);
        } catch (Exception e) {
            System.err.println("[fetchServerMetrics] Lỗi khi lấy Disk metrics từ server " + server.getName() + ": " + e.getMessage());
        }

        System.out.println("[fetchServerMetrics] Đã lấy metrics xong cho server: " + server.getName());
    }
    
    /**
     * Lấy thông tin CPU từ server qua SSH
     * Sử dụng lệnh: nproc (số cores) và top/mpstat để lấy % sử dụng
     */
    private void fetchCpuMetrics(ServerEntity server, ServerResponse response) {
        try {
            // Lấy tổng số CPU cores
            String cpuTotalCmd = "nproc";
            ExecuteCommandResponse cpuTotalResult = executeSSHCommand(server, cpuTotalCmd);
            
            double cpuTotal = 0;
            if (cpuTotalResult.isSuccess() && cpuTotalResult.getOutput() != null) {
                cpuTotal = Double.parseDouble(cpuTotalResult.getOutput().trim());
            }
            
            // Lấy % CPU đang sử dụng (dùng top -bn1 để lấy snapshot)
            // Lệnh này lấy idle%, sau đó tính used% = 100 - idle%
            String cpuUsedCmd = "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1";
            ExecuteCommandResponse cpuUsedResult = executeSSHCommand(server, cpuUsedCmd);
            
            double cpuUsedPercent = 0;
            if (cpuUsedResult.isSuccess() && cpuUsedResult.getOutput() != null && !cpuUsedResult.getOutput().trim().isEmpty()) {
                try {
                    cpuUsedPercent = Double.parseDouble(cpuUsedResult.getOutput().trim());
                } catch (NumberFormatException e) {
                    // Thử cách khác nếu format không đúng
                    String altCmd = "grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}'";
                    ExecuteCommandResponse altResult = executeSSHCommand(server, altCmd);
                    if (altResult.isSuccess() && altResult.getOutput() != null) {
                        cpuUsedPercent = Double.parseDouble(altResult.getOutput().trim());
                    }
                }
            }
            
            // Tính số cores đang sử dụng dựa trên % sử dụng
            double cpuUsed = (cpuUsedPercent / 100.0) * cpuTotal;
            
            response.setCpu(new ServerResponse.ResourceInfo(
                roundToThreeDecimals(cpuUsed), // Làm tròn 3 chữ số thập phân
                roundToThreeDecimals(cpuTotal)  // Làm tròn 3 chữ số thập phân
            ));
            
            System.out.println("[fetchCpuMetrics] Server " + server.getName() + ": CPU " + cpuUsed + "/" + cpuTotal + " cores");
        } catch (Exception e) {
            System.err.println("[fetchCpuMetrics] Lỗi khi lấy CPU metrics: " + e.getMessage());
        }
    }
    
    /**
     * Lấy thông tin Memory từ server qua SSH
     * Sử dụng lệnh: free (theo KB) để lấy giá trị chính xác, sau đó chuyển sang GB
     * free -g chỉ làm tròn xuống số nguyên, không có giá trị lẻ
     */
    private void fetchMemoryMetrics(ServerEntity server, ServerResponse response) {
        try {
            // Lấy thông tin memory: total và used (theo KB để có giá trị chính xác)
            // Sau đó chia cho 1024^2 = 1,048,576 để chuyển sang GB (có số thập phân)
            String memCmd = "free | awk '/Mem:/ {print $2,$3}'";
            ExecuteCommandResponse memResult = executeSSHCommand(server, memCmd);
            
            if (memResult.isSuccess() && memResult.getOutput() != null) {
                String[] parts = memResult.getOutput().trim().split("\\s+");
                if (parts.length >= 2) {
                    // Parse từ KB sang GB: chia cho 1024^2 = 1,048,576
                    long memTotalKB = Long.parseLong(parts[0]);
                    long memUsedKB = Long.parseLong(parts[1]);
                    
                    // Chuyển đổi KB sang GB (1 GB = 1024^2 KB = 1,048,576 KB)
                    double memTotal = memTotalKB / 1048576.0;
                    double memUsed = memUsedKB / 1048576.0;
                    
                    response.setMemory(new ServerResponse.ResourceInfo(
                        roundToThreeDecimals(memUsed),  // Làm tròn 3 chữ số thập phân
                        roundToThreeDecimals(memTotal)  // Làm tròn 3 chữ số thập phân
                    ));
                    System.out.println("[fetchMemoryMetrics] Server " + server.getName() + ": Memory " + memUsed + "/" + memTotal + " GB");
                }
            }
        } catch (Exception e) {
            System.err.println("[fetchMemoryMetrics] Lỗi khi lấy Memory metrics: " + e.getMessage());
        }
    }
    
    /**
     * Lấy thông tin Disk từ server qua SSH
     * Sử dụng lệnh: df -BG để lấy thông tin disk theo GB
     */
    private void fetchDiskMetrics(ServerEntity server, ServerResponse response) {
        try {
            // Lấy thông tin disk của root partition (/) theo GB
            String diskCmd = "df -BG / | awk 'NR==2 {gsub(\"G\",\"\",$2); gsub(\"G\",\"\",$3); print $2,$3}'";
            ExecuteCommandResponse diskResult = executeSSHCommand(server, diskCmd);
            
            if (diskResult.isSuccess() && diskResult.getOutput() != null) {
                String[] parts = diskResult.getOutput().trim().split("\\s+");
                if (parts.length >= 2) {
                    double diskTotal = Double.parseDouble(parts[0]);
                    double diskUsed = Double.parseDouble(parts[1]);
                    
                    response.setDisk(new ServerResponse.ResourceInfo(
                        roundToThreeDecimals(diskUsed),  // Làm tròn 3 chữ số thập phân
                        roundToThreeDecimals(diskTotal)   // Làm tròn 3 chữ số thập phân
                    ));
                    System.out.println("[fetchDiskMetrics] Server " + server.getName() + ": Disk " + diskUsed + "/" + diskTotal + " GB");
                }
            }
        } catch (Exception e) {
            System.err.println("[fetchDiskMetrics] Lỗi khi lấy Disk metrics: " + e.getMessage());
        }
    }
    
    /**
     * Làm tròn số về 3 chữ số thập phân.
     * 
     * Mục đích: Giữ format hiển thị gọn gàng, dễ đọc (ví dụ: 1.234 thay vì 1.23456789)
     * 
     * Logic: Nhân với 1000, làm tròn, rồi chia lại cho 1000
     * 
     * Ví dụ:
     * - 1.23456789 → 1.235
     * - 0.123456 → 0.123
     * - 5.0 → 5.0
     * 
     * @param value Số cần làm tròn
     * @return double đã làm tròn đến 3 chữ số thập phân
     */
    private double roundToThreeDecimals(double value) {
        // Giữ tối đa 3 chữ số thập phân để hiển thị gọn hơn
        // Math.round(value * 1000d) làm tròn đến số nguyên gần nhất
        // Chia cho 1000d để có lại số thập phân với 3 chữ số
        return Math.round(value * 1000d) / 1000d;
    }

    /**
     * Thực thi lệnh SSH đến server
     * @param server Entity chứa thông tin kết nối
     * @param command Lệnh cần thực thi
     * @return Kết quả thực thi lệnh
     */
    private ExecuteCommandResponse executeSSHCommand(ServerEntity server, String command) {
        ExecuteCommandRequest request = new ExecuteCommandRequest();
        request.setHost(server.getIp());
        request.setPort(server.getPort());
        request.setUsername(server.getUsername());
        request.setPassword(server.getPassword());
        request.setCommand(command);
        
        return sshService.executeCommand(request);
    }

    /**
     * Kiểm tra server có kết nối SSH được không
     */
    private boolean isServerReachable(ServerEntity server) {
        ExecuteCommandResponse response = executeSSHCommand(server, "echo HEALTHCHECK");
        if (response.isSuccess()) {
            return true;
        }
        System.err.println("[isServerReachable] Không thể SSH tới server " + server.getName() + ": " + response.getError());
        return false;
    }

    /**
     * Cập nhật trạng thái server nếu có thay đổi
     */
    private void updateServerStatus(ServerEntity server, String newStatus) {
        String normalizedNewStatus = newStatus == null ? "STOPPED" : newStatus.toUpperCase();
        String currentStatus = server.getServerStatus() == null ? "" : server.getServerStatus().toUpperCase();
        if (!normalizedNewStatus.equals(currentStatus)) {
            System.out.println("[updateServerStatus] Cập nhật trạng thái server " + server.getName() + " từ " + currentStatus + " -> " + normalizedNewStatus);
            server.setServerStatus(normalizedNewStatus);
            serverRepository.save(server);
        }
    }

    private void runCommandWithLog(ServerEntity server, String description, String command, List<String> logs) {
        String prefix = String.format("  - [%s] ", description);
        try {
            System.out.println("[setupAnsibleOnK8sNodes] " + description + " trên server " + server.getName());
            ExecuteCommandResponse result = executeSSHCommand(server, command);
            if (result.isSuccess()) {
                logs.add(prefix + "THÀNH CÔNG");
                if (result.getOutput() != null && !result.getOutput().isEmpty()) {
                    logs.add("      Output: " + result.getOutput().trim());
                }
            } else {
                logs.add(prefix + "THẤT BẠI");
                String err = result.getError() != null ? result.getError() : result.getOutput();
                if (err != null && !err.isEmpty()) {
                    logs.add("      Error: " + err.trim());
                }
            }
        } catch (Exception e) {
            String msg = prefix + "LỖI: " + e.getMessage();
            logs.add(msg);
            System.err.println("[setupAnsibleOnK8sNodes] " + msg);
        }
    }

    @Override
    public InstallClusterResponse installCluster(InstallClusterRequest request) {
        System.out.println("[installCluster] Bắt đầu cài đặt cluster Kubernetes");
        InstallClusterResponse response = new InstallClusterResponse();
        response.setSuccess(false);

        try {
            // ==================== BƯỚC 1: KIỂM TRA SSH ====================
            System.out.println("[installCluster] Bước 1: Kiểm tra SSH connection");
            response.getSshCheck().setRunning();
            response.getSshCheck().addLog("Bắt đầu kiểm tra kết nối SSH đến các servers...");

            List<ServerEntity> allServers = new ArrayList<>();
            List<String> sshErrors = new ArrayList<>();

            // Kiểm tra Master
            ServerEntity masterEntity = createServerEntityFromRequest(request.getMaster(), "MASTER", "IN_CLUSTER");
            if (!checkSSHConnection(masterEntity, response.getSshCheck())) {
                sshErrors.add("MASTER: " + masterEntity.getName() + " (" + masterEntity.getIp() + ")");
            }
            allServers.add(masterEntity);

            // Kiểm tra Docker
            ServerEntity dockerEntity = createServerEntityFromRequest(request.getDocker(), "DOCKER", "UNASSIGNED");
            if (!checkSSHConnection(dockerEntity, response.getSshCheck())) {
                sshErrors.add("DOCKER: " + dockerEntity.getName() + " (" + dockerEntity.getIp() + ")");
            }
            allServers.add(dockerEntity);

            // Kiểm tra Ansible
            ServerEntity ansibleEntity = createServerEntityFromRequest(request.getAnsible(), "ANSIBLE", "UNASSIGNED");
            if (!checkSSHConnection(ansibleEntity, response.getSshCheck())) {
                sshErrors.add("ANSIBLE: " + ansibleEntity.getName() + " (" + ansibleEntity.getIp() + ")");
            }
            allServers.add(ansibleEntity);

            // Kiểm tra Workers
            for (int i = 0; i < request.getWorkers().size(); i++) {
                ServerEntity workerEntity = createServerEntityFromRequest(request.getWorkers().get(i), "WORKER", "IN_CLUSTER");
                if (!checkSSHConnection(workerEntity, response.getSshCheck())) {
                    sshErrors.add("WORKER " + (i + 1) + ": " + workerEntity.getName() + " (" + workerEntity.getIp() + ")");
                }
                allServers.add(workerEntity);
            }

            if (!sshErrors.isEmpty()) {
                response.getSshCheck().setError("Không thể kết nối SSH đến: " + String.join(", ", sshErrors));
                response.setMessage("Lỗi: Không thể kết nối SSH đến một số servers");
                response.getLogs().addAll(response.getSshCheck().getLogs());
                return response;
            }
            response.getSshCheck().addLog("✓ Tất cả servers đều có thể kết nối SSH thành công!");
            response.getSshCheck().setCompleted();
            response.getLogs().addAll(response.getSshCheck().getLogs());

            // ==================== BƯỚC 2: LƯU SERVERS VÀO DATABASE ====================
            System.out.println("[installCluster] Bước 2: Lưu thông tin servers vào database");
            response.getSaveServers().setRunning();
            response.getSaveServers().addLog("Bắt đầu lưu thông tin servers vào database...");

            for (ServerEntity server : allServers) {
                try {
                    serverRepository.save(server);
                    response.getSaveServers().addLog("✓ Đã lưu server: " + server.getName() + " (" + server.getRole() + ")");
                } catch (Exception e) {
                    response.getSaveServers().addLog("✗ Lỗi khi lưu server " + server.getName() + ": " + e.getMessage());
                }
            }
            response.getSaveServers().addLog("✓ Đã lưu tất cả servers vào database!");
            response.getSaveServers().setCompleted();
            response.getLogs().addAll(response.getSaveServers().getLogs());

            // ==================== BƯỚC 3: CÀI ĐẶT ANSIBLE ====================
            System.out.println("[installCluster] Bước 3: Cài đặt Ansible");
            response.getSetupAnsible().setRunning();
            response.getSetupAnsible().addLog("Bắt đầu cài đặt Ansible...");

            try {
                List<String> ansibleLogs = setupAnsibleOnK8sNodes();
                response.getSetupAnsible().addLogs(ansibleLogs);
                response.getSetupAnsible().addLog("✓ Hoàn thành cài đặt Ansible!");
                response.getSetupAnsible().setCompleted();
            } catch (Exception e) {
                response.getSetupAnsible().setError("Lỗi khi cài đặt Ansible: " + e.getMessage());
                response.setMessage("Lỗi: Không thể cài đặt Ansible");
                response.getLogs().addAll(response.getSetupAnsible().getLogs());
                return response;
            }
            response.getLogs().addAll(response.getSetupAnsible().getLogs());

            // ==================== BƯỚC 4: CÀI ĐẶT KUBERNETES ====================
            System.out.println("[installCluster] Bước 4: Cài đặt Kubernetes với Kubespray");
            response.getInstallKubernetes().setRunning();
            response.getInstallKubernetes().addLog("Bắt đầu cài đặt Kubernetes với Kubespray...");

            try {
                List<String> k8sLogs = installKubernetesWithKubespray();
                response.getInstallKubernetes().addLogs(k8sLogs);
                response.getInstallKubernetes().addLog("✓ Hoàn thành cài đặt Kubernetes!");
                response.getInstallKubernetes().setCompleted();
            } catch (Exception e) {
                response.getInstallKubernetes().setError("Lỗi khi cài đặt Kubernetes: " + e.getMessage());
                response.setMessage("Lỗi: Không thể cài đặt Kubernetes");
                response.getLogs().addAll(response.getInstallKubernetes().getLogs());
                return response;
            }
            response.getLogs().addAll(response.getInstallKubernetes().getLogs());

            // ==================== BƯỚC 5: CÀI ĐẶT ADD-ONS ====================
            System.out.println("[installCluster] Bước 5: Cài đặt K8s Add-ons");
            response.getInstallAddons().setRunning();
            response.getInstallAddons().addLog("Bắt đầu cài đặt K8s Add-ons (MetalLB, Ingress, StorageClass)...");

            try {
                List<String> addonsLogs = installK8sAddons();
                response.getInstallAddons().addLogs(addonsLogs);
                response.getInstallAddons().addLog("✓ Hoàn thành cài đặt K8s Add-ons!");
                response.getInstallAddons().setCompleted();
            } catch (Exception e) {
                response.getInstallAddons().setError("Lỗi khi cài đặt Add-ons: " + e.getMessage());
                response.setMessage("Lỗi: Không thể cài đặt K8s Add-ons");
                response.getLogs().addAll(response.getInstallAddons().getLogs());
                return response;
            }
            response.getLogs().addAll(response.getInstallAddons().getLogs());

            // ==================== BƯỚC 6: CÀI ĐẶT METRICS SERVER ====================
            System.out.println("[installCluster] Bước 6: Cài đặt Metrics Server");
            response.getInstallMetricsServer().setRunning();
            response.getInstallMetricsServer().addLog("Bắt đầu cài đặt Metrics Server...");

            try {
                List<String> metricsLogs = installMetricsServer();
                response.getInstallMetricsServer().addLogs(metricsLogs);
                response.getInstallMetricsServer().addLog("✓ Hoàn thành cài đặt Metrics Server!");
                response.getInstallMetricsServer().setCompleted();
            } catch (Exception e) {
                response.getInstallMetricsServer().setError("Lỗi khi cài đặt Metrics Server: " + e.getMessage());
                response.setMessage("Lỗi: Không thể cài đặt Metrics Server");
                response.getLogs().addAll(response.getInstallMetricsServer().getLogs());
                return response;
            }
            response.getLogs().addAll(response.getInstallMetricsServer().getLogs());

            // ==================== BƯỚC 7: CÀI ĐẶT DOCKER ====================
            System.out.println("[installCluster] Bước 7: Cài đặt Docker");
            response.getInstallDocker().setRunning();
            response.getInstallDocker().addLog("Bắt đầu cài đặt Docker...");

            try {
                List<String> dockerLogs = installDocker();
                response.getInstallDocker().addLogs(dockerLogs);
                response.getInstallDocker().addLog("✓ Hoàn thành cài đặt Docker!");
                response.getInstallDocker().setCompleted();
            } catch (Exception e) {
                response.getInstallDocker().setError("Lỗi khi cài đặt Docker: " + e.getMessage());
                response.setMessage("Lỗi: Không thể cài đặt Docker");
                response.getLogs().addAll(response.getInstallDocker().getLogs());
                return response;
            }
            response.getLogs().addAll(response.getInstallDocker().getLogs());

            // ==================== HOÀN THÀNH ====================
            response.setSuccess(true);
            response.setMessage("Đã hoàn thành cài đặt Kubernetes cluster thành công!");
            response.getLogs().add("===== HOÀN TẤT CÀI ĐẶT KUBERNETES CLUSTER =====");
            System.out.println("[installCluster] Hoàn tất cài đặt cluster");
            return response;

        } catch (Exception e) {
            System.err.println("[installCluster] Lỗi không xác định: " + e.getMessage());
            e.printStackTrace();
            response.setMessage("Lỗi không xác định: " + e.getMessage());
            return response;
        }
    }

    /**
     * Tạo ServerEntity từ request info
     */
    private ServerEntity createServerEntityFromRequest(InstallClusterRequest.ServerInfo info, String role, String clusterStatus) {
        ServerEntity entity = new ServerEntity();
        entity.setName(info.getName());
        entity.setIp(info.getIp());
        entity.setPort(info.getPort() != null ? info.getPort() : 22);
        entity.setUsername(info.getUsername());
        entity.setPassword(info.getPassword());
        entity.setRole(role);
        entity.setClusterStatus(clusterStatus);
        entity.setServerStatus("RUNNING"); // Mặc định là RUNNING, sẽ update sau khi check SSH
        return entity;
    }

    /**
     * Kiểm tra SSH connection và cập nhật log
     */
    private boolean checkSSHConnection(ServerEntity server, InstallClusterResponse.StepStatus stepStatus) {
        String logPrefix = String.format("[%s] %s (%s): ", server.getRole(), server.getName(), server.getIp());
        try {
            ExecuteCommandResponse result = executeSSHCommand(server, "echo HEALTHCHECK");
            if (result.isSuccess()) {
                stepStatus.addLog(logPrefix + "✓ Kết nối SSH thành công");
                server.setServerStatus("RUNNING");
                return true;
            } else {
                stepStatus.addLog(logPrefix + "✗ Kết nối SSH thất bại: " + result.getError());
                server.setServerStatus("STOPPED");
                return false;
            }
        } catch (Exception e) {
            stepStatus.addLog(logPrefix + "✗ Lỗi kết nối SSH: " + e.getMessage());
            server.setServerStatus("STOPPED");
            return false;
        }
    }

    @Override
    public CheckClusterInstalledResponse checkClusterInstalled() {
        System.out.println("[checkClusterInstalled] Kiểm tra xem cụm Kubernetes đã được cài đặt chưa");
        CheckClusterInstalledResponse response = new CheckClusterInstalledResponse();
        
        try {
            // Tìm tất cả servers có role MASTER
            List<ServerEntity> allServers = serverRepository.findAll();
            List<ServerEntity> masterServers = allServers.stream()
                    .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                    .collect(Collectors.toList());
            
            if (masterServers.isEmpty()) {
                // Không có server MASTER nào → cụm chưa được cài đặt
                response.setInstalled(false);
                response.setMessage("Cụm Kubernetes chưa được cài đặt. Không tìm thấy server nào có role MASTER.");
                System.out.println("[checkClusterInstalled] Không tìm thấy server MASTER nào");
                return response;
            }
            
            // Có ít nhất 1 server MASTER → cụm đã được cài đặt
            ServerEntity masterServer = masterServers.get(0); // Lấy master đầu tiên
            response.setInstalled(true);
            response.setMessage("Cụm Kubernetes đã được cài đặt. Tìm thấy " + masterServers.size() + " server(s) có role MASTER.");
            response.setMasterServerId(masterServer.getId());
            response.setMasterServerName(masterServer.getName());
            response.setMasterServerIp(masterServer.getIp());
            System.out.println("[checkClusterInstalled] Tìm thấy cụm đã cài đặt. Master server: " + masterServer.getName() + " (" + masterServer.getIp() + ")");
            return response;
            
        } catch (Exception e) {
            System.err.println("[checkClusterInstalled] Lỗi khi kiểm tra: " + e.getMessage());
            e.printStackTrace();
            response.setInstalled(false);
            response.setMessage("Lỗi khi kiểm tra trạng thái cụm: " + e.getMessage());
            return response;
        }
    }

    /**
     * Thực thi lệnh SSH trên server theo ID
     * Lấy thông tin server từ database và thực thi lệnh qua SSH
     * @param serverId ID của server cần thực thi lệnh
     * @param command Lệnh cần thực thi
     * @return Response chứa kết quả thực thi lệnh
     */
    @Override
    public ExecuteCommandResponse executeCommandOnServer(Long serverId, String command) {
        System.out.println("[executeCommandOnServer] Bắt đầu thực thi lệnh trên server ID: " + serverId);
        System.out.println("[executeCommandOnServer] Lệnh: " + command);
        
        // Tìm server trong database
        ServerEntity server = serverRepository.findById(serverId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy server với ID: " + serverId));
        
        System.out.println("[executeCommandOnServer] Đã tìm thấy server: " + server.getName() + " (" + server.getIp() + ")");
        
        // Tạo request để thực thi lệnh
        ExecuteCommandRequest request = new ExecuteCommandRequest();
        request.setHost(server.getIp());
        request.setPort(server.getPort());
        request.setUsername(server.getUsername());
        request.setPassword(server.getPassword());
        request.setCommand(command);
        
        // Thực thi lệnh qua SSHService
        ExecuteCommandResponse response = sshService.executeCommand(request);
        
        System.out.println("[executeCommandOnServer] Kết quả: success=" + response.isSuccess() + 
                          ", exitStatus=" + response.getExitStatus());
        
        return response;
    }
}