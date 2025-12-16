package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DockerStatusResponse {
    /**
     * true nếu Docker đã được cài đặt (tìm thấy lệnh `docker` và lấy được version).
     */
    private Boolean installed;

    /**
     * Phiên bản Docker, ví dụ: "25.0.3" hoặc "Unknown" nếu không parse được.
     */
    private String version;

    /**
     * IP của server được chọn làm Docker host (server có role=DOCKER).
     */
    private String dockerHost;

    /**
     * Role của server (mặc định là "DOCKER").
     */
    private String dockerRole;

    /**
     * Thông báo lỗi nếu không tìm thấy server, server offline, hoặc Docker chưa cài.
     */
    private String error;
}


