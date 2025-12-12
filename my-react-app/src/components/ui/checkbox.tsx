import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          ref={ref}
          className="sr-only peer"
          {...props}
        />
        <div className={cn(
          "w-4 h-4 border-2 border-input rounded peer-checked:bg-primary peer-checked:border-primary transition-colors",
          "flex items-center justify-center",
          className
        )}>
          <Check className="w-3 h-3 text-primary-foreground hidden peer-checked:block" />
        </div>
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

