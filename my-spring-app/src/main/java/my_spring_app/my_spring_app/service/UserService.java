package my_spring_app.my_spring_app.service;

import my_spring_app.my_spring_app.dto.reponse.CreateUserResponse;
import my_spring_app.my_spring_app.dto.reponse.LoginResponse;
import my_spring_app.my_spring_app.dto.reponse.UserSummaryResponse;
import my_spring_app.my_spring_app.dto.request.CreateUserRequest;
import my_spring_app.my_spring_app.dto.request.LoginRequest;
import my_spring_app.my_spring_app.dto.request.ResetPasswordRequest;
import my_spring_app.my_spring_app.dto.request.UpdateUserRequest;

import java.util.List;

public interface UserService {

    CreateUserResponse createUser(CreateUserRequest request);

    LoginResponse login(LoginRequest request);

    List<UserSummaryResponse> getAllUsers();

    void deleteUser(Long userId, String currentUsername);

    UserSummaryResponse updateUser(Long userId, UpdateUserRequest request);

    void resetPassword(Long userId, ResetPasswordRequest request);
}

