package my_spring_app.my_spring_app.dto.request;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NamespaceRequest {

    @NotBlank(message = "Namespace name is required")
    private String name;

    private Map<String, String> labels;
}


