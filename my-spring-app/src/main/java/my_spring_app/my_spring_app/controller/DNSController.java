package my_spring_app.my_spring_app.controller;

import lombok.RequiredArgsConstructor;
import my_spring_app.my_spring_app.dto.reponse.DNSCheckResponse;
import my_spring_app.my_spring_app.service.DNSService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dns")
@RequiredArgsConstructor
public class DNSController {

    private final DNSService dnsService;

    @GetMapping("/check")
    public ResponseEntity<DNSCheckResponse> checkDomain(@RequestParam("domainNameSystem") String domainNameSystem) {
        return ResponseEntity.ok(dnsService.checkDomain(domainNameSystem));
    }
}

