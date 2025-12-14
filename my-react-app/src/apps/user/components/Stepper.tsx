import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepperProps {
  steps: string[]
  currentStep: number
  className?: string
}

/**
 * Component Stepper hiển thị tiến trình các bước trong wizard
 */
export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const isActive = index === currentStep
          const isCompleted = index < currentStep
          const isLast = index === steps.length - 1

          return (
            <div key={index} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1 relative">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all duration-300 relative z-10",
                    isCompleted
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-lg shadow-primary/20 scale-110"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <span className="text-base">{index + 1}</span>
                  )}
                </div>
                <div className="mt-3 text-center max-w-[120px]">
                  <p
                    className={cn(
                      "text-xs font-semibold transition-colors duration-300",
                      isActive
                        ? "text-primary"
                        : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step}
                  </p>
                </div>
              </div>

              {!isLast && (
                <div className="flex-1 h-1 mx-2 relative -mt-6">
                  <div className="absolute inset-0 bg-muted rounded-full" />
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full transition-all duration-500",
                      isCompleted ? "bg-primary w-full" : "bg-muted w-0"
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

