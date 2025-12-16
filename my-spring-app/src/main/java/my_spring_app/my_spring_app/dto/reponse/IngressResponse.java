package my_spring_app.my_spring_app.dto.reponse;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IngressResponse {
    private String id;
    private String name;
    private String namespace;
    private String ingressClass;
    private List<String> hosts;
    private String address;
    private List<Integer> ports;
    private String age;
}

