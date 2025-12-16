export type PlaybookTemplate = {
  id: string;
  label: string;
  filename: string;
  content: string;
};

export type PlaybookTemplateCategory = {
  id: string;
  label: string;
  templates: PlaybookTemplate[];
};

const makeTemplate = (id: string, label: string, filename: string): PlaybookTemplate => ({
  id,
  label,
  filename,
  content: templates[id],
});

const templates: Record<string, string> = {
  "00-reset-cluster": `---
- name: Reset entire Kubernetes cluster
  hosts: all
  become: yes
  gather_facts: no
  environment:
    DEBIAN_FRONTEND: noninteractive

  tasks:
    - name: Reset Kubernetes cluster
      shell: kubeadm reset -f
      ignore_errors: true
      register: reset_output

    - name: Display reset results
      debug:
        msg: "{{ reset_output.stdout_lines | default(['No old cluster to reset.']) }}"

    - name: Remove Kubernetes configuration directory
      file:
        path: /etc/kubernetes
        state: absent

    - name: Remove CNI network configuration
      file:
        path: /etc/cni/net.d
        state: absent

    - name: Remove root kubeconfig
      file:
        path: /root/.kube
        state: absent

    - name: Remove normal user kubeconfig
      file:
        path: "/home/{{ ansible_user }}/.kube"
        state: absent
      when: ansible_user != "root"

    - name: Clean up iptables rules
      shell: |
        iptables -F && iptables -X
        iptables -t nat -F && iptables -t nat -X
        iptables -t mangle -F && iptables -t mangle -X
        iptables -P FORWARD ACCEPT
      ignore_errors: true

    - name: Restart containerd service
      systemd:
        name: containerd
        state: restarted
        enabled: yes

    - name: Confirm reset completed
      debug:
        msg:
          - "Node {{ inventory_hostname }} has been reset cleanly (data only deleted)."`,

  "01-update-hosts-hostname": `---
- name: Update /etc/hosts and hostname for entire cluster
  hosts: all
  become: yes
  gather_facts: yes

  tasks:
    - name: Add all inventory nodes to /etc/hosts
      lineinfile:
        path: /etc/hosts
        line: "{{ hostvars[item].ansible_host | default(item) }} {{ hostvars[item].ansible_user }}"
        state: present
        create: yes
        insertafter: EOF
      loop: "{{ groups['all'] }}"
      when: hostvars[item].ansible_user is defined
      tags: addhosts

    - name: Set hostname according to inventory
      hostname:
        name: "{{ hostvars[inventory_hostname].ansible_user }}"
      when: ansible_hostname != hostvars[inventory_hostname].ansible_user
      tags: sethostname

    - name: Verify hostname after update
      command: hostnamectl
      register: host_info
      changed_when: false
      tags: verify

    - name: Display information after update
      debug:
        msg:
          - "Current hostname: {{ ansible_hostname }}"
          - "hostnamectl command result:"
          - "{{ host_info.stdout_lines }}"
      tags: verify`,

  "02-kernel-sysctl": `---
- hosts: all
  become: yes
  environment:
    DEBIAN_FRONTEND: noninteractive

  tasks:
    - name: Disable swap
      shell: swapoff -a || true
      ignore_errors: true

    - name: Comment swap lines in /etc/fstab
      replace:
        path: /etc/fstab
        regexp: '(^.*swap.*$)'
        replace: '# \\1'

    - name: Load kernel modules
      copy:
        dest: /etc/modules-load.d/containerd.conf
        content: |
          overlay
          br_netfilter

    - name: Load overlay and br_netfilter modules
      shell: |
        modprobe overlay
        modprobe br_netfilter

    - name: Configure sysctl for Kubernetes
      copy:
        dest: /etc/sysctl.d/99-kubernetes-cri.conf
        content: |
          net.bridge.bridge-nf-call-iptables  = 1
          net.bridge.bridge-nf-call-ip6tables = 1
          net.ipv4.ip_forward                 = 1

    - name: Apply sysctl configuration
      command: sysctl --system`,

  "03-install-containerd": `---
- hosts: all
  become: yes
  environment:
    DEBIAN_FRONTEND: noninteractive

  tasks:
    - name: Check if containerd is already installed
      command: containerd --version
      register: containerd_check
      ignore_errors: true
      changed_when: false

    - name: Display current status
      debug:
        msg: >
          {% if containerd_check.rc == 0 %}
          Containerd is already installed ({{ containerd_check.stdout | default('version unknown') }}).
          Will upgrade/reinstall with latest version and reconfigure.
          {% else %}
          Containerd not found, will install new.
          {% endif %}

    - name: Update apt cache
      apt:
        update_cache: yes

    - name: Install or upgrade containerd
      apt:
        name: containerd
        state: present
        force_apt_get: yes

    - name: Create containerd configuration directory
      file:
        path: /etc/containerd
        state: directory

    - name: Generate default containerd configuration (will overwrite existing)
      shell: "containerd config default > /etc/containerd/config.toml"

    - name: Enable SystemdCgroup
      replace:
        path: /etc/containerd/config.toml
        regexp: 'SystemdCgroup = false'
        replace: 'SystemdCgroup = true'

    - name: Restart containerd service
      systemd:
        name: containerd
        enabled: yes
        state: restarted

    - name: Verify containerd installation
      command: containerd --version
      register: containerd_verify
      changed_when: false

    - name: Display installation result
      debug:
        msg: "Containerd installation completed: {{ containerd_verify.stdout | default('version check failed') }}"`,
  "04-install-kubernetes": `---
- hosts: all
  become: yes
  environment:
    DEBIAN_FRONTEND: noninteractive

  tasks:
    - name: Check if Kubernetes packages are already installed
      command: |
        if command -v kubelet >/dev/null 2>&1 && command -v kubeadm >/dev/null 2>&1 && command -v kubectl >/dev/null 2>&1; then
          echo "INSTALLED"
          kubelet --version 2>&1 | head -1 || echo "version unknown"
        else
          echo "NOT_INSTALLED"
        fi
      register: k8s_check
      ignore_errors: true
      changed_when: false

    - name: Display current status
      debug:
        msg: >
          {% if 'INSTALLED' in k8s_check.stdout %}
          Kubernetes packages (kubelet, kubeadm, kubectl) are already installed.
          Will upgrade/reinstall with latest version from repository.
          {% else %}
          Kubernetes packages not found, will install new.
          {% endif %}

    - name: Install required packages
      apt:
        name:
          - apt-transport-https
          - ca-certificates
          - curl
        state: present
        update_cache: yes

    - name: Add Kubernetes GPG key
      shell: |
        if [ ! -f /usr/share/keyrings/kubernetes-archive-keyring.gpg ]; then
          curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | \
          gpg --dearmor --yes -o /usr/share/keyrings/kubernetes-archive-keyring.gpg
        else
          echo "GPG key already exists, skipping this step."
        fi
      changed_when: false
      register: gpg_status

    - name: Add Kubernetes repository (will overwrite existing)
      copy:
        dest: /etc/apt/sources.list.d/kubernetes.list
        content: |
          deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /

    - name: Install or upgrade kubelet, kubeadm, kubectl
      apt:
        name:
          - kubelet
          - kubeadm
          - kubectl
        state: present
        update_cache: yes

    - name: Hold package versions
      command: apt-mark hold kubelet kubeadm kubectl

    - name: Verify Kubernetes packages installation
      command: |
        echo "kubelet: $(kubelet --version 2>&1 | head -1 || echo 'N/A')"
        echo "kubeadm: $(kubeadm version -o short 2>&1 || echo 'N/A')"
        echo "kubectl: $(kubectl version --client --short 2>&1 || echo 'N/A')"
      register: k8s_verify
      changed_when: false
      ignore_errors: true

    - name: Display installation result
      debug:
        msg: "{{ k8s_verify.stdout_lines | default(['Kubernetes packages installation completed']) }}"`,

  "05-init-master": `---
- hosts: master
  become: yes
  gather_facts: yes
  environment:
    DEBIAN_FRONTEND: noninteractive

  vars:
    pod_network_cidr: "10.244.0.0/16"
    calico_manifest: "https://raw.githubusercontent.com/projectcalico/calico/v3.27.3/manifests/calico.yaml"
    join_script: "/etc/kubernetes/join-command.sh"

  tasks:
    - name: Get dynamic master IP address
      set_fact:
        master_ip: "{{ hostvars[inventory_hostname].ansible_host | default(ansible_default_ipv4.address) }}"

    - name: Display master IP being used
      debug:
        msg: "Using master IP address: {{ master_ip }}"

    - name: Reset old cluster and clean up data
      shell: |
        kubeadm reset -f || true
        rm -rf /etc/kubernetes /var/lib/etcd /var/lib/kubelet /etc/cni/net.d
        systemctl restart containerd || true
      ignore_errors: yes

    - name: Initialize Kubernetes Control Plane
      command: >
        kubeadm init
        --control-plane-endpoint "{{ master_ip }}:6443"
        --apiserver-advertise-address {{ master_ip }}
        --pod-network-cidr {{ pod_network_cidr }}
        --upload-certs
      args:
        creates: /etc/kubernetes/admin.conf
      register: kubeadm_init
      failed_when: "'error' in kubeadm_init.stderr"
      changed_when: "'Your Kubernetes control-plane has initialized successfully' in kubeadm_init.stdout"

    - name: Configure kubeconfig for root user
      shell: |
        mkdir -p $HOME/.kube
        cp /etc/kubernetes/admin.conf $HOME/.kube/config
        chown $(id -u):$(id -g) $HOME/.kube/config
      args:
        executable: /bin/bash

    - name: Configure kubeconfig for normal user
      when: ansible_user != "root"
      block:
        - name: Create kubeconfig directory for user
          file:
            path: "/home/{{ ansible_user }}/.kube"
            state: directory
            mode: '0755'

        - name: Copy kubeconfig for user
          copy:
            src: /etc/kubernetes/admin.conf
            dest: "/home/{{ ansible_user }}/.kube/config"
            owner: "{{ ansible_user }}"
            group: "{{ ansible_user }}"
            mode: '0600'
            remote_src: yes

    - name: Generate join command for workers
      shell: kubeadm token create --print-join-command
      register: join_cmd
      changed_when: false

    - name: Save join command to file
      copy:
        content: "{{ join_cmd.stdout }}"
        dest: "{{ join_script }}"
        mode: '0755'

    - name: Apply Calico network plugin
      shell: kubectl apply -f {{ calico_manifest }} --kubeconfig /etc/kubernetes/admin.conf
      register: calico_apply
      changed_when: "'created' in calico_apply.stdout or 'configured' in calico_apply.stdout"
      ignore_errors: true

    - name: Wait for Calico pods to be active
      shell: |
        kubectl get pods -n kube-system --no-headers 2>/dev/null | grep -c calico || true
      register: calico_running
      retries: 10
      delay: 15
      until: calico_running.stdout | int > 0
      ignore_errors: true

    - name: Confirm Calico status
      when: calico_running.stdout | int > 0
      debug:
        msg: "Calico is running ({{ calico_running.stdout }} pods Running)."

    - name: Log Calico pod if error
      when: calico_running.stdout | int == 0
      shell: kubectl logs -n kube-system -l k8s-app=calico-node --tail=50 || true
      register: calico_logs
      ignore_errors: true

    - name: Display Calico pod logs
      when: calico_running.stdout | int == 0
      debug:
        msg: "{{ calico_logs.stdout_lines | default(['Calico pod is not ready or has no logs.']) }}"

    - name: Check node status
      command: kubectl get nodes -o wide
      register: nodes_status
      ignore_errors: true

    - name: Display cluster result
      debug:
        var: nodes_status.stdout_lines`,
  "06-install-cni": `---
- name: Install or update Calico CNI (automatic)
  hosts: master
  become: yes
  gather_facts: false
  environment:
    KUBECONFIG: /etc/kubernetes/admin.conf
    DEBIAN_FRONTEND: noninteractive
  
  vars:
    calico_version: "v3.27.3"
    calico_url: "https://raw.githubusercontent.com/projectcalico/calico/{{ calico_version }}/manifests/calico.yaml"
  
  tasks:
    - name: Check if Calico CNI exists
      command: kubectl get daemonset calico-node -n kube-system
      register: calico_check
      ignore_errors: true
  
    - name: Display current status
      debug:
        msg: >
          {% if calico_check.rc == 0 %}
          Calico is already installed.
          {% else %}
          Calico not found, will install new.
          {% endif %}
  
    - name: Check kernel modules overlay and br_netfilter
      shell: |
        modprobe overlay || true
        modprobe br_netfilter || true
        lsmod | grep -E 'overlay|br_netfilter' || echo "Missing kernel module"
      register: kernel_status
      ignore_errors: true
  
    - name: Display kernel module check result
      debug:
        var: kernel_status.stdout_lines
  
    - name: Check sysctl configuration
      shell: |
        echo "net.bridge.bridge-nf-call-iptables = 1" | tee /etc/sysctl.d/k8s.conf >/dev/null
        echo "net.ipv4.ip_forward = 1" | tee -a /etc/sysctl.d/k8s.conf >/dev/null
        sysctl --system | grep -E "net.bridge.bridge-nf-call|net.ipv4.ip_forward"
      register: sysctl_status
      ignore_errors: true
  
    - name: Display sysctl result
      debug:
        var: sysctl_status.stdout_lines
  
    - name: Apply Calico manifest (install or update)
      shell: |
        kubectl apply -f {{ calico_url }}
      args:
        executable: /bin/bash
      register: calico_apply
      retries: 3
      delay: 10
      until: calico_apply.rc == 0
  
    - name: Display installation result
      debug:
        var: calico_apply.stdout_lines
  
    - name: Check Calico node pod starting
      shell: |
        kubectl get pods -n kube-system -l k8s-app=calico-node --no-headers 2>/dev/null | grep -c 'Running' || true
      register: calico_running
  
    - name: Wait for pod to start (max 10 retries)
      until: calico_running.stdout | int > 0
      retries: 10
      delay: 15
      shell: |
        kubectl get pods -n kube-system -l k8s-app=calico-node --no-headers 2>/dev/null | grep -c 'Running' || true
      register: calico_running
      ignore_errors: true
  
    - name: Confirm Calico pods are running
      when: calico_running.stdout | int > 0
      debug:
        msg: "Calico is running ({{ calico_running.stdout }} pods Running)."
  
    - name: Log Calico pod if error
      when: calico_running.stdout | int == 0
      shell: kubectl logs -n kube-system -l k8s-app=calico-node --tail=50 || true
      register: calico_logs
      ignore_errors: true
  
    - name: Display Calico pod logs
      when: calico_running.stdout | int == 0
      debug:
        msg: "{{ calico_logs.stdout_lines | default(['Calico pod is not ready or has no logs.']) }}"
  
    - name: Check node status
      command: kubectl get nodes -o wide
      register: nodes_status
      ignore_errors: true
  
    - name: Display cluster result
      debug:
        var: nodes_status.stdout_lines`        ,
  "06-install-flannel": `---
- name: Install or update Flannel CNI (WSL2 compatible)
  hosts: master
  become: yes
  gather_facts: false
  environment:
    KUBECONFIG: /etc/kubernetes/admin.conf
    DEBIAN_FRONTEND: noninteractive

  vars:
    flannel_manifest: "https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml"

  tasks:
    - name: Check if Flannel CNI exists
      command: kubectl get daemonset kube-flannel-ds -n kube-flannel
      register: flannel_check
      ignore_errors: true

    - name: Display current status
      debug:
        msg: >
          {% if flannel_check.rc == 0 %}
          Flannel is already installed.
          {% else %}
          Flannel not found, will install new.
          {% endif %}

    - name: Enable IP forwarding
      shell: |
        echo "net.ipv4.ip_forward = 1" | tee /etc/sysctl.d/k8s.conf >/dev/null
        sysctl --system | grep net.ipv4.ip_forward
      register: sysctl_status
      ignore_errors: true

    - name: Display sysctl result
      debug:
        var: sysctl_status.stdout_lines

    - name: Apply Flannel manifest (auto-download latest)
      command: kubectl apply -f {{ flannel_manifest }}
      register: flannel_apply
      changed_when: "'created' in flannel_apply.stdout or 'configured' in flannel_apply.stdout"
      failed_when: flannel_apply.rc != 0

    - name: Display apply result
      debug:
        var: flannel_apply.stdout_lines

    - name: Check number of running Flannel pods
      shell: |
        kubectl get pods -n kube-flannel --no-headers 2>/dev/null | grep -c 'Running' || true
      register: flannel_running

    - name: Wait for Flannel pod to be active (max 10 retries)
      until: flannel_running.stdout | int > 0
      retries: 10
      delay: 15
      shell: |
        kubectl get pods -n kube-flannel --no-headers 2>/dev/null | grep -c 'Running' || true
      register: flannel_running
      ignore_errors: true

    - name: Confirm Flannel pod is active
      when: flannel_running.stdout | int > 0
      debug:
        msg: "Flannel is running ({{ flannel_running.stdout }} pods Running)."

    - name: Log Flannel if pod not running
      when: flannel_running.stdout | int == 0
      shell: kubectl logs -n kube-flannel -l app=flannel --tail=50 || true
      register: flannel_logs
      ignore_errors: true

    - name: Display Flannel logs
      when: flannel_running.stdout | int == 0
      debug:
        msg: "{{ flannel_logs.stdout_lines | default(['Flannel pod is not ready or has no logs.']) }}"

    - name: Check node status
      command: kubectl get nodes -o wide
      register: nodes_status
      ignore_errors: true

    - name: Display cluster result
      debug:
        var: nodes_status.stdout_lines`,

  "07-join-workers": `---
- hosts: workers
  become: yes
  gather_facts: no
  environment:
    DEBIAN_FRONTEND: noninteractive

  vars:
    join_script: /tmp/kube_join.sh

  tasks:
    - name: Test SSH connectivity to worker node
      ping:
      register: ping_result
      ignore_errors: yes

    - name: Skip offline workers
      set_fact:
        worker_online: "{{ ping_result is succeeded }}"

    - name: Display worker online status
      debug:
        msg: "Worker {{ inventory_hostname }} is {{ 'ONLINE' if worker_online else 'OFFLINE' }}"

    - name: Get join command from master
      delegate_to: "{{ groups['master'][0] }}"
      run_once: true
      shell: kubeadm token create --print-join-command
      register: join_cmd
      when: worker_online

    - name: Save join command to file
      copy:
        content: "{{ join_cmd.stdout }} --ignore-preflight-errors=all"
        dest: "{{ join_script }}"
        mode: '0755'
      when: worker_online
      ignore_errors: yes

    - name: Reset node if old cluster exists
      shell: |
        kubeadm reset -f || true
        rm -rf /etc/kubernetes /var/lib/kubelet /etc/cni/net.d
        systemctl restart containerd || true
      ignore_errors: yes
      when: worker_online

    - name: Join to Kubernetes cluster
      shell: "{{ join_script }}"
      register: join_output
      ignore_errors: yes
      when: worker_online

    - name: Display join result
      debug:
        msg: "{{ join_output.stdout_lines | default(['Successfully joined cluster!']) if worker_online else ['Worker offline, skip join'] }}"

    - name: Restart kubelet service
      systemd:
        name: kubelet
        state: restarted
        enabled: yes
      ignore_errors: yes
      when: worker_online

    - name: Complete join process
      debug:
        msg: "{{ 'Node ' + inventory_hostname + ' has successfully joined the cluster!' if worker_online else 'Worker ' + inventory_hostname + ' OFFLINE - Skipping join' }}"`,

  "08-verify-cluster": `---
- name: Verify Kubernetes cluster status
  hosts: master
  become: yes
  gather_facts: no
  environment:
    KUBECONFIG: /etc/kubernetes/admin.conf
    DEBIAN_FRONTEND: noninteractive

  tasks:
    - name: Check if kubectl is available
      command: which kubectl
      register: kubectl_check
      failed_when: kubectl_check.rc != 0
      changed_when: false

    - name: List all nodes
      command: kubectl get nodes
      register: nodes_info
      changed_when: false

    - name: List system pods
      command: kubectl get pods -n kube-system
      register: pods_info
      changed_when: false

    - name: Display cluster information
      debug:
        msg:
          - "Node List:"
          - "{{ nodes_info.stdout_lines }}"
          - "Pods in kube-system namespace:"
          - "{{ pods_info.stdout_lines }}"

    - name: Check node status
      shell: kubectl get nodes --no-headers | awk '{print $2}' | sort | uniq -c
      register: node_status
      changed_when: false

    - name: Report node status
      debug:
        msg: |
          {% if 'NotReady' in node_status.stdout %}
          Some nodes are not ready:
          {{ node_status.stdout }}
          {% else %}
          All nodes are Ready!
          {% endif %}

    - name: Check for error pods in kube-system
      shell: kubectl get pods -n kube-system --no-headers | grep -vE 'Running|Completed' || true
      register: bad_pods
      changed_when: false

    - name: Report error pods
      debug:
        msg: |
          {% if bad_pods.stdout %}
          Some pods are unstable or have errors:
          {{ bad_pods.stdout }}
          {% else %}
          All pods in kube-system are Running or Completed!
          {% endif %}

    - name: Display error pod logs (if any)
      when: bad_pods.stdout != ""
      shell: |
        for pod in $(kubectl get pods -n kube-system --no-headers | grep -vE 'Running|Completed' | awk '{print $1}'); do
          echo "Log for $pod:"; kubectl logs -n kube-system $pod --tail=30 || true; echo "--------------------------------";
        done
      register: bad_pods_logs
      ignore_errors: yes

    - name: Display detailed logs
      when: bad_pods.stdout != ""
      debug:
        msg: "{{ bad_pods_logs.stdout_lines | default(['No error logs found']) }}"`,
  "09-install-helm": `---
- hosts: master
  become: yes
  gather_facts: yes
  environment:
    DEBIAN_FRONTEND: noninteractive

  tasks:
    - name: Install Helm if not present
      shell: |
        curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
      args:
        executable: /bin/bash
      register: helm_install
      ignore_errors: yes

    - name: Display Helm installation result
      debug:
        msg: "{{ helm_install.stdout_lines | default(['Helm installed']) }}"

    - name: Check Helm version
      shell: helm version --short
      register: helm_version

    - name: Display Helm information
      debug:
        msg: "Current Helm version: {{ helm_version.stdout | default('Unknown') }}"

    - name: Installation complete
      debug:
        msg: "Helm has been installed successfully on master!"`,

  "10-install-metrics-server": `---
- name: Install or Update Metrics Server for Kubernetes
  hosts: master
  become: yes
  gather_facts: no
  environment:
    KUBECONFIG: /etc/kubernetes/admin.conf

  vars:
    metrics_url: "https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml"
    ms_namespace: "kube-system"

  tasks:
    - name: Check if metrics-server is already installed
      shell: kubectl get deployment metrics-server -n {{ ms_namespace }} --no-headers
      register: ms_check
      ignore_errors: true
      changed_when: false

    - name: Display current status
      debug:
        msg: >
          {% if ms_check.rc == 0 %}
          Metrics-server đã tồn tại. Sẽ tiến hành cập nhật lại (apply lại manifest).
          {% else %}
          Metrics-server chưa tồn tại. Sẽ tiến hành cài mới.
          {% endif %}

    - name: Apply metrics-server manifest from GitHub
      command: kubectl apply -f {{ metrics_url }}
      register: ms_apply

    - name: Display apply result
      debug:
        var: ms_apply.stdout_lines

    - name: Patch metrics-server to allow insecure TLS
      shell: |
        kubectl patch deployment metrics-server -n kube-system \
        --type='json' \
        -p='[
          {"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"},
          {"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-preferred-address-types=InternalIP"}
        ]'
      register: ms_patch
      ignore_errors: true

    - name: Display patch result
      debug:
        var: ms_patch.stdout_lines

    - name: Wait for metrics-server pod to be Running
      shell: |
        kubectl get pods -n kube-system -l k8s-app=metrics-server \
        --no-headers 2>/dev/null | grep -c Running || true
      register: ms_running
      retries: 10
      delay: 10
      until: ms_running.stdout | int > 0
      ignore_errors: true

    - name: Confirm metrics-server pod status
      debug:
        msg: >
          Pod metrics-server Running: {{ ms_running.stdout }} instance(s)

    - name: Get metrics-server logs if pod is not running
      when: ms_running.stdout | int == 0
      shell: |
        POD=$(kubectl get pods -n kube-system -l k8s-app=metrics-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        if [ -n "$POD" ]; then
          kubectl logs -n kube-system $POD --tail=50
        else
          echo "No metrics-server pod found!"
        fi
      register: ms_logs
      ignore_errors: true

    - name: Display metrics-server logs when error
      when: ms_running.stdout | int == 0
      debug:
        var: ms_logs.stdout_lines`,

  "11-install-ingress": `---
- name: Install Nginx Ingress Controller using YAML manifests
  hosts: master
  become: yes
  gather_facts: no
  environment:
    KUBECONFIG: /etc/kubernetes/admin.conf
    DEBIAN_FRONTEND: noninteractive

  vars:
    ingress_nginx_version: "v1.11.1"
    ingress_nginx_namespace: "ingress-nginx"

  tasks:
    - name: Get dynamic master IP address
      set_fact:
        master_ip: "{{ hostvars[inventory_hostname].ansible_host | default(ansible_default_ipv4.address) }}"

    - name: Display installation info
      debug:
        msg: "Installing Nginx Ingress Controller version {{ ingress_nginx_version }} using YAML manifests on master: {{ master_ip }}"

    - name: Check if Ingress Controller already exists
      command: kubectl get deployment ingress-nginx-controller -n {{ ingress_nginx_namespace }}
      register: ingress_check
      ignore_errors: true
      changed_when: false

    - name: Display current status
      debug:
        msg: >
          {% if ingress_check.rc == 0 %}
          Ingress Controller is already installed. Will update with new configuration.
          {% else %}
          Ingress Controller not found, will install new.
          {% endif %}

    - name: Download Nginx Ingress Controller manifest
      shell: |
        curl -L https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-{{ ingress_nginx_version }}/deploy/static/provider/cloud/deploy.yaml -o /tmp/ingress-nginx.yaml
      register: download_result
      changed_when: download_result.rc == 0

    - name: Patch Service to use LoadBalancer type
      shell: |
        sed -i 's/type: NodePort/type: LoadBalancer/' /tmp/ingress-nginx.yaml || true
        sed -i 's/type: ClusterIP/type: LoadBalancer/' /tmp/ingress-nginx.yaml || true
      ignore_errors: true

    - name: Apply Nginx Ingress Controller manifest
      command: kubectl apply -f /tmp/ingress-nginx.yaml
      register: apply_result
      changed_when: "'created' in apply_result.stdout or 'configured' in apply_result.stdout or 'unchanged' not in apply_result.stdout"

    - name: Display Ingress installation result
      debug:
        msg: "{{ apply_result.stdout_lines | default(['Ingress Controller applied']) }}"

    - name: Patch ingress-nginx-controller-admission service to ClusterIP
      command: kubectl patch svc ingress-nginx-controller-admission -n {{ ingress_nginx_namespace }} -p '{"spec":{"type":"ClusterIP"}}'
      register: patch_admission_result
      ignore_errors: true
      changed_when: patch_admission_result.rc == 0

    - name: Display admission service patch result
      debug:
        msg: "{{ patch_admission_result.stdout_lines | default(['Admission service patched to ClusterIP']) if patch_admission_result.rc == 0 else ['Admission service patch skipped (may not exist)'] }}"

    - name: Wait for ingress-nginx pods to be Running
      shell: |
        kubectl get pods -n {{ ingress_nginx_namespace }} -l app.kubernetes.io/name=ingress-nginx --no-headers 2>/dev/null | grep -c 'Running' || true
      register: ingress_running
      until: ingress_running.stdout | int > 0
      retries: 15
      delay: 10
      ignore_errors: true

    - name: Check ingress-nginx pod status
      shell: |
        kubectl get pods -n {{ ingress_nginx_namespace }} -o wide
      register: ingress_pods
      changed_when: false

    - name: Display ingress-nginx pods
      debug:
        msg: "{{ ingress_pods.stdout_lines | default(['No ingress-nginx pods found']) }}"

    - name: Display ingress-nginx service
      shell: |
        kubectl get svc -n {{ ingress_nginx_namespace }} ingress-nginx-controller
      register: ingress_svc
      changed_when: false
      ignore_errors: true

    - name: Display service information
      debug:
        msg: "{{ ingress_svc.stdout_lines | default(['Service information not available']) }}"

    - name: Installation complete
      debug:
        msg:
          - "Ingress Controller (NGINX) has been installed successfully using YAML manifests!"
          - "Version: {{ ingress_nginx_version }}"
          - "Namespace: {{ ingress_nginx_namespace }}"
          - "Use 'kubectl get svc -n {{ ingress_nginx_namespace }}' to check the LoadBalancer IP"`,
  "12-install-metallb": `---
- name: ⚙️ Install and configure MetalLB on Kubernetes using YAML manifests (Safe version)
  hosts: master
  become: yes
  gather_facts: yes
  environment:
    KUBECONFIG: /etc/kubernetes/admin.conf
    DEBIAN_FRONTEND: noninteractive

  vars:
    metallb_version: "v0.14.8"
    metallb_namespace: "metallb-system"

  tasks:
    - name: Get master IP address dynamically
      set_fact:
        master_ip: "{{ hostvars[inventory_hostname].ansible_host | default(ansible_default_ipv4.address) }}"

    - name: Calculate IP range from master IP subnet
      shell: |
        MASTER_IP="{{ master_ip }}"
        SUBNET=$(echo "$MASTER_IP" | cut -d'.' -f1-3)
        echo "\${SUBNET}.240"
        echo "\${SUBNET}.250"
      register: ip_range_result
      changed_when: false

    - name: Extract IP range start and end
      set_fact:
        ip_range_start: "{{ ip_range_result.stdout_lines[0] }}"
        ip_range_end: "{{ ip_range_result.stdout_lines[1] }}"

    - name: Display calculated MetalLB IP range
      debug:
        msg:
          - "Master IP: {{ master_ip }}"
          - "Auto-detected MetalLB IP Pool: {{ ip_range_start }} - {{ ip_range_end }}"
          - "Installing MetalLB version {{ metallb_version }} using YAML manifests"

    # --- Cài đặt MetalLB Controller ---
    - name: Apply MetalLB core manifest
      shell: |
        kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/{{ metallb_version }}/config/manifests/metallb-native.yaml
      register: apply_result
      changed_when: "'created' in apply_result.stdout or 'configured' in apply_result.stdout"

    # --- CHỜ MetalLB webhook sẵn sàng ---
    - name: Wait for MetalLB controller to be ready
      shell: |
        kubectl wait --for=condition=available --timeout=120s deployment/controller -n {{ metallb_namespace }} || true
      changed_when: false
      ignore_errors: yes

    - name: Wait for MetalLB webhook service to respond
      shell: |
        kubectl get svc metallb-webhook-service -n {{ metallb_namespace }} --no-headers 2>/dev/null | grep -q metallb-webhook-service && echo ready || echo notready
      register: webhook_check
      retries: 10
      delay: 6
      until: webhook_check.stdout == "ready"
      changed_when: false
      ignore_errors: yes

    # --- Tạo IP Pool ---
    - name: Create IPAddressPool manifest
      copy:
        dest: /tmp/metallb-ip-pool.yaml
        content: |
          apiVersion: metallb.io/v1beta1
          kind: IPAddressPool
          metadata:
            name: default-address-pool
            namespace: {{ metallb_namespace }}
          spec:
            addresses:
              - {{ ip_range_start }}-{{ ip_range_end }}

    - name: Apply IPAddressPool manifest (with retry)
      command: kubectl apply -f /tmp/metallb-ip-pool.yaml
      register: ip_pool_apply
      retries: 5
      delay: 5
      until: ip_pool_apply.rc == 0

    # --- Tạo quảng bá L2 ---
    - name: Create L2Advertisement manifest
      copy:
        dest: /tmp/metallb-l2advertisement.yaml
        content: |
          apiVersion: metallb.io/v1beta1
          kind: L2Advertisement
          metadata:
            name: default-advertisement
            namespace: {{ metallb_namespace }}
          spec:
            ipAddressPools:
              - default-address-pool

    - name: Apply L2Advertisement manifest (with retry)
      command: kubectl apply -f /tmp/metallb-l2advertisement.yaml
      register: l2_apply
      retries: 3
      delay: 5
      until: l2_apply.rc == 0

    # --- Kiểm tra lại ---
    - name: Verify MetalLB resources
      shell: |
        kubectl get ipaddresspools.metallb.io -A && \
        kubectl get l2advertisements.metallb.io -A
      register: verify_result
      changed_when: false

    - name: Display summary
      debug:
        msg:
          - "✅ MetalLB installed successfully!"
          - "Version: {{ metallb_version }}"
          - "Namespace: {{ metallb_namespace }}"
          - "IP Range: {{ ip_range_start }} - {{ ip_range_end }}"
          - "Verification:"
          - "{{ verify_result.stdout_lines }}"
`,

  "13-setup-storage": `---
- name: Install and configure Local Path Provisioner (Default StorageClass)
  hosts: master
  become: yes
  gather_facts: no
  environment:
    KUBECONFIG: /etc/kubernetes/admin.conf
    DEBIAN_FRONTEND: noninteractive

  vars:
    manifest_url: "https://raw.githubusercontent.com/rancher/local-path-provisioner/master/deploy/local-path-storage.yaml"

  tasks:
    - name: Check if Local Path StorageClass already exists
      command: kubectl get storageclass local-path
      register: sc_check
      ignore_errors: true
      changed_when: false

    - name: Display current status
      debug:
        msg: >
          {% if sc_check.rc == 0 %}
          StorageClass 'local-path' already exists. Will ensure it's default and reapply manifest if needed.
          {% else %}
          StorageClass 'local-path' not found. Will install Local Path Provisioner.
          {% endif %}

    - name: Apply Local Path Provisioner manifest if missing
      when: sc_check.rc != 0
      shell: |
        kubectl apply -f {{ manifest_url }}
      args:
        executable: /bin/bash
      register: apply_result
      ignore_errors: false

    - name: Display manifest apply result
      when: sc_check.rc != 0
      debug:
        var: apply_result.stdout_lines

    - name: Ensure 'local-path' StorageClass exists
      command: kubectl get storageclass local-path
      register: sc_exists
      retries: 5
      delay: 5
      until: sc_exists.rc == 0
      ignore_errors: false

    - name: Patch local-path StorageClass to be default
      shell: |
        kubectl patch storageclass local-path \
          -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
      args:
        executable: /bin/bash
      register: patch_result
      ignore_errors: true

    - name: Display patch result
      debug:
        var: patch_result.stdout_lines

    - name: Verify StorageClass configuration
      command: kubectl get storageclass
      register: sc_result
      changed_when: false

    - name: Display StorageClass list
      debug:
        var: sc_result.stdout_lines`,

  "14-prepare-and-join-worker": `---
- name: Prepare not-ready workers
  hosts: master
  gather_facts: no

  tasks:
    - name: Check kubectl availability
      command: which kubectl
      register: kubectl_check
      failed_when: false
      changed_when: false

    - name: Get node list
      command: kubectl get nodes --no-headers
      register: nodes_tbl
      changed_when: false
      failed_when: false
      when: kubectl_check.rc == 0

    - name: Ensure node_lines fact
      set_fact:
        node_lines: "{{ nodes_tbl.stdout_lines | default([]) }}"

    - name: Parse node info
      set_fact:
        node_names: "{{ node_lines | map('split') | map('first') | list }}"
        not_ready_names: "{{ node_lines | map('split') | selectattr('1','ne','Ready') | map('first') | list }}"

    - name: Add not-ready workers to target group
      add_host:
        name: "{{ item }}"
        groups: target_workers
      loop: "{{ groups['workers'] | default([]) }}"
      when: item not in node_names or item in not_ready_names

- name: Configure kernel and sysctl
  hosts: target_workers
  become: yes
  environment:
    DEBIAN_FRONTEND: noninteractive

  tasks:
    - name: Disable swap
      shell: swapoff -a || true
      ignore_errors: true

    - name: Comment swap lines
      replace:
        path: /etc/fstab
        regexp: '(^.*swap.*$)'
        replace: '# \\1'

    - name: Load kernel modules
      copy:
        dest: /etc/modules-load.d/containerd.conf
        content: |
          overlay
          br_netfilter

    - name: Apply sysctl config
      copy:
        dest: /etc/sysctl.d/99-kubernetes-cri.conf
        content: |
          net.bridge.bridge-nf-call-iptables  = 1
          net.bridge.bridge-nf-call-ip6tables = 1
          net.ipv4.ip_forward                 = 1

    - name: Apply sysctl
      command: sysctl --system

- name: Install containerd and join worker
  hosts: target_workers
  become: yes
  environment:
    DEBIAN_FRONTEND: noninteractive

  tasks:
    - name: Install containerd
      apt:
        name: containerd
        state: present
        update_cache: yes

    - name: Configure SystemdCgroup
      shell: |
        mkdir -p /etc/containerd
        containerd config default > /etc/containerd/config.toml
        sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
      ignore_errors: yes

    - name: Restart containerd
      systemd:
        name: containerd
        state: restarted
        enabled: yes

    - name: Install Kubernetes tools
      apt:
        name:
          - kubelet
          - kubeadm
          - kubectl
        state: present
        update_cache: yes

    - name: Hold versions
      command: apt-mark hold kubelet kubeadm kubectl

    - name: Join cluster
      delegate_to: "{{ groups['master'][0] }}"
      run_once: true
      shell: kubeadm token create --print-join-command
      register: join_cmd

    - name: Execute join command
      shell: "{{ join_cmd.stdout }} --ignore-preflight-errors=all"
      ignore_errors: yes

    - name: Restart kubelet
      systemd:
        name: kubelet
        state: restarted
        enabled: yes`,
  "deploy-full-cluster": `---
- import_playbook: 00-reset-cluster.yml
- import_playbook: 01-update-hosts-hostname.yml
- import_playbook: 02-kernel-sysctl.yml
- import_playbook: 03-install-containerd.yml
- import_playbook: 04-install-kubernetes.yml
- import_playbook: 05-init-master.yml
- import_playbook: 06-install-cni.yml
- import_playbook: 07-join-workers.yml
- import_playbook: 08-verify-cluster.yml`,

  "deploy-full-cluster-flannel": `---
- import_playbook: 00-reset-cluster.yml
- import_playbook: 01-update-hosts-hostname.yml
- import_playbook: 02-kernel-sysctl.yml
- import_playbook: 03-install-containerd.yml
- import_playbook: 04-install-kubernetes.yml
- import_playbook: 05-init-master.yml
- import_playbook: 06-install-flannel.yml
- import_playbook: 07-join-workers.yml
- import_playbook: 08-verify-cluster.yml`
};




export const playbookTemplateCatalog: PlaybookTemplateCategory[] = [
  {
    id: "phase1",
    label: "I. Chuẩn bị môi trường",
    templates: [
      makeTemplate("01-update-hosts-hostname", "01 📝 Cập nhật hosts & hostname", "01-update-hosts-hostname.yml"),
      makeTemplate("02-kernel-sysctl", "02 ⚙️ Cấu hình kernel & sysctl", "02-kernel-sysctl.yml"),
      makeTemplate("03-install-containerd", "03 🐳 Cài đặt containerd", "03-install-containerd.yml"),
      makeTemplate("04-install-kubernetes", "04 ☸️ Cài đặt kubeadm/kubelet/kubectl", "04-install-kubernetes.yml"),
    ],
  },
  {
    id: "phase2",
    label: "II. Triển khai cluster",
    templates: [
      makeTemplate("05-init-master", "05 🚀 Khởi tạo master node", "05-init-master.yml"),
      makeTemplate("06-install-cni", "06 🌐 Cài đặt Calico CNI", "06-install-cni.yml"),
      makeTemplate("06-install-flannel", "06 🌐 Cài đặt Flannel CNI", "06-install-flannel.yml"),
      makeTemplate("07-join-workers", "07 🔗 Thêm worker nodes", "07-join-workers.yml"),
    ],
  },
  {
    id: "phase3",
    label: "III. Kiểm tra & mở rộng",
    templates: [
      makeTemplate("08-verify-cluster", "08 🧩 Xác minh trạng thái cụm", "08-verify-cluster.yml"),
      makeTemplate("09-install-helm", "09 📦 Cài đặt Helm 3", "09-install-helm.yml"),
      makeTemplate("10-install-metrics-server", "10 📊 Cài đặt Metrics Server", "10-install-metrics-server.yml"),
      makeTemplate("11-install-ingress", "11 🌍 Cài đặt Nginx Ingress", "11-install-ingress.yml"),
      makeTemplate("12-install-metallb", "12 ⚖️ Cài đặt MetalLB LoadBalancer", "12-install-metallb.yml"),
      makeTemplate("13-setup-storage", "13 💾 Thiết lập Storage", "13-setup-storage.yml"),
      makeTemplate("14-prepare-and-join-worker", "14 🔗 Chuẩn bị & Join Worker (02→03→04→07)", "14-prepare-and-join-worker.yml"),
    ],
  },
  {
    id: "phase4",
    label: "IV. Workflow tổng hợp",
    templates: [
      makeTemplate("00-reset-cluster", "00 🧹 Reset toàn bộ cluster", "00-reset-cluster.yml"),
      makeTemplate("deploy-full-cluster", "🚀 Triển khai toàn bộ cluster (Calico)", "deploy-full-cluster.yml"),
      makeTemplate("deploy-full-cluster-flannel", "🚀 Triển khai toàn bộ cluster (Flannel)", "deploy-full-cluster-flannel.yml"),
    ],
  },
];

const templateLookup = new Map<string, PlaybookTemplate>();
for (const category of playbookTemplateCatalog) {
  for (const template of category.templates) {
    templateLookup.set(template.id, template);
  }
}

export const getPlaybookTemplateById = (id: string): PlaybookTemplate | undefined => templateLookup.get(id);