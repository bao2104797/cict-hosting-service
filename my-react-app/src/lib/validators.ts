/**
 * Validators cho các trường form
 */

/**
 * Validate DNS theo RFC 1035
 * Cho phép dấu chấm (.) để phân tách các label
 */
export const validateDNS = (dns: string): { valid: boolean; message?: string } => {
  if (!dns || dns.trim() === "") {
    return { valid: true } // DNS là optional
  }

  // Regex cho domain name: cho phép chữ thường, số, dấu gạch nối và dấu chấm
  // Mỗi label (phần giữa các dấu chấm) phải:
  // - Bắt đầu và kết thúc bằng chữ/số (không phải dấu gạch nối)
  // - Có thể chứa chữ thường, số, dấu gạch nối ở giữa
  // - Có độ dài từ 1 đến 63 ký tự
  // - Toàn bộ domain không được bắt đầu hoặc kết thúc bằng dấu chấm
  // - Không được có hai dấu chấm liên tiếp
  // - Tổng độ dài tối đa 253 ký tự (254 ký tự nếu tính cả dấu chấm cuối)
  const dnsRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

  if (dns.length < 1 || dns.length > 253) {
    return {
      valid: false,
      message: "Tên DNS phải có độ dài từ 1 đến 253 ký tự.",
    }
  }

  // Kiểm tra không được bắt đầu hoặc kết thúc bằng dấu chấm
  if (dns.startsWith(".") || dns.endsWith(".")) {
    return {
      valid: false,
      message: "Tên DNS không được bắt đầu hoặc kết thúc bằng dấu chấm.",
    }
  }

  // Kiểm tra không được có hai dấu chấm liên tiếp
  if (dns.includes("..")) {
    return {
      valid: false,
      message: "Tên DNS không được chứa hai dấu chấm liên tiếp.",
    }
  }

  // Kiểm tra mỗi label (phần giữa các dấu chấm) không quá 63 ký tự
  const labels = dns.split(".")
  for (const label of labels) {
    if (label.length < 1 || label.length > 63) {
      return {
        valid: false,
        message: `Mỗi phần của DNS (giữa các dấu chấm) phải có độ dài từ 1 đến 63 ký tự. Phần "${label}" không hợp lệ.`,
      }
    }
    // Kiểm tra label không bắt đầu hoặc kết thúc bằng dấu gạch nối
    if (label.startsWith("-") || label.endsWith("-")) {
      return {
        valid: false,
        message: `Mỗi phần của DNS không được bắt đầu hoặc kết thúc bằng dấu gạch nối. Phần "${label}" không hợp lệ.`,
      }
    }
  }

  if (!dnsRegex.test(dns)) {
    return {
      valid: false,
      message:
        "Tên DNS chỉ bao gồm chữ thường (a-z), số (0-9), dấu gạch nối (-) và dấu chấm (.), không được bắt đầu hoặc kết thúc bằng dấu gạch nối hoặc dấu chấm.",
    }
  }

  return { valid: true }
}

/**
 * Validate Docker image format
 */
export const validateDockerImage = (
  image: string
): { valid: boolean; message?: string } => {
  if (!image || image.trim() === "") {
    return { valid: false, message: "Docker image không được để trống." }
  }

  // Regex: [registry/]repo/name[:tag]
  const dockerImageRegex =
    /^([a-z0-9]+([._-][a-z0-9]+)*\/)?([a-z0-9]+([._-][a-z0-9]+)*\/)*[a-z0-9]+([._-][a-z0-9]+)*(:[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/

  if (!dockerImageRegex.test(image)) {
    return {
      valid: false,
      message:
        "Định dạng Docker image không hợp lệ. Ví dụ: docker.io/user/app:1.0.0 hoặc user/app:latest",
    }
  }

  return { valid: true }
}

/**
 * Validate file ZIP
 */
export const validateZipFile = (
  file: File
): { valid: boolean; message?: string } => {
  if (!file) {
    return { valid: false, message: "Vui lòng chọn file." }
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    return { valid: false, message: "File phải có đuôi .zip" }
  }

  const maxSize = 100 * 1024 * 1024 // 100 MB
  if (file.size > maxSize) {
    return {
      valid: false,
      message: "File quá lớn. Kích thước tối đa là 100 MB.",
    }
  }

  return { valid: true }
}

/**
 * Validate IP address
 */
export const validateIP = (ip: string): { valid: boolean; message?: string } => {
  if (!ip || ip.trim() === "") {
    return { valid: false, message: "IP không được để trống." }
  }

  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

  if (!ipRegex.test(ip)) {
    return { valid: false, message: "Địa chỉ IP không hợp lệ." }
  }

  return { valid: true }
}

/**
 * Validate port
 */
export const validatePort = (
  port: string
): { valid: boolean; message?: string } => {
  if (!port || port.trim() === "") {
    return { valid: false, message: "Port không được để trống." }
  }

  const portNum = parseInt(port, 10)
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, message: "Port phải là số từ 1 đến 65535." }
  }

  return { valid: true }
}

