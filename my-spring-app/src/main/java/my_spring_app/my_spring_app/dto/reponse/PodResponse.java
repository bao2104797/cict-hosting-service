package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PodResponse {
    private String id;
    private String name;
    private String namespace;
    private ReadyInfo ready;
    private String node;
    private String status; // Pod status from Kubernetes (Running, Pending, Failed, Succeeded, Unknown, CrashLoopBackOff, ImagePullBackOff, Error, etc.)
    private Integer restarts;
    private String age;
    private String ip;
    private String cpu;
    private String memory;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReadyInfo {
        private Integer ready;
        private Integer total;
    }
}

