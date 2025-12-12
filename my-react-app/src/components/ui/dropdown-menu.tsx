import * as React from "react"
import * as ReactDOM from "react-dom"
import { cn } from "@/lib/utils"

interface DropdownMenuProps {
  children: React.ReactNode
  trigger: React.ReactNode
  align?: "left" | "right"
  className?: string
  usePortal?: boolean
}

interface DropdownMenuItemProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  disabled?: boolean
}

export function DropdownMenu({
  children,
  trigger,
  align = "right",
  className,
  usePortal = false,
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const triggerWrapperRef = React.useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 })

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerWrapperRef.current &&
        !triggerWrapperRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  React.useLayoutEffect(() => {
    if (open && usePortal && triggerWrapperRef.current && menuRef.current) {
      const triggerRect = triggerWrapperRef.current.getBoundingClientRect()
      const menuWidth = menuRef.current.offsetWidth || 180
      let left = triggerRect.left
      if (align === "right") {
        left = triggerRect.right - menuWidth
      }
      setMenuPosition({
        top: triggerRect.bottom + window.scrollY + 4,
        left: Math.max(8, left + window.scrollX),
      })
    }
  }, [open, align, usePortal])

  const menuContent = (
    <div
      ref={menuRef}
      className={cn(
        "z-50 mt-1 min-w-[180px] rounded-md border bg-background p-1 text-foreground shadow-lg",
        usePortal ? "fixed" : "absolute",
        className
      )}
      style={
        usePortal
          ? {
              top: menuPosition.top,
              left: menuPosition.left,
            }
          : undefined
      }
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement<DropdownMenuItemProps>(child)) {
          return React.cloneElement(child, {
            onClick: () => {
              child.props.onClick?.()
              setOpen(false)
            },
          })
        }
        return child
      })}
    </div>
  )

  return (
    <div className={cn("relative inline-block", className)} ref={triggerWrapperRef}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open &&
        (usePortal
          ? ReactDOM.createPortal(menuContent, document.body)
          : (
            <div className={cn(align === "right" ? "right-0" : "left-0", "absolute")}>{menuContent}</div>
          ))}
    </div>
  )
}

export function DropdownMenuItem({
  children,
  onClick,
  className,
  disabled,
}: DropdownMenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  )
}

