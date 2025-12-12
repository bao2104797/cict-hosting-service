import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { FolderKanban, Server, Database, Globe, Rocket, Zap, Shield } from "lucide-react"

/**
 * Trang đăng nhập
 */
export function Login() {
  const { login, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Redirect nếu đã đăng nhập
  useEffect(() => {
    if (!authLoading) {
      const savedUsername = localStorage.getItem("username")
      const savedRole = localStorage.getItem("role")
      if (savedUsername) {
        // Chuyển hướng theo role
        if (savedRole === "ADMIN") {
          navigate("/admin/overview", { replace: true })
        } else {
          navigate("/projects", { replace: true })
        }
      }
    }
  }, [authLoading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim()) {
      toast.error("Vui lòng nhập tên đăng nhập")
      return
    }

    if (!password) {
      toast.error("Vui lòng nhập mật khẩu")
      return
    }

    setIsLoading(true)
    try {
      await login(username.trim(), password)
      toast.success("Đăng nhập thành công!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi đăng nhập")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Phần giới thiệu bên trái */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background flex-col justify-center px-12 py-16">
        <div className="max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <FolderKanban className="w-10 h-10 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">CICT-Hosting</h1>
          </div>

          {/* Tiêu đề */}
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Triển khai ứng dụng của bạn một cách dễ dàng
          </h2>

          {/* Mô tả */}
          <p className="text-lg text-muted-foreground mb-8">
            CICT-Hosting Services là nền tảng toàn diện giúp bạn triển khai và quản lý các ứng dụng fullstack 
            một cách nhanh chóng và hiệu quả. Từ database đến backend và frontend, mọi thứ được 
            quản lý tập trung tại một nơi.
          </p>

          {/* Các tính năng chính */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Quản lý Database</h3>
                <p className="text-sm text-muted-foreground">
                  Hỗ trợ MySQL và MongoDB. Hệ thống tự động tạo và quản lý database, 
                  hoặc kết nối với database có sẵn của bạn.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Triển khai Backend</h3>
                <p className="text-sm text-muted-foreground">
                  Hỗ trợ Spring Boot và Node.js. Upload mã nguồn ZIP hoặc sử dụng Docker image 
                  có sẵn để triển khai nhanh chóng.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Phát hành Frontend</h3>
                <p className="text-sm text-muted-foreground">
                  Hỗ trợ React, Vue và Angular. Triển khai frontend với cấu hình DNS tùy chỉnh 
                  và quản lý phiên bản một cách dễ dàng.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Tự động hóa hoàn toàn</h3>
                <p className="text-sm text-muted-foreground">
                  Từ build, deploy đến quản lý môi trường, mọi thứ được tự động hóa. 
                  Chỉ cần vài cú click là ứng dụng của bạn đã sẵn sàng.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form đăng nhập bên phải */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Gradient circles */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 -right-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                             linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}></div>
          
          {/* Dots pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}></div>
        </div>
        
        <div className="max-w-md w-full space-y-8 relative z-10">
          {/* Logo và title cho mobile */}
          <div className="text-center lg:hidden">
            <div className="flex justify-center mb-4">
              <FolderKanban className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">CICT-Hosting</h2>
            <p className="mt-2 text-muted-foreground">Đăng nhập vào tài khoản của bạn</p>
          </div>

          {/* Form đăng nhập */}
          <Card>
            <CardHeader>
              <CardTitle>Đăng nhập</CardTitle>
              <CardDescription>
                Nhập thông tin đăng nhập để tiếp tục
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="username">
                    Tên đăng nhập <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>

                <div>
                  <Label htmlFor="password">
                    Mật khẩu <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">Chưa có tài khoản? </span>
                <Link to="/register" className="text-primary hover:underline">
                  Đăng ký ngay
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

