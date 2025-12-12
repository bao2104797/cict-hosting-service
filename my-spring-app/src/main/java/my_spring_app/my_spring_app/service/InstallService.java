package my_spring_app.my_spring_app.service;

public interface InstallService {
    java.util.List<String> setupAnsibleOnK8sNodes();

    java.util.List<String> uninstallAnsibleFromK8sNodes();

    java.util.List<String> installKubernetesWithKubespray();

    java.util.List<String> uninstallKubernetesFromK8sNodes();

    java.util.List<String> installK8sAddons();

    java.util.List<String> uninstallK8sAddons();

    java.util.List<String> installMetricsServer();

    java.util.List<String> uninstallMetricsServer();

    java.util.List<String> installDocker();

    java.util.List<String> uninstallDocker();
}

