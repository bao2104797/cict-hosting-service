import { Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface HintBoxProps {
  title: string
  children: React.ReactNode
  className?: string
}

/**
 * Component hiển thị hộp hướng dẫn ở mỗi step
 */
export function HintBox({ title, children, className }: HintBoxProps) {
  return (
    <Alert variant="info" className={className}>
      <Info className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">{children}</AlertDescription>
    </Alert>
  )
}

