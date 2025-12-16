/**
 * API service cho authentication
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"

export interface CreateUserRequest {
  fullname: string
  username: string
  password: string
  confirmPassword: string
  tier?: string // STANDARD, PREMIUM
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  fullname: string
  username: string
  role: string
  tier: string
}

export interface CreateUserResponse {
  // Có thể thêm các trường khác nếu cần
  message?: string
  fullname?: string
  username?: string
}

/**
 * Đăng ký người dùng mới
 */
export async function register(request: CreateUserRequest): Promise<CreateUserResponse> {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Có lỗi xảy ra khi đăng ký" }))
    throw new Error(error.message || "Có lỗi xảy ra khi đăng ký")
  }

  return response.json()
}

/**
 * Đăng nhập
 */
export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Sai tên đăng nhập hoặc mật khẩu" }))
    throw new Error(error.message || "Sai tên đăng nhập hoặc mật khẩu")
  }

  return response.json()
}

