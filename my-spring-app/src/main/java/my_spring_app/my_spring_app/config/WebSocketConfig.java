package my_spring_app.my_spring_app.config;

import my_spring_app.my_spring_app.service.ServerService;
import my_spring_app.my_spring_app.ws.TerminalWebSocketHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ServerService serverService;

    public WebSocketConfig(ServerService serverService) {
        this.serverService = serverService;
    }

    @Bean
    @NonNull
    public TerminalWebSocketHandler terminalWebSocketHandler() {
        return new TerminalWebSocketHandler(serverService);
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        HttpSessionHandshakeInterceptor httpSessionInterceptor = new HttpSessionHandshakeInterceptor();
        try {
            // Copy session attributes từ HTTP sang WebSocket
            java.lang.reflect.Method m = HttpSessionHandshakeInterceptor.class.getMethod("setCopyAllAttributes", boolean.class);
            m.invoke(httpSessionInterceptor, true);
        } catch (Throwable ignored) {
            // Ignore nếu method không tồn tại
        }
        
        registry.addHandler(terminalWebSocketHandler(), "/ws/terminal")
                .addInterceptors(httpSessionInterceptor)
                .setAllowedOrigins("*");
    }
}