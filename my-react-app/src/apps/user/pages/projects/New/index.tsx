import { useNavigate } from "react-router-dom"
import { ArrowLeft, ArrowRight, Plus, Rocket } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Stepper } from "@/apps/user/components/Stepper"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StepProjectInfo } from "./StepProjectInfo"
import { StepDatabase } from "./StepDatabase"
import { StepBackend } from "./StepBackend"
import { StepFrontend } from "./StepFrontend"
import { StepSummary } from "./StepSummary"
import { useWizardStore } from "@/apps/user/stores/wizard-store"
import { toast } from "sonner"

const steps = ["Thông tin Project", "Database", "Backend", "Frontend", "Tổng quan"]

/**
 * Trang tạo Project mới - Wizard 5 bước
 */
export function ProjectNew() {
  const navigate = useNavigate()
  const { currentStep, setCurrentStep, resetWizard, projectId } = useWizardStore()

  // Hàm để reset wizard và navigate về trang Projects
  const handleGoBack = () => {
    // Xóa currentProjectId từ localStorage
    try {
      localStorage.removeItem("currentProjectId")
    } catch (error) {
      console.error("Lỗi xóa currentProjectId:", error)
    }
    
    // Reset wizard (xóa wizard-draft và reset state)
    resetWizard()
    
    // Navigate về trang Projects
    navigate("/projects")
  }

  const handleNext = () => {
    // Ở bước 1, chỉ cho phép chuyển nếu project đã được tạo
    if (currentStep === 0 && !projectId) {
      toast.error("Vui lòng xác nhận tạo project trước khi tiếp tục")
      return
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={handleGoBack}
              className="hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay lại
            </Button>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <Rocket className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Tạo Project Mới
              </h1>
              <p className="text-muted-foreground text-lg">
                Thiết lập và triển khai ứng dụng của bạn một cách dễ dàng
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stepper */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-8"
        >
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6 md:p-8">
              <Stepper steps={steps} currentStep={currentStep} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Step content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mb-8"
        >
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {currentStep === 0 && <StepProjectInfo />}
                  {currentStep === 1 && <StepDatabase />}
                  {currentStep === 2 && <StepBackend />}
                  {currentStep === 3 && <StepFrontend />}
                  {currentStep === 4 && <StepSummary />}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="min-w-[140px]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Quay lại
                </Button>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Bước {currentStep + 1} / {steps.length}</span>
                </div>

                {currentStep < steps.length - 1 && (
                  <Button 
                    onClick={handleNext}
                    disabled={currentStep === 0 && !projectId}
                    className="min-w-[140px]"
                  >
                    Tiếp theo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

