import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { register } from "@/lib/auth-api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { FolderKanban, Server, Database, Globe, Rocket, CheckCircle2 } from "lucide-react"

/**
 * Trang đăng ký
 */
export function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    fullname: "",
    username: "",
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  // Redirect nếu đã đăng nhập
  useEffect(() => {
    const savedUsername = localStorage.getItem("username")
    if (savedUsername) {
      navigate("/projects", { replace: true })
    }
  }, [navigate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.fullname.trim()) {
      toast.error("Vui lòng nhập họ và tên")
      return
    }

    if (!formData.username.trim()) {
      toast.error("Vui lòng nhập tên đăng nhập")
      return
    }

    if (!formData.password) {
      toast.error("Vui lòng nhập mật khẩu")
      return
    }

    if (formData.password.length < 1) {
      toast.error("Mật khẩu phải có ít nhất 1 ký tự")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp")
      return
    }

    setIsLoading(true)
    try {
      await register({
        fullname: formData.fullname.trim(),
        username: formData.username.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      })
      toast.success("Đăng ký thành công! Vui lòng đăng nhập")
      // Chuyển đến trang login sau khi đăng ký thành công
      navigate("/login")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra khi đăng ký")
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
            Bắt đầu hành trình triển khai của bạn ngay hôm nay
          </h2>

          {/* Mô tả */}
          <p className="text-lg text-muted-foreground mb-8">
            Tham gia cùng hàng ngàn nhà phát triển đã tin tưởng CICT-Hosting Services để quản lý 
            và triển khai ứng dụng của họ. Đơn giản, nhanh chóng và hiệu quả.
          </p>

          {/* Lợi ích */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-foreground">Triển khai fullstack trong vài phút</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-foreground">Không cần kiến thức DevOps phức tạp</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-foreground">Quản lý tập trung tất cả components</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-foreground">Hỗ trợ đầy đủ các công nghệ phổ biến</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-foreground">Giám sát và quản lý dễ dàng</span>
            </div>
          </div>

          {/* Các tính năng nổi bật */}
          <div className="grid grid-cols-2 gap-4 mt-12">
            <div className="p-4 rounded-lg bg-background/50 border">
              <Database className="w-8 h-8 text-primary mb-2" />
              <h4 className="font-semibold text-sm mb-1">Database</h4>
              <p className="text-xs text-muted-foreground">
                MySQL, MongoDB
              </p>
            </div>
            <div className="p-4 rounded-lg bg-background/50 border">
              <Server className="w-8 h-8 text-primary mb-2" />
              <h4 className="font-semibold text-sm mb-1">Backend</h4>
              <p className="text-xs text-muted-foreground">
                Spring Boot, Node.js
              </p>
            </div>
            <div className="p-4 rounded-lg bg-background/50 border">
              <Globe className="w-8 h-8 text-primary mb-2" />
              <h4 className="font-semibold text-sm mb-1">Frontend</h4>
              <p className="text-xs text-muted-foreground">
                React, Vue, Angular
              </p>
            </div>
            <div className="p-4 rounded-lg bg-background/50 border">
              <Rocket className="w-8 h-8 text-primary mb-2" />
              <h4 className="font-semibold text-sm mb-1">Deploy</h4>
              <p className="text-xs text-muted-foreground">
                Docker, Container
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form đăng ký bên phải */}
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
            <p className="mt-2 text-muted-foreground">Tạo tài khoản mới</p>
          </div>

          {/* Form đăng ký */}
          <Card>
            <CardHeader>
              <CardTitle>Đăng ký</CardTitle>
              <CardDescription>
                Điền thông tin để tạo tài khoản mới
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="fullname">
                    Họ và tên <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="fullname"
                    name="fullname"
                    type="text"
                    value={formData.fullname}
                    onChange={handleChange}
                    placeholder="Nhập họ và tên"
                    disabled={isLoading}
                    autoComplete="name"
                  />
                </div>

                <div>
                  <Label htmlFor="username">
                    Tên đăng nhập <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
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
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Nhập mật khẩu"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">
                    Xác nhận mật khẩu <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Nhập lại mật khẩu"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Đang đăng ký..." : "Đăng ký"}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">Đã có tài khoản? </span>
                <Link to="/login" className="text-primary hover:underline">
                  Đăng nhập ngay
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

