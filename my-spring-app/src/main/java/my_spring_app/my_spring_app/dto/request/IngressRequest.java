package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IngressRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Namespace is required")
    private String namespace;

    private String ingressClass;

    private List<String> hosts;

    private String address;

    private List<Integer> ports;
}

