package my_spring_app.my_spring_app.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScaleRequest {

    @NotNull(message = "Replicas value is required")
    @Min(value = 0, message = "Replicas must be greater or equal 0")
    private Integer replicas;
}


