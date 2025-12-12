import { useEffect, useMemo, useState } from "react";
import { adminAPI } from "@/lib/admin-api";
import type { AdminAccount } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, ShieldCheck, Trash2, MoreVertical, UserX, Search, Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const statusVariant: Record<AdminAccount["status"], "success" | "warning" | "secondary"> = {
  active: "success",
  inactive: "secondary",
  pending: "warning",
};

export function Account() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullname: "",
    username: "",
    password: "",
    confirmPassword: "",
    tier: "STANDARD" as "STANDARD" | "PREMIUM",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await adminAPI.getAdminAccounts();
        setAccounts(data);
        setFilteredAccounts(data);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filter logic
  useEffect(() => {
    let filtered = accounts;

    // Search filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (acc) =>
          acc.name.toLowerCase().includes(query) ||
          acc.username.toLowerCase().includes(query) ||
          (acc.email && acc.email.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((acc) => acc.status === statusFilter);
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter((acc) => acc.role === roleFilter);
    }

    setFilteredAccounts(filtered);
  }, [searchTerm, statusFilter, roleFilter, accounts]);

  const handleResetPassword = async (account: AdminAccount) => {
    try {
      await adminAPI.resetAdminAccountPassword(account.id);
      toast.success(`Đã gửi email đặt lại mật khẩu cho ${account.name}`);
    } catch (error) {
      toast.error("Không thể reset mật khẩu");
    }
  };

  const handleToggleStatus = async (account: AdminAccount) => {
    try {
      const newStatus = account.status === "active" ? "inactive" : "active";
      await adminAPI.updateAdminAccountStatus(account.id, newStatus);
      toast.success(
        `Đã ${newStatus === "active" ? "kích hoạt" : "vô hiệu hóa"} tài khoản ${account.username}`
      );
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === account.id
            ? { ...acc, status: newStatus, lastLogin: newStatus === "active" ? new Date().toISOString() : acc.lastLogin }
            : acc
        )
      );
    } catch (error) {
      toast.error("Không thể cập nhật trạng thái");
    }
  };

  const handleDeleteAccount = (account: AdminAccount) => {
    toast.info(`Đã gửi yêu cầu xóa tài khoản ${account.username}`);
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const data = await adminAPI.getAdminAccounts();
      setAccounts(data);
      toast.success("Đã làm mới danh sách tài khoản");
    } catch (error) {
      toast.error("Không thể làm mới danh sách tài khoản");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateAccount = async () => {
    // Validate
    if (!formData.fullname.trim()) {
      toast.error("Vui lòng nhập họ tên");
      return;
    }
    if (!formData.username.trim()) {
      toast.error("Vui lòng nhập username");
      return;
    }
    if (!formData.password) {
      toast.error("Vui lòng nhập mật khẩu");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      setIsCreating(true);
      await adminAPI.createAdminAccount({
        fullname: formData.fullname.trim(),
        username: formData.username.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        tier: formData.tier,
      });
      toast.success("Tạo tài khoản thành công");
      setIsCreateDialogOpen(false);
      // Reset form
      setFormData({
        fullname: "",
        username: "",
        password: "",
        confirmPassword: "",
        tier: "STANDARD",
      });
      // Reload accounts
      await handleRefresh();
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.message || "Không thể tạo tài khoản";
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  // Helper functions for filter labels
  const getStatusLabel = (value: string) => {
    switch (value) {
      case "all":
        return "Tất cả trạng thái";
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "pending":
        return "Pending";
      default:
        return value;
    }
  };

  const getRoleLabel = (value: string) => {
    switch (value) {
      case "all":
        return "Tất cả role";
      case "ADMIN":
        return "Admin";
      case "DEVOPS":
        return "DevOps";
      case "USER":
        return "User";
      default:
        return value;
    }
  };

  // Get unique roles and statuses from accounts
  const roleOptions = Array.from(new Set(accounts.map((acc) => acc.role).filter(Boolean))).sort();
  const statusOptions = Array.from(new Set(accounts.map((acc) => acc.status).filter(Boolean))).sort();

  const totalActive = useMemo(() => accounts.filter((acc) => acc.status === "active").length, [accounts]);
  const totalInactive = useMemo(() => accounts.filter((acc) => acc.status === "inactive").length, [accounts]);

  const totalCount = accounts.length;
  const filteredCount = filteredAccounts.length;

  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm tài khoản..."
          className="pl-9"
        />
      </div>
      <div className="w-full sm:w-48">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue>{getStatusLabel(statusFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {getStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full sm:w-48">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger>
            <SelectValue>{getRoleLabel(roleFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả role</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role}>
                {getRoleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={handleRefresh}
        disabled={isRefreshing || loading}
      >
        {(isRefreshing || loading) ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Đang làm mới...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Làm mới
          </>
        )}
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Đang tải danh sách tài khoản...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý tài khoản</h1>
          <p className="text-muted-foreground mt-1">
            Duyệt danh sách tài khoản, kiểm soát trạng thái hoạt động và đặt lại mật khẩu.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Thêm mới
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng tài khoản</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{accounts.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Đang hoạt động</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">{totalActive}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Đang vô hiệu hóa</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-500">{totalInactive}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {filteredCount === totalCount
              ? `Danh sách tài khoản (${totalCount})`
              : `Danh sách tài khoản (${filteredCount}/${totalCount})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          {filterToolbar}
          <div className="mt-4 space-y-3">
            {filteredAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Không tìm thấy tài khoản phù hợp.
              </p>
            ) : (
              filteredAccounts.map((account) => (
                <Card key={account.id} className="border-muted bg-card/50 overflow-hidden">
                  <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between min-w-0">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-semibold text-foreground truncate">{account.name}</p>
                        <Badge variant={statusVariant[account.status]} className="shrink-0">{account.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        Username: <span className="font-mono">{account.username}</span>
                        {account.email ? ` • ${account.email}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>Role: <span className="text-foreground font-medium">{account.role}</span></span>
                        <span>Dịch vụ: <span className="text-foreground font-medium">{account.services ?? 0}</span></span>
                        <span>Dự án: <span className="text-foreground font-medium">{account.projectCount}</span></span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tạo ngày {account.createdAt || "—"}
                      </p>
                    </div>
                    <div className="flex-shrink-0 md:ml-4">
                    <DropdownMenu
                      trigger={
                          <Button variant="outline" size="sm" className="w-full md:w-auto">
                          <MoreVertical className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Thao tác</span>
                        </Button>
                      }
                      align="right"
                        usePortal
                    >
                      <DropdownMenuItem onClick={() => handleResetPassword(account)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset mật khẩu
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(account)}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {account.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteAccount(account)}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Xóa tài khoản
                      </DropdownMenuItem>
                    </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Account Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Thêm tài khoản mới</DialogTitle>
            <DialogDescription>
              Tạo tài khoản người dùng mới. Điền đầy đủ thông tin bên dưới.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fullname">
                Họ tên <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullname"
                placeholder="Nhập họ tên"
                value={formData.fullname}
                onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                disabled={isCreating}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                placeholder="Nhập username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                disabled={isCreating}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tier">
                Cấp bậc <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.tier}
                onValueChange={(value) => setFormData({ ...formData, tier: value as "STANDARD" | "PREMIUM" })}
              >
                <SelectTrigger disabled={isCreating}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">
                Mật khẩu <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={isCreating}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isCreating}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">
                Xác nhận mật khẩu <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={isCreating}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isCreating}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setFormData({
                  fullname: "",
                  username: "",
                  password: "",
                  confirmPassword: "",
                  tier: "STANDARD",
                });
              }}
              disabled={isCreating}
            >
              Hủy
            </Button>
            <Button onClick={handleCreateAccount} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Tạo tài khoản
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

