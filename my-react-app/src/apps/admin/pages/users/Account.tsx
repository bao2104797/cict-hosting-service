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
import { Loader2, RefreshCw, Trash2, MoreVertical, UserX, Search, Plus, Eye, EyeOff, AlertTriangle, Edit } from "lucide-react";
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<AdminAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [accountToUpdate, setAccountToUpdate] = useState<AdminAccount | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [accountToResetPassword, setAccountToResetPassword] = useState<AdminAccount | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [formData, setFormData] = useState({
    fullname: "",
    username: "",
    password: "",
    confirmPassword: "",
    tier: "STANDARD" as "STANDARD" | "PREMIUM",
    role: "USER" as "ADMIN" | "USER",
  });
  const [updateFormData, setUpdateFormData] = useState({
    fullname: "",
    tier: "STANDARD" as "STANDARD" | "PREMIUM",
    role: "USER" as "ADMIN" | "USER",
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

  const handleResetPassword = (account: AdminAccount) => {
    setAccountToResetPassword(account);
    setResetPasswordData({
      password: "",
      confirmPassword: "",
    });
    setIsResetPasswordDialogOpen(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!accountToResetPassword) return;

    // Validate
    if (!resetPasswordData.password) {
      toast.error("Vui lòng nhập mật khẩu mới");
      return;
    }
    if (resetPasswordData.password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      setIsResettingPassword(true);
      await adminAPI.resetAdminAccountPassword(
        accountToResetPassword.id,
        resetPasswordData.password,
        resetPasswordData.confirmPassword
      );
      toast.success(`Đã đặt lại mật khẩu cho ${accountToResetPassword.username}`);
      setIsResetPasswordDialogOpen(false);
      setAccountToResetPassword(null);
      setResetPasswordData({
        password: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      const errorMessage = error?.response?.data || error?.message || "Không thể đặt lại mật khẩu";
      toast.error(errorMessage);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleUpdateAccount = (account: AdminAccount) => {
    setAccountToUpdate(account);
    // Chỉ chấp nhận ADMIN hoặc USER, nếu là DEVOPS thì mặc định là USER
    const role = account.role === "ADMIN" || account.role === "USER" ? account.role : "USER";
    setUpdateFormData({
      fullname: account.name,
      tier: account.tier.toUpperCase() as "STANDARD" | "PREMIUM",
      role: role as "ADMIN" | "USER",
    });
    setIsUpdateDialogOpen(true);
  };

  const handleConfirmUpdate = async () => {
    if (!accountToUpdate) return;

    // Validate
    if (!updateFormData.fullname.trim()) {
      toast.error("Vui lòng nhập họ tên");
      return;
    }

    try {
      setIsUpdating(true);
      const updatedAccount = await adminAPI.updateAdminAccount(accountToUpdate.id, {
        fullname: updateFormData.fullname.trim(),
        tier: updateFormData.tier,
        role: updateFormData.role,
      });
      toast.success(`Đã cập nhật tài khoản ${updatedAccount.username}`);
      setIsUpdateDialogOpen(false);
      setAccountToUpdate(null);
      // Reload accounts (silent mode để không hiển thị toast "làm mới")
      await handleRefresh(true);
    } catch (error: any) {
      const errorMessage = error?.response?.data || error?.message || "Không thể cập nhật tài khoản";
      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = (account: AdminAccount) => {
    setAccountToDelete(account);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;

    try {
      setIsDeleting(true);
      // Lấy username của tài khoản đang đăng nhập từ localStorage
      const currentUsername = localStorage.getItem("username");
      if (!currentUsername) {
        toast.error("Không tìm thấy thông tin tài khoản đang đăng nhập");
        return;
      }

      await adminAPI.deleteAdminAccount(accountToDelete.id, currentUsername);
      toast.success(`Đã xóa tài khoản ${accountToDelete.username}`);
      setIsDeleteDialogOpen(false);
      setAccountToDelete(null);
      // Reload accounts (silent mode để không hiển thị toast "làm mới")
      await handleRefresh(true);
    } catch (error: any) {
      const errorMessage = error?.response?.data || error?.message || "Không thể xóa tài khoản";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async (silent: boolean = false) => {
    try {
      setIsRefreshing(true);
      const data = await adminAPI.getAdminAccounts();
      setAccounts(data);
      if (!silent) {
        toast.success("Đã làm mới danh sách tài khoản");
      }
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
        role: formData.role,
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
        role: "USER",
      });
      // Reload accounts (silent mode để không hiển thị toast "làm mới")
      await handleRefresh(true);
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
        onClick={() => handleRefresh()}
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

      <Card className="mb-[50px]">
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
                        <span>Tier: <span className="text-foreground font-medium capitalize">{account.tier}</span></span>
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
                      <DropdownMenuItem onClick={() => handleUpdateAccount(account)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Cập nhật thông tin
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResetPassword(account)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset mật khẩu
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
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as "ADMIN" | "USER" })}
              >
                <SelectTrigger disabled={isCreating}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
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
                  role: "USER",
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        if (!isDeleting) {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setAccountToDelete(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Xác nhận xóa tài khoản
            </DialogTitle>
            <DialogDescription>
              Hành động này không thể hoàn tác. Tài khoản sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          {accountToDelete && (
            <div className="py-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-destructive/10 rounded-full">
                    <UserX className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold text-sm">Thông tin tài khoản sẽ bị xóa:</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Tên:</span>
                        <span className="font-medium">{accountToDelete.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Username:</span>
                        <span className="font-mono font-medium">{accountToDelete.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Role:</span>
                        <Badge variant="outline">{accountToDelete.role}</Badge>
                      </div>
                      {accountToDelete.projectCount > 0 && (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">
                            Tài khoản này có {accountToDelete.projectCount} dự án và {accountToDelete.services} dịch vụ
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setAccountToDelete(null);
              }}
              disabled={isDeleting}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xóa tài khoản
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Account Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={(open) => {
        if (!isUpdating) {
          setIsUpdateDialogOpen(open);
          if (!open) {
            setAccountToUpdate(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cập nhật tài khoản</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin tài khoản {accountToUpdate?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="update-fullname">
                Họ tên <span className="text-destructive">*</span>
              </Label>
              <Input
                id="update-fullname"
                placeholder="Nhập họ tên"
                value={updateFormData.fullname}
                onChange={(e) => setUpdateFormData({ ...updateFormData, fullname: e.target.value })}
                disabled={isUpdating}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="update-tier">
                Cấp bậc <span className="text-destructive">*</span>
              </Label>
              <Select
                value={updateFormData.tier}
                onValueChange={(value) => setUpdateFormData({ ...updateFormData, tier: value as "STANDARD" | "PREMIUM" })}
              >
                <SelectTrigger disabled={isUpdating}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="update-role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={updateFormData.role}
                onValueChange={(value) => setUpdateFormData({ ...updateFormData, role: value as "ADMIN" | "USER" })}
              >
                <SelectTrigger disabled={isUpdating}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUpdateDialogOpen(false);
                setAccountToUpdate(null);
              }}
              disabled={isUpdating}
            >
              Hủy
            </Button>
            <Button onClick={handleConfirmUpdate} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang cập nhật...
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Cập nhật
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={(open) => {
        if (!isResettingPassword) {
          setIsResetPasswordDialogOpen(open);
          if (!open) {
            setAccountToResetPassword(null);
            setResetPasswordData({
              password: "",
              confirmPassword: "",
            });
          }
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
            <DialogDescription>
              Đặt lại mật khẩu cho tài khoản {accountToResetPassword?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reset-password">
                Mật khẩu mới <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showResetPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  value={resetPasswordData.password}
                  onChange={(e) => setResetPasswordData({ ...resetPasswordData, password: e.target.value })}
                  disabled={isResettingPassword}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  disabled={isResettingPassword}
                >
                  {showResetPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reset-confirm-password">
                Xác nhận mật khẩu <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="reset-confirm-password"
                  type={showResetConfirmPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu mới"
                  value={resetPasswordData.confirmPassword}
                  onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                  disabled={isResettingPassword}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                  disabled={isResettingPassword}
                >
                  {showResetConfirmPassword ? (
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
                setIsResetPasswordDialogOpen(false);
                setAccountToResetPassword(null);
                setResetPasswordData({
                  password: "",
                  confirmPassword: "",
                });
              }}
              disabled={isResettingPassword}
            >
              Hủy
            </Button>
            <Button onClick={handleConfirmResetPassword} disabled={isResettingPassword}>
              {isResettingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang đặt lại...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Đặt lại mật khẩu
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

