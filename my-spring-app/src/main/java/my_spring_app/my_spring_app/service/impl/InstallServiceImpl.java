package my_spring_app.my_spring_app.service.impl;

import my_spring_app.my_spring_app.dto.reponse.ExecuteCommandResponse;
import my_spring_app.my_spring_app.dto.request.ExecuteCommandRequest;
import my_spring_app.my_spring_app.entity.ServerEntity;
import my_spring_app.my_spring_app.repository.ServerRepository;
import my_spring_app.my_spring_app.service.InstallService;
import my_spring_app.my_spring_app.service.SSHService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@Transactional
public class InstallServiceImpl implements InstallService {

    @Autowired
    private ServerRepository serverRepository;

    @Autowired
    private SSHService sshService;

    @Override
    public List<String> setupAnsibleOnK8sNodes() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<ServerEntity> masterAndWorker = allServers.stream()
                .filter(s -> {
                    String role = s.getRole() != null ? s.getRole().toUpperCase(Locale.ROOT) : "";
                    String clusterStatus = s.getClusterStatus() != null ? s.getClusterStatus().toUpperCase(Locale.ROOT) : "";
                    return ("MASTER".equals(role) || "WORKER".equals(role)) && "AVAILABLE".equals(clusterStatus);
                })
                .collect(Collectors.toList());

        List<String> logs = new ArrayList<>();

        if (masterAndWorker.isEmpty()) {
            logs.add("Không tìm thấy server nào có role MASTER hoặc WORKER với clusterStatus = AVAILABLE.");
            return logs;
        }

        List<ServerEntity> ansibleServers = allServers.stream()
                .filter(s -> "ANSIBLE".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (ansibleServers.isEmpty()) {
            logs.add("Không tìm thấy server nào có role ANSIBLE để cài Ansible.");
            return logs;
        }

        List<ServerEntity> masters = masterAndWorker.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào (MASTER là control node của Kubernetes cluster).");
            return logs;
        }

        for (ServerEntity server : masterAndWorker) {
            String header = String.format("===== Server %s (%s) role=%s =====",
                    server.getName(), server.getIp(), server.getRole());
            logs.add(header);

            if (!isServerReachable(server)) {
                logs.add("  - Không thể SSH tới server, bỏ qua.");
                continue;
            }

            String pythonCmd = "sudo apt-get update -y && sudo apt-get install -y python3";
            runCommandWithLog(server, "Cài đặt Python3", pythonCmd, logs);
        }

        ServerEntity ansibleServer = ansibleServers.get(0);
        ServerEntity k8sControlNode = masters.get(0);

        String header = String.format("===== Cài Ansible trên server ANSIBLE %s (%s) =====",
                ansibleServer.getName(), ansibleServer.getIp());
        logs.add(header);
        logs.add(String.format("Lưu ý: MASTER %s (%s) là control node của Kubernetes cluster",
                k8sControlNode.getName(), k8sControlNode.getIp()));

        if (!isServerReachable(ansibleServer)) {
            logs.add("  - Không thể SSH tới server ANSIBLE, bỏ qua cài Ansible.");
            return logs;
        }

        String sudoCmd = String.format(
                "echo '%s ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/%s >/dev/null && sudo chmod 440 /etc/sudoers.d/%s",
                ansibleServer.getUsername(), ansibleServer.getUsername(), ansibleServer.getUsername());
        runCommandWithLog(ansibleServer, "Thiết lập sudo NOPASSWD trên ANSIBLE", sudoCmd, logs);

        String pythonCmd = "sudo apt-get update -y && sudo apt-get install -y python3";
        runCommandWithLog(ansibleServer, "Cài đặt Python3 trên ANSIBLE", pythonCmd, logs);

        String ansibleInstallCmd = String.join(" && ",
                "sudo apt-get update -y",
                "sudo apt-get install -y software-properties-common sshpass",
                "sudo add-apt-repository --yes --update ppa:ansible/ansible",
                "sudo apt-get update -y",
                "sudo apt-get install -y ansible",
                "which ansible && ansible --version || (echo 'Ansible chưa được cài đặt, thử cài lại...' && sudo apt-get install -y ansible && ansible --version)"
        );
        runCommandWithLog(ansibleServer, "Cài đặt Ansible và sshpass trên server ANSIBLE", ansibleInstallCmd, logs);

        String sshKeyPath = "~/.ssh/id_ed25519";
        String sshKeyGenCmd = String.format(
                "if [ ! -f %s ]; then ssh-keygen -t ed25519 -C \"%s@%s\" -f %s -N \"\"; else echo 'SSH key đã tồn tại'; fi",
                sshKeyPath, ansibleServer.getUsername(), ansibleServer.getIp(), sshKeyPath
        );
        runCommandWithLog(ansibleServer, "Tạo SSH key (nếu chưa có)", sshKeyGenCmd, logs);

        for (ServerEntity target : masterAndWorker) {
            String sshCopyIdCmd = String.format(
                    "sshpass -p '%s' ssh-copy-id -o StrictHostKeyChecking=no -i %s.pub %s@%s || echo 'Đã có key hoặc lỗi copy'",
                    target.getPassword(), sshKeyPath, target.getUsername(), target.getIp()
            );
            runCommandWithLog(ansibleServer,
                    String.format("Copy SSH key đến %s (%s)", target.getName(), target.getIp()),
                    sshCopyIdCmd, logs);
        }

        for (ServerEntity target : masterAndWorker) {
            String testSshCmd = String.format("ssh -o StrictHostKeyChecking=no %s@%s 'hostname' || echo 'SSH test failed'",
                    target.getUsername(), target.getIp());
            runCommandWithLog(ansibleServer,
                    String.format("Kiểm tra SSH không mật khẩu đến %s", target.getName()),
                    testSshCmd, logs);
        }

        String mkdirCmd = "mkdir -p ~/ansible-k8s && cd ~/ansible-k8s && pwd";
        runCommandWithLog(ansibleServer, "Tạo thư mục ~/ansible-k8s", mkdirCmd, logs);

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

        String ansiblePingCmd = "cd ~/ansible-k8s && ansible all -m ping";
        runCommandWithLog(ansibleServer, "Kiểm tra kết nối Ansible (ansible all -m ping)", ansiblePingCmd, logs);

        logs.add("Hoàn tất cài đặt và cấu hình Ansible trên control node.");
        return logs;
    }

    @Override
    public List<String> uninstallAnsibleFromK8sNodes() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        List<ServerEntity> ansibleServers = allServers.stream()
                .filter(s -> "ANSIBLE".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (ansibleServers.isEmpty()) {
            logs.add("Không tìm thấy server nào có role ANSIBLE để gỡ Ansible.");
            return logs;
        }

        ServerEntity ansibleServer = ansibleServers.get(0);
        String header = String.format("===== Gỡ cài đặt Ansible trên server %s (%s) =====",
                ansibleServer.getName(), ansibleServer.getIp());
        logs.add(header);

        if (!isServerReachable(ansibleServer)) {
            logs.add("  - Không thể SSH tới server ANSIBLE, bỏ qua gỡ Ansible.");
            return logs;
        }

        // Bước 1: Kiểm tra Ansible có được cài đặt không
        String checkAnsibleCmd = "which ansible && ansible --version || echo 'Ansible chưa được cài đặt'";
        runCommandWithLog(ansibleServer, "Kiểm tra Ansible có được cài đặt", checkAnsibleCmd, logs);

        // Bước 2: Gỡ Ansible package
        String uninstallAnsibleCmd = String.join(" && ",
                "sudo apt-get remove -y ansible",
                "sudo apt-get purge -y ansible",
                "sudo apt-get autoremove -y"
        );
        runCommandWithLog(ansibleServer, "Gỡ Ansible package", uninstallAnsibleCmd, logs);

        // Bước 3: Gỡ sshpass (nếu không cần thiết)
        String uninstallSshpassCmd = "sudo apt-get remove -y sshpass 2>/dev/null || echo 'sshpass không được cài đặt hoặc đã được gỡ'";
        runCommandWithLog(ansibleServer, "Gỡ sshpass (nếu có)", uninstallSshpassCmd, logs);

        // Bước 4: Xóa thư mục ansible-k8s
        String removeAnsibleDirCmd = "rm -rf ~/ansible-k8s && echo 'Đã xóa thư mục ~/ansible-k8s' || echo 'Thư mục ~/ansible-k8s không tồn tại'";
        runCommandWithLog(ansibleServer, "Xóa thư mục ~/ansible-k8s", removeAnsibleDirCmd, logs);

        // Bước 5: Xóa thư mục kubespray (nếu có)
        String removeKubesprayDirCmd = "rm -rf ~/kubespray && echo 'Đã xóa thư mục ~/kubespray' || echo 'Thư mục ~/kubespray không tồn tại'";
        runCommandWithLog(ansibleServer, "Xóa thư mục ~/kubespray (nếu có)", removeKubesprayDirCmd, logs);

        // Bước 6: Xóa sudoers config (tùy chọn - chỉ xóa nếu muốn)
        String removeSudoersCmd = String.format(
                "sudo rm -f /etc/sudoers.d/%s && echo 'Đã xóa sudoers config' || echo 'Sudoers config không tồn tại'",
                ansibleServer.getUsername()
        );
        runCommandWithLog(ansibleServer, "Xóa sudoers config (tùy chọn)", removeSudoersCmd, logs);

        // Bước 7: Xóa Ansible PPA repository (nếu có)
        String removePPACmd = "sudo add-apt-repository --remove -y ppa:ansible/ansible 2>/dev/null && sudo apt-get update -y || echo 'PPA không tồn tại hoặc đã được gỡ'";
        runCommandWithLog(ansibleServer, "Xóa Ansible PPA repository", removePPACmd, logs);

        // Bước 8: Xác nhận Ansible đã được gỡ
        String verifyUninstallCmd = "which ansible && echo 'CẢNH BÁO: Ansible vẫn còn được cài đặt' || echo 'Ansible đã được gỡ thành công'";
        runCommandWithLog(ansibleServer, "Xác nhận Ansible đã được gỡ", verifyUninstallCmd, logs);

        logs.add("===== Hoàn tất gỡ cài đặt Ansible =====");
        logs.add("Lưu ý: SSH keys và Python3 vẫn được giữ lại để sử dụng cho mục đích khác.");
        return logs;
    }

    @Override
    public List<String> installKubernetesWithKubespray() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        List<ServerEntity> ansibleServers = allServers.stream()
                .filter(s -> "ANSIBLE".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (ansibleServers.isEmpty()) {
            logs.add("Không tìm thấy server nào có role ANSIBLE để chạy Kubespray.");
            return logs;
        }

        List<ServerEntity> masters = allServers.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        List<ServerEntity> workers = allServers.stream()
                .filter(s -> "WORKER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào.");
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

        String cloneKubesprayCmd = "cd ~ && if [ -d kubespray ]; then cd kubespray && git pull; else git clone https://github.com/kubernetes-sigs/kubespray.git && cd kubespray; fi";
        runCommandWithLog(ansibleServer, "Bước 1: Clone/Update Kubespray repository", cloneKubesprayCmd, logs);

        String installDepsCmd = "cd ~/kubespray && sudo apt-get update -y && sudo apt-get install -y python3-pip && pip3 install -r requirements.txt";
        runCommandWithLog(ansibleServer, "Bước 2: Cài đặt Kubespray dependencies", installDepsCmd, logs);

        String copyInventoryCmd = "cd ~/kubespray && cp -rfp inventory/sample inventory/mycluster";
        runCommandWithLog(ansibleServer, "Bước 3: Copy sample inventory", copyInventoryCmd, logs);

        String hostsYaml = buildKubesprayHostsYaml(masters, workers);
        String createHostsYamlCmd = String.format(
                "cd ~/kubespray && cat > inventory/mycluster/hosts.yaml << 'HOSTS_EOF'\n%s\nHOSTS_EOF",
                hostsYaml
        );
        runCommandWithLog(ansibleServer, "Bước 4: Tạo hosts.yaml inventory", createHostsYamlCmd, logs);

        String catHostsCmd = "cd ~/kubespray && cat inventory/mycluster/hosts.yaml";
        runCommandWithLog(ansibleServer, "Bước 5: Kiểm tra nội dung hosts.yaml", catHostsCmd, logs);

        String runPlaybookCmd = "cd ~/kubespray && ansible-playbook -i inventory/mycluster/hosts.yaml --become --become-user=root cluster.yml";
        runCommandWithLog(ansibleServer, "Bước 6: Chạy Kubespray playbook (có thể mất 15-30 phút)", runPlaybookCmd, logs);

        ServerEntity masterNode = masters.get(0);
        if (isServerReachable(masterNode)) {
            String checkClusterCmd = "mkdir -p $HOME/.kube && sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config 2>/dev/null; sudo chown $(id -u):$(id -g) $HOME/.kube/config 2>/dev/null; kubectl get nodes -o wide";
            runCommandWithLog(masterNode, "Bước 7: Kiểm tra cluster trên master", checkClusterCmd, logs);
        }

        logs.add("===== Hoàn tất cài đặt Kubernetes bằng Kubespray =====");
        return logs;
    }

    @Override
    public List<String> uninstallKubernetesFromK8sNodes() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        List<ServerEntity> masters = allServers.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        List<ServerEntity> workers = allServers.stream()
                .filter(s -> "WORKER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        List<ServerEntity> allK8sNodes = new ArrayList<>();
        allK8sNodes.addAll(masters);
        allK8sNodes.addAll(workers);

        if (allK8sNodes.isEmpty()) {
            logs.add("Không tìm thấy server MASTER hoặc WORKER nào để gỡ Kubernetes.");
            return logs;
        }

        logs.add("===== Bắt đầu gỡ cài đặt Kubernetes =====");
        logs.add(String.format("Số MASTER nodes: %d", masters.size()));
        logs.add(String.format("Số WORKER nodes: %d", workers.size()));

        // Bước 0: Thử sử dụng Kubespray reset playbook (nếu có)
        List<ServerEntity> ansibleServers = allServers.stream()
                .filter(s -> "ANSIBLE".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (!ansibleServers.isEmpty()) {
            ServerEntity ansibleServer = ansibleServers.get(0);
            if (isServerReachable(ansibleServer)) {
                logs.add("===== Thử sử dụng Kubespray reset playbook =====");
                String kubesprayResetCmd = "cd ~/kubespray && ansible-playbook -i inventory/mycluster/hosts.yaml --become --become-user=root reset.yml 2>/dev/null || echo 'Kubespray reset playbook không chạy được hoặc không tồn tại, sẽ reset thủ công'";
                runCommandWithLog(ansibleServer, "Chạy Kubespray reset playbook", kubesprayResetCmd, logs);
            }
        }

        // Bước 1: Gỡ các addons trên master node trước (nếu kubectl còn hoạt động)
        if (!masters.isEmpty()) {
            ServerEntity masterNode = masters.get(0);
            if (isServerReachable(masterNode)) {
                logs.add("===== Gỡ các Kubernetes Addons trên " + masterNode.getName() + " =====");

                // Kiểm tra kubectl có hoạt động không
                String checkKubectlCmd = "kubectl cluster-info 2>/dev/null && echo 'kubectl hoạt động' || echo 'kubectl không hoạt động, bỏ qua gỡ addons'";
                runCommandWithLog(masterNode, "Kiểm tra kubectl", checkKubectlCmd, logs);

                // Gỡ Metrics Server
                String uninstallMetricsCmd = "kubectl delete deployment metrics-server -n kube-system 2>/dev/null || echo 'Metrics Server không tồn tại hoặc kubectl không hoạt động'";
                runCommandWithLog(masterNode, "Gỡ Metrics Server", uninstallMetricsCmd, logs);

                // Gỡ NGINX Ingress
                String uninstallNginxCmd = "kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/baremetal/deploy.yaml 2>/dev/null || echo 'NGINX Ingress không tồn tại hoặc kubectl không hoạt động'";
                runCommandWithLog(masterNode, "Gỡ NGINX Ingress Controller", uninstallNginxCmd, logs);

                // Gỡ MetalLB
                String uninstallMetalLBCmd = "kubectl delete -f https://raw.githubusercontent.com/metallb/metallb/v0.13.12/config/manifests/metallb-native.yaml 2>/dev/null || echo 'MetalLB không tồn tại hoặc kubectl không hoạt động'";
                runCommandWithLog(masterNode, "Gỡ MetalLB", uninstallMetalLBCmd, logs);

                // Gỡ Local Path Provisioner
                String uninstallLocalPathCmd = "kubectl delete -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.26/deploy/local-path-storage.yaml 2>/dev/null || echo 'Local Path Provisioner không tồn tại hoặc kubectl không hoạt động'";
                runCommandWithLog(masterNode, "Gỡ Local Path Provisioner", uninstallLocalPathCmd, logs);
            }
        }

        // Bước 2: Cleanup trực tiếp trên từng node (tham khảo từ cleanupDirectly)
        for (ServerEntity node : allK8sNodes) {
            String header = String.format("===== Cleanup server %s (%s) role=%s =====",
                    node.getName(), node.getIp(), node.getRole());
            logs.add(header);

            if (!isServerReachable(node)) {
                logs.add("  - Không thể SSH tới server, bỏ qua.");
                continue;
            }

            // Reset kubeadm
            String resetCmd = "sudo kubeadm reset -f 2>/dev/null || true";
            runCommandWithLog(node, "Reset kubeadm", resetCmd, logs);

            // Dừng services
            String stopCmd = "sudo systemctl stop kubelet 2>/dev/null || true; sudo systemctl stop containerd 2>/dev/null || true";
            runCommandWithLog(node, "Dừng kubelet và containerd", stopCmd, logs);

            // Xóa containers và images
            String cleanContainersCmd = "sudo crictl rm -af 2>/dev/null || true; sudo crictl rmi -a 2>/dev/null || true";
            runCommandWithLog(node, "Xóa containers và images", cleanContainersCmd, logs);

            // Xóa thư mục cấu hình (bao gồm cả logs và cache)
            String cleanFilesCmd = "sudo rm -rf /etc/kubernetes /var/lib/kubelet /var/lib/etcd /var/lib/cni /etc/cni /opt/cni $HOME/.kube /var/run/kubernetes /var/lib/dockershim /var/run/calico /var/log/pods /var/log/containers /var/log/kubelet.log /var/log/kube-proxy.log";
            runCommandWithLog(node, "Xóa thư mục cấu hình và logs", cleanFilesCmd, logs);

            // Xóa các file systemd service còn sót lại
            String removeSystemdFilesCmd = "sudo rm -rf /etc/systemd/system/kubelet.service.d /etc/systemd/system/kubelet.service /usr/lib/systemd/system/kubelet.service /lib/systemd/system/kubelet.service";
            runCommandWithLog(node, "Xóa systemd service files", removeSystemdFilesCmd, logs);

            // Gỡ cài đặt packages
            String uninstallCmd = "sudo apt-mark unhold kubelet kubeadm kubectl 2>/dev/null || true; sudo apt-get purge -y kubelet kubeadm kubectl 2>/dev/null || true; sudo apt-get autoremove -y 2>/dev/null || true";
            runCommandWithLog(node, "Gỡ cài đặt kubelet, kubeadm, kubectl", uninstallCmd, logs);

            // Xóa repo và GPG keys
            String removeRepoCmd = "sudo rm -f /etc/apt/sources.list.d/kubernetes.list /etc/apt/keyrings/kubernetes-apt-keyring.gpg /usr/share/keyrings/kubernetes-archive-keyring.gpg && sudo apt-get update -y 2>/dev/null || true";
            runCommandWithLog(node, "Xóa Kubernetes repository và GPG keys", removeRepoCmd, logs);

            // Reset mạng
            String resetNetCmd = "sudo iptables -F && sudo iptables -t nat -F && sudo iptables -t mangle -F && sudo iptables -X; " +
                    "sudo ipvsadm -C 2>/dev/null || true; " +
                    "sudo ip link delete cni0 2>/dev/null || true; " +
                    "sudo ip link delete flannel.1 2>/dev/null || true; " +
                    "sudo ip link delete tunl0 2>/dev/null || true; " +
                    "sudo ip link delete vxlan.calico 2>/dev/null || true";
            runCommandWithLog(node, "Reset cấu hình mạng", resetNetCmd, logs);

            // Reset containerd
            String resetContainerdCmd = "sudo mkdir -p /etc/containerd; containerd config default | sudo tee /etc/containerd/config.toml >/dev/null; " +
                    "sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml; sudo systemctl restart containerd 2>/dev/null || true";
            runCommandWithLog(node, "Reset và restart containerd", resetContainerdCmd, logs);

            // Reload systemd daemon
            String reloadSystemdCmd = "sudo systemctl daemon-reload 2>/dev/null || true";
            runCommandWithLog(node, "Reload systemd daemon", reloadSystemdCmd, logs);
        }

        // Bước 3: Xóa sạch kubespray và các dependencies trên ANSIBLE server
        if (!ansibleServers.isEmpty()) {
            ServerEntity ansibleServer = ansibleServers.get(0);
            if (isServerReachable(ansibleServer)) {
                logs.add("===== Cleanup kubespray trên ANSIBLE server =====");
                
                // Xóa kubespray directory
                String removeKubesprayCmd = "rm -rf ~/kubespray && echo 'Đã xóa thư mục ~/kubespray' || echo 'Thư mục ~/kubespray không tồn tại'";
                runCommandWithLog(ansibleServer, "Bước 3.1: Xóa thư mục kubespray", removeKubesprayCmd, logs);

                // Xóa Python cache và các file liên quan
                String cleanPythonCacheCmd = "rm -rf ~/.cache/pip ~/.local/lib/python3.*/site-packages/kubespray* 2>/dev/null || true; echo 'Đã xóa Python cache'";
                runCommandWithLog(ansibleServer, "Bước 3.2: Xóa Python cache", cleanPythonCacheCmd, logs);

                // Xóa các file cấu hình ansible còn sót lại
                String cleanAnsibleConfigCmd = "rm -rf ~/.ansible ~/ansible-k8s/inventory/mycluster 2>/dev/null || true; echo 'Đã xóa Ansible config còn sót lại'";
                runCommandWithLog(ansibleServer, "Bước 3.3: Xóa Ansible config còn sót lại", cleanAnsibleConfigCmd, logs);

                // Gỡ các Python packages liên quan đến kubespray (nếu có)
                String uninstallKubesprayPkgsCmd = "pip3 uninstall -y kubespray ansible 2>/dev/null || true; echo 'Đã gỡ Python packages liên quan'";
                runCommandWithLog(ansibleServer, "Bước 3.4: Gỡ Python packages liên quan (nếu có)", uninstallKubesprayPkgsCmd, logs);
            }
        }

        logs.add("===== Hoàn tất gỡ cài đặt Kubernetes =====");
        logs.add("Lưu ý: Containerd/Docker và các package khác vẫn được giữ lại.");
        return logs;
    }

    @Override
    public List<String> installK8sAddons() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        List<ServerEntity> masters = allServers.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào.");
            return logs;
        }

        ServerEntity masterNode = masters.get(0);

        if (!isServerReachable(masterNode)) {
            logs.add("Không thể SSH tới server MASTER: " + masterNode.getName());
            return logs;
        }

        logs.add("===== Bắt đầu cài đặt Kubernetes Addons trên " + masterNode.getName() + " =====");

        String enableStrictArpCmd = "kubectl get configmap kube-proxy -n kube-system -o yaml | " +
                "sed -e 's/strictARP: false/strictARP: true/' | " +
                "kubectl apply -f - -n kube-system";
        runCommandWithLog(masterNode, "Bước 1.1: Bật strict ARP mode cho kube-proxy", enableStrictArpCmd, logs);

        String installMetalLBCmd = "kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.12/config/manifests/metallb-native.yaml";
        runCommandWithLog(masterNode, "Bước 1.2: Cài đặt MetalLB v0.13.12", installMetalLBCmd, logs);

        String waitMetalLBCmd = "for i in {1..60}; do " +
                "controller=$(kubectl get pods -n metallb-system -l app=metallb,component=controller --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "speaker=$(kubectl get pods -n metallb-system -l app=metallb,component=speaker --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "if [ $controller -gt 0 ] && [ $speaker -gt 0 ]; then echo 'MetalLB pods đã sẵn sàng'; exit 0; fi; " +
                "sleep 5; done; echo 'Timeout: MetalLB pods chưa sẵn sàng'";
        runCommandWithLog(masterNode, "Bước 1.3: Đợi MetalLB pods sẵn sàng", waitMetalLBCmd, logs);

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

        String installNginxIngressCmd = "kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/baremetal/deploy.yaml";
        runCommandWithLog(masterNode, "Bước 2.1: Cài đặt NGINX Ingress Controller v1.9.4", installNginxIngressCmd, logs);

        String waitNginxCmd = "for i in {1..90}; do " +
                "ready=$(kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "if [ $ready -gt 0 ]; then echo 'NGINX Ingress Controller đã sẵn sàng'; exit 0; fi; " +
                "sleep 5; done; echo 'Timeout: NGINX Ingress Controller chưa sẵn sàng'";
        runCommandWithLog(masterNode, "Bước 2.2: Đợi NGINX Ingress Controller sẵn sàng", waitNginxCmd, logs);

        String patchNginxServiceCmd = "kubectl patch svc ingress-nginx-controller -n ingress-nginx " +
                "-p '{\"spec\": {\"type\": \"LoadBalancer\"}}'";
        runCommandWithLog(masterNode, "Bước 2.3: Chuyển NGINX Ingress Service sang LoadBalancer", patchNginxServiceCmd, logs);

        String waitExternalIPCmd = "for i in {1..30}; do " +
                "external_ip=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null); " +
                "if [ -n \"$external_ip\" ]; then echo \"NGINX Ingress External IP: $external_ip\"; exit 0; fi; " +
                "sleep 3; done; echo 'Chưa có External IP (có thể cần kiểm tra MetalLB)'";
        runCommandWithLog(masterNode, "Bước 2.4: Kiểm tra External IP", waitExternalIPCmd, logs);

        String installLocalPathCmd = "kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.26/deploy/local-path-storage.yaml";
        runCommandWithLog(masterNode, "Bước 3.1: Cài đặt Local Path Provisioner v0.0.26", installLocalPathCmd, logs);

        String waitLocalPathCmd = "for i in {1..60}; do " +
                "ready=$(kubectl get pods -n local-path-storage --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "if [ $ready -gt 0 ]; then echo 'Local Path Provisioner đã sẵn sàng'; exit 0; fi; " +
                "sleep 5; done; echo 'Timeout: Local Path Provisioner chưa sẵn sàng'";
        runCommandWithLog(masterNode, "Bước 3.2: Đợi Local Path Provisioner sẵn sàng", waitLocalPathCmd, logs);

        String setDefaultStorageClassCmd = "kubectl patch storageclass local-path " +
                "-p '{\"metadata\": {\"annotations\":{\"storageclass.kubernetes.io/is-default-class\":\"true\"}}}'";
        runCommandWithLog(masterNode, "Bước 3.3: Đặt local-path làm default StorageClass", setDefaultStorageClassCmd, logs);

        String checkMetalLBCmd = "kubectl get pods -n metallb-system";
        runCommandWithLog(masterNode, "Kiểm tra MetalLB pods", checkMetalLBCmd, logs);

        String checkNginxCmd = "kubectl get pods -n ingress-nginx && kubectl get svc -n ingress-nginx";
        runCommandWithLog(masterNode, "Kiểm tra NGINX Ingress Controller", checkNginxCmd, logs);

        String checkStorageClassCmd = "kubectl get storageclass && kubectl get pods -n local-path-storage";
        runCommandWithLog(masterNode, "Kiểm tra StorageClass", checkStorageClassCmd, logs);

        logs.add("===== Hoàn tất cài đặt Kubernetes Addons =====");
        return logs;
    }

    @Override
    public List<String> uninstallK8sAddons() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        List<ServerEntity> masters = allServers.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào.");
            return logs;
        }

        ServerEntity masterNode = masters.get(0);

        if (!isServerReachable(masterNode)) {
            logs.add("Không thể SSH tới server MASTER: " + masterNode.getName());
            return logs;
        }

        logs.add("===== Bắt đầu gỡ cài đặt Kubernetes Addons trên " + masterNode.getName() + " =====");

        // Bước 1: Gỡ Local Path Provisioner
        logs.add("===== Bước 1: Gỡ Local Path Provisioner =====");
        
        // Xóa default annotation từ StorageClass trước
        String removeDefaultStorageClassCmd = "kubectl patch storageclass local-path " +
                "-p '{\"metadata\": {\"annotations\":{\"storageclass.kubernetes.io/is-default-class\":\"false\"}}}' 2>/dev/null || echo 'StorageClass local-path không tồn tại hoặc không phải default'";
        runCommandWithLog(masterNode, "Bước 1.1: Xóa default annotation từ StorageClass local-path", removeDefaultStorageClassCmd, logs);

        // Gỡ Local Path Provisioner
        String uninstallLocalPathCmd = "kubectl delete -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.26/deploy/local-path-storage.yaml 2>/dev/null || echo 'Local Path Provisioner không tồn tại'";
        runCommandWithLog(masterNode, "Bước 1.2: Gỡ Local Path Provisioner", uninstallLocalPathCmd, logs);

        // Đợi namespace được xóa
        String waitLocalPathNamespaceCmd = "for i in {1..30}; do " +
                "exists=$(kubectl get namespace local-path-storage 2>/dev/null | grep -c local-path-storage || echo 0); " +
                "if [ $exists -eq 0 ]; then echo 'Namespace local-path-storage đã được xóa'; exit 0; fi; " +
                "sleep 2; done; echo 'Namespace local-path-storage vẫn còn (có thể có resources khác)'";
        runCommandWithLog(masterNode, "Bước 1.3: Đợi namespace local-path-storage được xóa", waitLocalPathNamespaceCmd, logs);

        // Bước 2: Gỡ NGINX Ingress Controller
        logs.add("===== Bước 2: Gỡ NGINX Ingress Controller =====");
        
        // Gỡ NGINX Ingress Controller
        String uninstallNginxCmd = "kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/baremetal/deploy.yaml 2>/dev/null || echo 'NGINX Ingress Controller không tồn tại'";
        runCommandWithLog(masterNode, "Bước 2.1: Gỡ NGINX Ingress Controller", uninstallNginxCmd, logs);

        // Đợi namespace được xóa
        String waitNginxNamespaceCmd = "for i in {1..60}; do " +
                "exists=$(kubectl get namespace ingress-nginx 2>/dev/null | grep -c ingress-nginx || echo 0); " +
                "if [ $exists -eq 0 ]; then echo 'Namespace ingress-nginx đã được xóa'; exit 0; fi; " +
                "sleep 3; done; echo 'Namespace ingress-nginx vẫn còn (có thể có resources khác)'";
        runCommandWithLog(masterNode, "Bước 2.2: Đợi namespace ingress-nginx được xóa", waitNginxNamespaceCmd, logs);

        // Bước 3: Gỡ MetalLB
        logs.add("===== Bước 3: Gỡ MetalLB =====");
        
        // Xóa L2Advertisement
        String deleteL2AdvCmd = "kubectl delete l2advertisement default-l2-advertisement -n metallb-system 2>/dev/null || echo 'L2Advertisement không tồn tại'";
        runCommandWithLog(masterNode, "Bước 3.1: Xóa L2Advertisement", deleteL2AdvCmd, logs);

        // Xóa IPAddressPool
        String deleteIPPoolCmd = "kubectl delete ipaddresspool default-pool -n metallb-system 2>/dev/null || echo 'IPAddressPool không tồn tại'";
        runCommandWithLog(masterNode, "Bước 3.2: Xóa IPAddressPool", deleteIPPoolCmd, logs);

        // Gỡ MetalLB
        String uninstallMetalLBCmd = "kubectl delete -f https://raw.githubusercontent.com/metallb/metallb/v0.13.12/config/manifests/metallb-native.yaml 2>/dev/null || echo 'MetalLB không tồn tại'";
        runCommandWithLog(masterNode, "Bước 3.3: Gỡ MetalLB", uninstallMetalLBCmd, logs);

        // Đợi namespace được xóa
        String waitMetalLBNamespaceCmd = "for i in {1..60}; do " +
                "exists=$(kubectl get namespace metallb-system 2>/dev/null | grep -c metallb-system || echo 0); " +
                "if [ $exists -eq 0 ]; then echo 'Namespace metallb-system đã được xóa'; exit 0; fi; " +
                "sleep 3; done; echo 'Namespace metallb-system vẫn còn (có thể có resources khác)'";
        runCommandWithLog(masterNode, "Bước 3.4: Đợi namespace metallb-system được xóa", waitMetalLBNamespaceCmd, logs);

        // Bước 4: Reset strict ARP mode về false (tùy chọn)
        logs.add("===== Bước 4: Reset strict ARP mode (tùy chọn) =====");
        String disableStrictArpCmd = "kubectl get configmap kube-proxy -n kube-system -o yaml | " +
                "sed -e 's/strictARP: true/strictARP: false/' | " +
                "kubectl apply -f - -n kube-system 2>/dev/null || echo 'Không thể reset strict ARP mode (có thể configmap không tồn tại)'";
        runCommandWithLog(masterNode, "Bước 4.1: Reset strict ARP mode về false", disableStrictArpCmd, logs);

        // Kiểm tra kết quả
        logs.add("===== KIỂM TRA KẾT QUẢ GỠ CÀI ĐẶT =====");
        String checkMetalLBCmd = "kubectl get pods -n metallb-system 2>/dev/null || echo 'MetalLB namespace không tồn tại'";
        runCommandWithLog(masterNode, "Kiểm tra MetalLB", checkMetalLBCmd, logs);

        String checkNginxCmd = "kubectl get pods -n ingress-nginx 2>/dev/null || echo 'NGINX Ingress namespace không tồn tại'";
        runCommandWithLog(masterNode, "Kiểm tra NGINX Ingress Controller", checkNginxCmd, logs);

        String checkStorageClassCmd = "kubectl get storageclass local-path 2>/dev/null || echo 'StorageClass local-path không tồn tại'";
        runCommandWithLog(masterNode, "Kiểm tra StorageClass local-path", checkStorageClassCmd, logs);

        logs.add("===== Hoàn tất gỡ cài đặt Kubernetes Addons =====");
        return logs;
    }

    @Override
    public List<String> installMetricsServer() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        List<ServerEntity> masters = allServers.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào.");
            return logs;
        }

        ServerEntity masterNode = masters.get(0);

        if (!isServerReachable(masterNode)) {
            logs.add("Không thể SSH tới server MASTER: " + masterNode.getName());
            return logs;
        }

        logs.add("===== Bắt đầu cài đặt Metrics Server trên " + masterNode.getName() + " =====");

        String installMetricsServerCmd = "kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml";
        runCommandWithLog(masterNode, "Bước 1: Cài đặt Metrics Server", installMetricsServerCmd, logs);

        String patchMetricsServerCmd = "kubectl patch deployment metrics-server -n kube-system --type='json' " +
                "-p='[{\"op\": \"add\", \"path\": \"/spec/template/spec/containers/0/args/-\", \"value\": \"--kubelet-insecure-tls\"}]'";
        runCommandWithLog(masterNode, "Bước 2: Patch Metrics Server để bỏ qua TLS verification", patchMetricsServerCmd, logs);

        logs.add("Bước 3: Đợi Metrics Server pods sẵn sàng...");
        String waitMetricsServerCmd = "for i in {1..60}; do " +
                "ready=$(kubectl get pods -n kube-system -l k8s-app=metrics-server --no-headers 2>/dev/null | grep -c Running || echo 0); " +
                "if [ $ready -gt 0 ]; then echo 'Metrics Server đã sẵn sàng'; exit 0; fi; " +
                "sleep 5; done; echo 'Timeout: Metrics Server chưa sẵn sàng'";
        runCommandWithLog(masterNode, "Bước 3: Kiểm tra Metrics Server pods", waitMetricsServerCmd, logs);

        logs.add("Bước 4: Kiểm tra Metrics Server hoạt động...");
        String testMetricsCmd = "kubectl top nodes 2>/dev/null && echo 'Metrics Server hoạt động bình thường' || echo 'Metrics Server chưa sẵn sàng, có thể cần đợi thêm'";
        runCommandWithLog(masterNode, "Bước 4: Kiểm tra kubectl top nodes", testMetricsCmd, logs);

        String testPodsMetricsCmd = "kubectl top pods --all-namespaces 2>/dev/null | head -5 && echo '...' || echo 'Chưa có pods để hiển thị metrics'";
        runCommandWithLog(masterNode, "Bước 5: Kiểm tra kubectl top pods", testPodsMetricsCmd, logs);

        logs.add("===== KIỂM TRA KẾT QUẢ CÀI ĐẶT =====");
        String checkMetricsServerCmd = "kubectl get pods -n kube-system -l k8s-app=metrics-server";
        runCommandWithLog(masterNode, "Kiểm tra Metrics Server pods", checkMetricsServerCmd, logs);

        String checkDeploymentCmd = "kubectl get deployment metrics-server -n kube-system";
        runCommandWithLog(masterNode, "Kiểm tra Metrics Server deployment", checkDeploymentCmd, logs);

        logs.add("===== Hoàn tất cài đặt Metrics Server =====");
        logs.add("Lưu ý: Metrics Server cần vài phút để thu thập metrics. Sử dụng 'kubectl top nodes' và 'kubectl top pods' để kiểm tra.");
        return logs;
    }

    @Override
    public List<String> uninstallMetricsServer() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        List<ServerEntity> masters = allServers.stream()
                .filter(s -> "MASTER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (masters.isEmpty()) {
            logs.add("Không tìm thấy server MASTER nào.");
            return logs;
        }

        ServerEntity masterNode = masters.get(0);

        if (!isServerReachable(masterNode)) {
            logs.add("Không thể SSH tới server MASTER: " + masterNode.getName());
            return logs;
        }

        logs.add("===== Bắt đầu gỡ cài đặt Metrics Server trên " + masterNode.getName() + " =====");

        // Bước 1: Xóa deployment metrics-server
        String deleteDeploymentCmd = "kubectl delete deployment metrics-server -n kube-system 2>/dev/null || echo 'Deployment metrics-server không tồn tại'";
        runCommandWithLog(masterNode, "Bước 1: Xóa deployment metrics-server", deleteDeploymentCmd, logs);

        // Bước 2: Xóa service metrics-server
        String deleteServiceCmd = "kubectl delete service metrics-server -n kube-system 2>/dev/null || echo 'Service metrics-server không tồn tại'";
        runCommandWithLog(masterNode, "Bước 2: Xóa service metrics-server", deleteServiceCmd, logs);

        // Bước 3: Xóa serviceaccount metrics-server
        String deleteServiceAccountCmd = "kubectl delete serviceaccount metrics-server -n kube-system 2>/dev/null || echo 'ServiceAccount metrics-server không tồn tại'";
        runCommandWithLog(masterNode, "Bước 3: Xóa serviceaccount metrics-server", deleteServiceAccountCmd, logs);

        // Bước 4: Xóa ClusterRole và ClusterRoleBinding
        String deleteClusterRoleCmd = "kubectl delete clusterrole system:metrics-server 2>/dev/null || echo 'ClusterRole system:metrics-server không tồn tại'";
        runCommandWithLog(masterNode, "Bước 4: Xóa ClusterRole system:metrics-server", deleteClusterRoleCmd, logs);

        String deleteClusterRoleBindingCmd = "kubectl delete clusterrolebinding system:metrics-server 2>/dev/null || echo 'ClusterRoleBinding system:metrics-server không tồn tại'";
        runCommandWithLog(masterNode, "Bước 5: Xóa ClusterRoleBinding system:metrics-server", deleteClusterRoleBindingCmd, logs);

        // Bước 6: Xóa APIService (nếu có)
        String deleteAPIServiceCmd = "kubectl delete apiservice v1beta1.metrics.k8s.io 2>/dev/null || echo 'APIService v1beta1.metrics.k8s.io không tồn tại'";
        runCommandWithLog(masterNode, "Bước 6: Xóa APIService v1beta1.metrics.k8s.io", deleteAPIServiceCmd, logs);

        // Bước 7: Xóa tất cả resources từ components.yaml (fallback)
        String deleteAllResourcesCmd = "kubectl delete -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml 2>/dev/null || echo 'Không thể xóa resources từ components.yaml (có thể đã được xóa)'";
        runCommandWithLog(masterNode, "Bước 7: Xóa tất cả resources từ components.yaml (fallback)", deleteAllResourcesCmd, logs);

        // Bước 8: Đợi pods được xóa
        logs.add("Bước 8: Đợi Metrics Server pods được xóa...");
        String waitPodsDeletedCmd = "for i in {1..30}; do " +
                "exists=$(kubectl get pods -n kube-system -l k8s-app=metrics-server --no-headers 2>/dev/null | wc -l || echo 0); " +
                "if [ $exists -eq 0 ]; then echo 'Metrics Server pods đã được xóa'; exit 0; fi; " +
                "sleep 2; done; echo 'Metrics Server pods vẫn còn (có thể đang terminating)'";
        runCommandWithLog(masterNode, "Bước 8: Kiểm tra Metrics Server pods đã được xóa", waitPodsDeletedCmd, logs);

        // Kiểm tra kết quả
        logs.add("===== KIỂM TRA KẾT QUẢ GỠ CÀI ĐẶT =====");
        String checkPodsCmd = "kubectl get pods -n kube-system -l k8s-app=metrics-server 2>/dev/null || echo 'Không còn Metrics Server pods'";
        runCommandWithLog(masterNode, "Kiểm tra Metrics Server pods", checkPodsCmd, logs);

        String checkDeploymentCmd = "kubectl get deployment metrics-server -n kube-system 2>/dev/null || echo 'Deployment metrics-server không tồn tại'";
        runCommandWithLog(masterNode, "Kiểm tra Metrics Server deployment", checkDeploymentCmd, logs);

        String checkServiceCmd = "kubectl get service metrics-server -n kube-system 2>/dev/null || echo 'Service metrics-server không tồn tại'";
        runCommandWithLog(masterNode, "Kiểm tra Metrics Server service", checkServiceCmd, logs);

        String testTopNodesCmd = "kubectl top nodes 2>&1 | head -1 || echo 'kubectl top nodes không hoạt động (Metrics Server đã được gỡ)'";
        runCommandWithLog(masterNode, "Kiểm tra kubectl top nodes (sẽ fail nếu Metrics Server đã được gỡ)", testTopNodesCmd, logs);

        logs.add("===== Hoàn tất gỡ cài đặt Metrics Server =====");
        logs.add("Lưu ý: Các lệnh 'kubectl top nodes' và 'kubectl top pods' sẽ không hoạt động sau khi gỡ Metrics Server.");
        return logs;
    }

    @Override
    public List<String> installDocker() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        List<ServerEntity> dockerServers = allServers.stream()
                .filter(s -> "DOCKER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (dockerServers.isEmpty()) {
            logs.add("Không tìm thấy server nào có role DOCKER để cài đặt Docker.");
            return logs;
        }

        ServerEntity dockerServer = dockerServers.get(0);
        String header = String.format("===== Cài đặt Docker trên server %s (%s) =====",
                dockerServer.getName(), dockerServer.getIp());
        logs.add(header);

        if (!isServerReachable(dockerServer)) {
            logs.add("  - Không thể SSH tới server DOCKER, bỏ qua cài đặt Docker.");
            return logs;
        }

        String step1Cmd = String.join(" && ",
                "sudo apt-get update -y",
                "sudo apt-get install -y ca-certificates curl gnupg lsb-release"
        );
        runCommandWithLog(dockerServer, "Bước 1: Cập nhật hệ thống và cài các gói cần thiết", step1Cmd, logs);

        String step2Cmd = String.join(" && ",
                "sudo mkdir -p /etc/apt/keyrings",
                "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg",
                "sudo chmod a+r /etc/apt/keyrings/docker.gpg"
        );
        runCommandWithLog(dockerServer, "Bước 2: Thêm Docker's official GPG key", step2Cmd, logs);

        String step3Cmd = String.join(" && ",
                "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null",
                "sudo apt-get update -y"
        );
        runCommandWithLog(dockerServer, "Bước 3: Thêm Docker repository và cập nhật", step3Cmd, logs);

        String step4Cmd = "sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin";
        runCommandWithLog(dockerServer, "Bước 4: Cài đặt Docker Engine và các plugin", step4Cmd, logs);

        String step5Cmd = String.format(
                "sudo usermod -aG docker %s",
                dockerServer.getUsername()
        );
        runCommandWithLog(dockerServer, "Bước 5: Thêm user vào docker group", step5Cmd, logs);

        String step6Cmd = String.join(" && ",
                "sudo systemctl start docker",
                "sudo systemctl enable docker",
                "sudo systemctl status docker --no-pager"
        );
        runCommandWithLog(dockerServer, "Bước 6: Khởi động và enable Docker service", step6Cmd, logs);

        String step7Cmd = "docker --version && docker ps";
        runCommandWithLog(dockerServer, "Bước 7: Kiểm tra cài đặt Docker", step7Cmd, logs);

        String step8Cmd = "docker ps 2>&1 || echo 'Lưu ý: Có thể cần logout và login lại để áp dụng thay đổi group'";
        runCommandWithLog(dockerServer, "Bước 8: Kiểm tra chạy docker không cần sudo", step8Cmd, logs);

        logs.add("===== Hoàn tất cài đặt Docker =====");
        logs.add(String.format("Docker đã được cài đặt trên server %s (%s)", dockerServer.getName(), dockerServer.getIp()));
        logs.add("Lưu ý: Nếu không thể chạy 'docker' không cần sudo, vui lòng logout và login lại để áp dụng thay đổi group.");
        return logs;
    }

    @Override
    public List<String> uninstallDocker() {
        List<ServerEntity> allServers = serverRepository.findAll();
        List<String> logs = new ArrayList<>();

        List<ServerEntity> dockerServers = allServers.stream()
                .filter(s -> "DOCKER".equalsIgnoreCase(s.getRole()))
                .collect(Collectors.toList());

        if (dockerServers.isEmpty()) {
            logs.add("Không tìm thấy server nào có role DOCKER để gỡ Docker.");
            return logs;
        }

        ServerEntity dockerServer = dockerServers.get(0);
        String header = String.format("===== Gỡ cài đặt Docker trên server %s (%s) =====",
                dockerServer.getName(), dockerServer.getIp());
        logs.add(header);

        if (!isServerReachable(dockerServer)) {
            logs.add("  - Không thể SSH tới server DOCKER, bỏ qua gỡ Docker.");
            return logs;
        }

        // Bước 1: Dừng Docker service
        String stopDockerCmd = String.join(" && ",
                "sudo systemctl stop docker",
                "sudo systemctl stop docker.socket",
                "sudo systemctl stop containerd",
                "echo 'Đã dừng Docker services'"
        );
        runCommandWithLog(dockerServer, "Bước 1: Dừng Docker services", stopDockerCmd, logs);

        // Bước 2: Disable Docker service
        String disableDockerCmd = String.join(" && ",
                "sudo systemctl disable docker",
                "sudo systemctl disable docker.socket",
                "sudo systemctl disable containerd",
                "echo 'Đã disable Docker services'"
        );
        runCommandWithLog(dockerServer, "Bước 2: Disable Docker services", disableDockerCmd, logs);

        // Bước 3: Gỡ Docker từ snap (nếu có)
        String uninstallDockerSnapCmd = "sudo snap remove docker 2>/dev/null || echo 'Docker không được cài từ snap'";
        runCommandWithLog(dockerServer, "Bước 3: Gỡ Docker từ snap (nếu có)", uninstallDockerSnapCmd, logs);

        // Bước 4: Gỡ các Docker packages từ apt
        String uninstallDockerPackagesCmd = String.join(" && ",
                "sudo apt-get remove -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc 2>/dev/null || true",
                "sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc 2>/dev/null || true",
                "sudo apt-get autoremove -y",
                "echo 'Đã gỡ các Docker packages từ apt'"
        );
        runCommandWithLog(dockerServer, "Bước 4: Gỡ các Docker packages từ apt", uninstallDockerPackagesCmd, logs);

        // Bước 5: Xóa Docker repository
        String removeDockerRepoCmd = "sudo rm -f /etc/apt/sources.list.d/docker.list && sudo apt-get update -y || echo 'Docker repository không tồn tại'";
        runCommandWithLog(dockerServer, "Bước 5: Xóa Docker repository", removeDockerRepoCmd, logs);

        // Bước 6: Xóa Docker GPG key
        String removeDockerGpgCmd = "sudo rm -f /etc/apt/keyrings/docker.gpg /usr/share/keyrings/docker-archive-keyring.gpg && echo 'Đã xóa Docker GPG keys' || echo 'Docker GPG keys không tồn tại'";
        runCommandWithLog(dockerServer, "Bước 6: Xóa Docker GPG keys", removeDockerGpgCmd, logs);

        // Bước 7: Xóa các file cấu hình Docker
        String removeDockerConfigCmd = String.join(" && ",
                "sudo rm -rf /var/lib/docker",
                "sudo rm -rf /var/lib/containerd",
                "sudo rm -rf /etc/docker",
                "sudo rm -rf ~/.docker",
                "sudo rm -rf /var/run/docker.sock",
                "sudo rm -rf /var/run/docker",
                "sudo rm -rf /var/run/containerd",
                "echo 'Đã xóa các file cấu hình Docker'"
        );
        runCommandWithLog(dockerServer, "Bước 7: Xóa các file cấu hình Docker", removeDockerConfigCmd, logs);

        // Bước 8: Xóa systemd service files
        String removeSystemdFilesCmd = String.join(" && ",
                "sudo rm -f /etc/systemd/system/docker.service",
                "sudo rm -f /etc/systemd/system/docker.socket",
                "sudo rm -f /usr/lib/systemd/system/docker.service",
                "sudo rm -f /usr/lib/systemd/system/docker.socket",
                "sudo rm -f /lib/systemd/system/docker.service",
                "sudo rm -f /lib/systemd/system/docker.socket",
                "sudo systemctl daemon-reload",
                "echo 'Đã xóa systemd service files'"
        );
        runCommandWithLog(dockerServer, "Bước 8: Xóa systemd service files", removeSystemdFilesCmd, logs);

        // Bước 9: Tìm và xóa tất cả các binary Docker còn sót lại
        String findAndRemoveDockerBinariesCmd = String.join(" && ",
                "sudo find /usr/bin /usr/local/bin /snap/bin -name 'docker*' -type f -exec rm -f {} \\; 2>/dev/null || true",
                "sudo find /usr/bin /usr/local/bin /snap/bin -name 'containerd*' -type f -exec rm -f {} \\; 2>/dev/null || true",
                "sudo find /usr/bin /usr/local/bin /snap/bin -name 'docker-compose*' -type f -exec rm -f {} \\; 2>/dev/null || true",
                "echo 'Đã xóa các Docker binaries còn sót lại'"
        );
        runCommandWithLog(dockerServer, "Bước 9: Tìm và xóa các Docker binaries còn sót lại", findAndRemoveDockerBinariesCmd, logs);

        // Bước 10: Xóa các symlink Docker
        String removeDockerSymlinksCmd = String.join(" && ",
                "sudo find /usr/bin /usr/local/bin -name 'docker*' -type l -exec rm -f {} \\; 2>/dev/null || true",
                "sudo find /usr/bin /usr/local/bin -name 'containerd*' -type l -exec rm -f {} \\; 2>/dev/null || true",
                "echo 'Đã xóa các Docker symlinks'"
        );
        runCommandWithLog(dockerServer, "Bước 10: Xóa các Docker symlinks", removeDockerSymlinksCmd, logs);

        // Bước 11: Xóa docker group và xóa user khỏi docker group
        String removeDockerGroupCmd = String.format(
                "sudo deluser %s docker 2>/dev/null || echo 'User không có trong docker group'; sudo groupdel docker 2>/dev/null || echo 'Docker group không tồn tại'",
                dockerServer.getUsername()
        );
        runCommandWithLog(dockerServer, "Bước 11: Xóa docker group và user khỏi group", removeDockerGroupCmd, logs);

        // Bước 12: Xóa các file còn sót lại từ các vị trí khác
        String removeOtherDockerFilesCmd = String.join(" && ",
                "sudo rm -rf /opt/docker",
                "sudo rm -rf /usr/share/docker",
                "sudo rm -rf /usr/libexec/docker",
                "sudo rm -rf /etc/default/docker",
                "sudo rm -rf /etc/init.d/docker",
                "echo 'Đã xóa các file Docker còn sót lại'"
        );
        runCommandWithLog(dockerServer, "Bước 12: Xóa các file Docker còn sót lại từ các vị trí khác", removeOtherDockerFilesCmd, logs);

        // Bước 13: Xác nhận Docker đã được gỡ hoàn toàn
        String verifyUninstallCmd = "which docker 2>/dev/null && echo 'CẢNH BÁO: Docker binary vẫn còn tồn tại' || echo 'Docker binary đã được xóa'";
        runCommandWithLog(dockerServer, "Bước 13: Kiểm tra Docker binary", verifyUninstallCmd, logs);

        // Bước 14: Kiểm tra các packages còn lại
        String checkRemainingPackagesCmd = "dpkg -l | grep -i docker || echo 'Không còn Docker packages nào từ apt'";
        runCommandWithLog(dockerServer, "Bước 14: Kiểm tra các Docker packages còn lại", checkRemainingPackagesCmd, logs);

        // Bước 15: Kiểm tra snap packages
        String checkSnapPackagesCmd = "snap list | grep -i docker || echo 'Không còn Docker packages nào từ snap'";
        runCommandWithLog(dockerServer, "Bước 15: Kiểm tra Docker packages từ snap", checkSnapPackagesCmd, logs);

        // Bước 16: Tìm tất cả các file Docker còn sót lại và báo cáo
        String findAllDockerFilesCmd = "sudo find /usr /opt /etc /var -name '*docker*' -type f 2>/dev/null | head -20 || echo 'Không tìm thấy file Docker nào'";
        runCommandWithLog(dockerServer, "Bước 16: Tìm các file Docker còn sót lại (top 20)", findAllDockerFilesCmd, logs);

        logs.add("===== Hoàn tất gỡ cài đặt Docker =====");
        logs.add(String.format("Docker đã được gỡ khỏi server %s (%s)", dockerServer.getName(), dockerServer.getIp()));
        logs.add("Lưu ý: Tất cả Docker images, containers, và volumes đã được xóa. Nếu cần giữ lại, hãy backup trước khi gỡ.");
        return logs;
    }

    // ================= Helper methods =================

    private ExecuteCommandResponse executeSSHCommand(ServerEntity server, String command) {
        ExecuteCommandRequest request = new ExecuteCommandRequest();
        request.setHost(server.getIp());
        request.setPort(server.getPort());
        request.setUsername(server.getUsername());
        request.setPassword(server.getPassword());
        request.setCommand(command);
        return sshService.executeCommand(request);
    }

    private boolean isServerReachable(ServerEntity server) {
        ExecuteCommandResponse response = executeSSHCommand(server, "echo HEALTHCHECK");
        return response.isSuccess();
    }

    private void runCommandWithLog(ServerEntity server, String description, String command, List<String> logs) {
        String prefix = String.format("  - [%s] ", description);
        try {
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
        }
    }

    private String buildKubesprayHostsYaml(List<ServerEntity> masters, List<ServerEntity> workers) {
        StringBuilder yaml = new StringBuilder();
        yaml.append("all:\n");
        yaml.append("  hosts:\n");

        for (ServerEntity master : masters) {
            String nodeName = sanitizeHostName(master.getName());
            yaml.append(String.format("    %s:\n", nodeName));
            yaml.append(String.format("      ansible_host: %s\n", master.getIp()));
            yaml.append(String.format("      ansible_user: %s\n", master.getUsername()));
            yaml.append(String.format("      ip: %s\n", master.getIp()));
            yaml.append(String.format("      access_ip: %s\n", master.getIp()));
        }
        for (ServerEntity worker : workers) {
            String nodeName = sanitizeHostName(worker.getName());
            yaml.append(String.format("    %s:\n", nodeName));
            yaml.append(String.format("      ansible_host: %s\n", worker.getIp()));
            yaml.append(String.format("      ansible_user: %s\n", worker.getUsername()));
            yaml.append(String.format("      ip: %s\n", worker.getIp()));
            yaml.append(String.format("      access_ip: %s\n", worker.getIp()));
        }

        yaml.append("  children:\n");

        yaml.append("    kube_control_plane:\n");
        yaml.append("      hosts:\n");
        for (ServerEntity master : masters) {
            yaml.append(String.format("        %s:\n", sanitizeHostName(master.getName())));
        }

        yaml.append("    kube_node:\n");
        yaml.append("      hosts:\n");
        for (ServerEntity master : masters) {
            yaml.append(String.format("        %s:\n", sanitizeHostName(master.getName())));
        }
        for (ServerEntity worker : workers) {
            yaml.append(String.format("        %s:\n", sanitizeHostName(worker.getName())));
        }

        yaml.append("    etcd:\n");
        yaml.append("      hosts:\n");
        for (ServerEntity master : masters) {
            yaml.append(String.format("        %s:\n", sanitizeHostName(master.getName())));
        }

        yaml.append("    k8s_cluster:\n");
        yaml.append("      children:\n");
        yaml.append("        kube_control_plane:\n");
        yaml.append("        kube_node:\n");

        yaml.append("    calico_rr:\n");
        yaml.append("      hosts: {}\n");

        return yaml.toString();
    }

    private String sanitizeHostName(String name) {
        if (name == null || name.isEmpty()) {
            return "node";
        }
        return name.toLowerCase().replaceAll("[^a-z0-9_-]", "_");
    }
}

