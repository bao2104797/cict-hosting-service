import React, { ReactNode, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => ReactNode;
  align?: "left" | "center" | "right";
}

interface ResourceTableProps<T> {
  title: string;
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  extraActions?: ReactNode;
  customActions?: (item: T) => ReactNode;
  pagination?: {
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  hideSearch?: boolean;
  toolbarContent?: ReactNode;
}

/**
 * Component Dropdown Menu với Portal để tránh bị giới hạn bởi overflow
 */
function TableDropdownMenu<T extends { id: string }>({
  item,
  onView,
  onEdit,
  onDelete,
  customActions,
}: {
  item: T;
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  customActions?: (item: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (open && triggerRef.current && menuRef.current) {
      const updatePosition = () => {
        if (!triggerRef.current || !menuRef.current) return;
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const menu = menuRef.current;
        const menuHeight = menu.offsetHeight;
        const menuWidth = menu.offsetWidth;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Kiểm tra không gian phía dưới
        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;
        
        // Kiểm tra không gian bên phải và trái
        const spaceRight = viewportWidth - triggerRect.right;
        const spaceLeft = triggerRect.left;
        
        // Đặt vị trí theo chiều dọc: ưu tiên phía dưới, nếu không đủ thì phía trên
        if (spaceBelow >= menuHeight + 4) {
          // Đủ không gian phía dưới
          menu.style.top = `${triggerRect.bottom + 4}px`;
        } else if (spaceAbove >= menuHeight + 4) {
          // Đủ không gian phía trên
          menu.style.top = `${triggerRect.top - menuHeight - 4}px`;
        } else {
          // Không đủ không gian cả hai phía, chọn phía có nhiều không gian hơn
          if (spaceBelow > spaceAbove) {
        menu.style.top = `${triggerRect.bottom + 4}px`;
          } else {
            menu.style.top = `${triggerRect.top - menuHeight - 4}px`;
          }
        }
        
        // Đặt vị trí theo chiều ngang: ưu tiên align với cạnh phải của trigger
        if (spaceRight >= menuWidth) {
          // Đủ không gian bên phải, align với cạnh phải của trigger
          menu.style.left = `${triggerRect.right - menuWidth}px`;
        } else if (spaceLeft >= menuWidth) {
          // Đủ không gian bên trái, align với cạnh trái của trigger
          menu.style.left = `${triggerRect.left}px`;
        } else {
          // Không đủ không gian, đặt ở vị trí tốt nhất
          if (spaceRight > spaceLeft) {
            menu.style.left = `${triggerRect.right - menuWidth}px`;
          } else {
            menu.style.left = `${triggerRect.left}px`;
          }
        }
      };
      updatePosition();
      // Update lại position khi scroll hoặc resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(!open)}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[180px] rounded-md border bg-background p-1 text-foreground shadow-lg"
            style={{ pointerEvents: "auto" }}
          >
            {onView && (
              <DropdownMenuItem
                onClick={() => {
                  onView(item);
                  setOpen(false);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Xem
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem
                onClick={() => {
                  onEdit(item);
                  setOpen(false);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Sửa
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => {
                  onDelete(item);
                  setOpen(false);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Xóa
              </DropdownMenuItem>
            )}
            {customActions && customActions(item)}
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * Component Table chung cho các resource
 */
export function ResourceTable<T extends { id: string }>({
  title,
  columns,
  data,
  loading = false,
  onAdd,
  onEdit,
  onDelete,
  onView,
  searchPlaceholder = "Tìm kiếm...",
  emptyMessage = "Không có dữ liệu",
  extraActions,
  customActions,
  pagination,
  hideSearch = false,
  toolbarContent,
}: ResourceTableProps<T>) {
  const [search, setSearch] = useState("");

  const filteredData = data.filter((item) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return columns.some((col) => {
      const value = col.key === "actions" ? "" : item[col.key as keyof T];
      return String(value).toLowerCase().includes(searchLower);
    });
  });

  useEffect(() => {
    if (!pagination) return;
    const totalPages = Math.max(1, Math.ceil(filteredData.length / pagination.pageSize));
    if (pagination.page > totalPages) {
      pagination.onPageChange(totalPages);
    }
  }, [filteredData.length, pagination?.page, pagination?.pageSize]);

  const totalPages = pagination ? Math.max(1, Math.ceil(filteredData.length / pagination.pageSize)) : 1;
  const currentPage = pagination ? Math.min(Math.max(pagination.page, 1), totalPages) : 1;
  const startIndex = pagination ? (currentPage - 1) * pagination.pageSize : 0;
  const displayData = pagination
    ? filteredData.slice(startIndex, startIndex + pagination.pageSize)
    : filteredData;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <div className="border rounded-lg p-8 text-center">
          <div className="animate-pulse">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header với search và add button */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!hideSearch && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                pagination?.onPageChange(1);
              }}
              className="pl-8 w-64"
            />
          </div>
          )}
          {extraActions}
          {onAdd && (
            <Button onClick={onAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Thêm mới
            </Button>
          )}
        </div>
      </div>
      {toolbarContent && <div>{toolbarContent}</div>}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                       {columns.map((col) => {
                         const alignClass =
                           col.align === "center"
                             ? "text-center"
                             : col.align === "right"
                               ? "text-right"
                               : "text-left";
                         return (
                           <th
                             key={String(col.key)}
                             className={cn(
                               "px-4 py-3 text-sm font-medium text-foreground",
                               alignClass
                             )}
                           >
                             {col.label}
                           </th>
                         );
                       })}
                {(onEdit || onDelete || onView || customActions) && (
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground">
                    Hành động
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (onEdit || onDelete || onView || customActions ? 1 : 0)}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                displayData.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t hover:bg-muted/50 transition-colors"
                  >
                           {columns.map((col) => {
                             const alignClass =
                               col.align === "center"
                                 ? "text-center"
                                 : col.align === "right"
                                   ? "text-right"
                                   : "text-left";
                             return (
                               <td
                                 key={String(col.key)}
                                 className={cn("px-4 py-3 text-sm", alignClass)}
                               >
                                 {col.render ? col.render(item) : String(item[col.key as keyof T] ?? "")}
                               </td>
                             );
                           })}
                    {(onEdit || onDelete || onView || customActions) && (
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <TableDropdownMenu
                            item={item}
                            onView={onView}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            customActions={customActions}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && filteredData.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Hiển thị {startIndex + 1}-
            {Math.min(startIndex + pagination.pageSize, filteredData.length)} trong{" "}
            {filteredData.length} mục
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              Trước
            </Button>
            <span>
              Trang {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              Sau
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

