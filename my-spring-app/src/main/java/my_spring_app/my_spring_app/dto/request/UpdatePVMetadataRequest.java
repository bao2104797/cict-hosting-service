package my_spring_app.my_spring_app.dto.request;

import lombok.Data;

import java.util.Map;

@Data
public class UpdatePVMetadataRequest {
    private Map<String, String> labels;
    private Map<String, String> annotations;
}


