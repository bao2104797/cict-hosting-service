package my_spring_app.my_spring_app.service.impl;

import com.jcraft.jsch.Channel;
import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import my_spring_app.my_spring_app.dto.reponse.CheckConnectionResponse;
import my_spring_app.my_spring_app.dto.reponse.ExecuteCommandResponse;
import my_spring_app.my_spring_app.dto.request.CheckConnectionRequest;
import my_spring_app.my_spring_app.dto.request.ExecuteCommandRequest;
import my_spring_app.my_spring_app.service.SSHService;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

/**
 * Service implementation cho SSH
 * Xử lý các nghiệp vụ liên quan đến kết nối SSH và thực thi lệnh trên server từ xa
 */
@Service
public class SSHServiceImpl implements SSHService {

    // Thời gian chờ kết nối SSH (5 giây)
    private static final int CONNECTION_TIMEOUT = 5000;

    /**
     * Kiểm tra kết nối SSH đến server
     * @param request Thông tin request để kiểm tra kết nối (host, port, username, password)
     * @return Response chứa thông tin kết quả kết nối (connected, message)
     */
    @Override
    public CheckConnectionResponse checkConnection(CheckConnectionRequest request) {
        System.out.println("[checkConnection] Bắt đầu kiểm tra kết nối SSH đến server: " + request.getHost() + ":" + request.getPort());
        
        CheckConnectionResponse response = new CheckConnectionResponse();
        response.setHost(request.getHost());
        response.setPort(request.getPort());

        Session session = null;
        try {
            // Tạo JSch instance để quản lý SSH connections
            System.out.println("[checkConnection] Tạo JSch instance");
            JSch jsch = new JSch();
            
            // Tạo SSH session với thông tin kết nối
            System.out.println("[checkConnection] Tạo SSH session với username: " + request.getUsername());
            session = jsch.getSession(request.getUsername(), request.getHost(), request.getPort());
            session.setPassword(request.getPassword());

            // Tắt kiểm tra strict host key (để tránh lỗi khi kết nối lần đầu)
            System.out.println("[checkConnection] Thiết lập cấu hình SSH (tắt StrictHostKeyChecking)");
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);

            // Thiết lập thời gian chờ kết nối
            System.out.println("[checkConnection] Thiết lập timeout: " + CONNECTION_TIMEOUT + "ms");
            session.setTimeout(CONNECTION_TIMEOUT);

            // Kết nối đến server
            System.out.println("[checkConnection] Đang kết nối đến server...");
            session.connect();
            System.out.println("[checkConnection] Kết nối thành công đến server: " + request.getHost() + ":" + request.getPort());

            response.setConnected(true);
            response.setMessage("Kết nối thành công đến server");
            
            return response;
        } catch (Exception e) {
            System.err.println("[checkConnection] Lỗi khi kết nối: " + e.getMessage());
            e.printStackTrace();
            response.setConnected(false);
            response.setMessage("Kết nối thất bại: " + e.getMessage());
            return response;
        } finally {
            // Đảm bảo đóng session sau khi kiểm tra xong
            if (session != null && session.isConnected()) {
                System.out.println("[checkConnection] Đóng SSH session");
                session.disconnect();
            }
        }
    }

    /**
     * Thực thi lệnh trên server từ xa qua SSH
     * @param request Thông tin request để thực thi lệnh (host, port, username, password, command)
     * @return Response chứa kết quả thực thi lệnh (success, output, error, exitStatus)
     */
    @Override
    public ExecuteCommandResponse executeCommand(ExecuteCommandRequest request) {
        System.out.println("[executeCommand] Bắt đầu thực thi lệnh trên server: " + request.getHost() + ":" + request.getPort());
        System.out.println("[executeCommand] Lệnh cần thực thi: " + request.getCommand());
        
        ExecuteCommandResponse response = new ExecuteCommandResponse();
        response.setCommand(request.getCommand());

        Session session = null;
        Channel channel = null;
        try {
            // Tạo JSch instance để quản lý SSH connections
            System.out.println("[executeCommand] Tạo JSch instance");
            JSch jsch = new JSch();
            
            // Tạo SSH session với thông tin kết nối
            System.out.println("[executeCommand] Tạo SSH session với username: " + request.getUsername());
            session = jsch.getSession(request.getUsername(), request.getHost(), request.getPort());
            session.setPassword(request.getPassword());

            // Tắt kiểm tra strict host key (để tránh lỗi khi kết nối lần đầu)
            System.out.println("[executeCommand] Thiết lập cấu hình SSH (tắt StrictHostKeyChecking)");
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);

            // Thiết lập thời gian chờ kết nối
            System.out.println("[executeCommand] Thiết lập timeout: " + CONNECTION_TIMEOUT + "ms");
            session.setTimeout(CONNECTION_TIMEOUT);

            // Kết nối đến server
            System.out.println("[executeCommand] Đang kết nối đến server...");
            session.connect();
            System.out.println("[executeCommand] Kết nối thành công đến server");

            // Mở kênh exec để thực thi lệnh
            System.out.println("[executeCommand] Mở kênh exec");
            channel = session.openChannel("exec");
            ChannelExec channelExec = (ChannelExec) channel;

            // Thiết lập câu lệnh cần thực thi
            System.out.println("[executeCommand] Thiết lập lệnh: " + request.getCommand());
            channelExec.setCommand(request.getCommand());

            // Chuyển hướng error stream sang output stream để dễ debug
            channelExec.setErrStream(System.err);

            // Lấy input stream để đọc output từ lệnh
            InputStream inputStream = channelExec.getInputStream();

            // Kết nối channel để bắt đầu thực thi lệnh
            System.out.println("[executeCommand] Kết nối channel và bắt đầu thực thi lệnh");
            channel.connect();

            // Đọc output từ lệnh
            System.out.println("[executeCommand] Đang đọc output từ lệnh...");
            StringBuilder output = new StringBuilder();
            byte[] buffer = new byte[1024]; // Buffer để đọc dữ liệu

            // Vòng lặp để đọc output từ lệnh cho đến khi lệnh thực thi xong
            while (true) {
                // Đọc tất cả dữ liệu có sẵn trong input stream
                while (inputStream.available() > 0) {
                    int bytesRead = inputStream.read(buffer, 0, 1024);
                    if (bytesRead < 0) {
                        break;
                    }
                    output.append(new String(buffer, 0, bytesRead, StandardCharsets.UTF_8));
                }

                // Kiểm tra xem channel đã đóng chưa (lệnh đã thực thi xong)
                if (channel.isClosed()) {
                    // Nếu vẫn còn dữ liệu trong stream, tiếp tục đọc
                    if (inputStream.available() > 0) {
                        continue;
                    }
                    // Lấy exit status của lệnh (0 = thành công, != 0 = lỗi)
                    int exitStatus = channel.getExitStatus();
                    response.setExitStatus(exitStatus);
                    System.out.println("[executeCommand] Lệnh đã thực thi xong với exit status: " + exitStatus);
                    break;
                }

                // Nghỉ 100ms trước khi kiểm tra lại để tránh chiếm CPU
                try {
                    Thread.sleep(100);
                } catch (Exception e) {
                    // Bỏ qua lỗi sleep
                }
            }

            // Kiểm tra exit status để xác định lệnh thực thi thành công hay thất bại
            int exitStatus = channel.getExitStatus();
            if (exitStatus == 0) {
                System.out.println("[executeCommand] Lệnh thực thi thành công");
                response.setSuccess(true);
                response.setOutput(output.toString().trim());
                response.setError(null);
            } else {
                System.err.println("[executeCommand] Lệnh thực thi thất bại với exit status: " + exitStatus);
                System.err.println("[executeCommand] Output: " + output.toString().trim());
                response.setSuccess(false);
                response.setOutput(output.toString().trim());
                response.setError("Command exited with status: " + exitStatus);
            }

            return response;
        } catch (Exception e) {
            System.err.println("[executeCommand] Lỗi khi thực thi lệnh: " + e.getMessage());
            e.printStackTrace();
            response.setSuccess(false);
            response.setOutput("");
            response.setError("Lỗi khi thực thi lệnh: " + e.getMessage());
            response.setExitStatus(-1);
            return response;
        } finally {
            // Đảm bảo đóng channel và session sau khi thực thi xong để giải phóng tài nguyên
            if (channel != null && channel.isConnected()) {
                System.out.println("[executeCommand] Đóng channel");
                channel.disconnect();
            }
            if (session != null && session.isConnected()) {
                System.out.println("[executeCommand] Đóng SSH session");
                session.disconnect();
            }
            System.out.println("[executeCommand] Hoàn tất thực thi lệnh");
        }
    }
}

