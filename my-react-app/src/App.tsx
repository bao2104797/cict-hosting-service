import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "sonner"
import { AuthProvider } from "./contexts/AuthContext"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"
import { HomeRedirect } from "./components/common/HomeRedirect"
import { Login } from "./pages/auth/Login"
import { Register } from "./pages/auth/Register"
import { ProjectsList } from "@/apps/user/pages/projects/List"
import { ProjectDetail } from "@/apps/user/pages/projects/Detail"
import { ProjectNew } from "@/apps/user/pages/projects/New"
import { Navbar } from "@/apps/user/components/Navbar"
import { Footer } from "@/apps/user/components/Footer"
// Admin imports
import { AdminLayout } from "@/apps/admin/components/AdminLayout"
import { Overview } from "@/apps/admin/pages/Overview"
import { Servers } from "@/apps/admin/pages/infrastructure/Servers"
import { Clusters } from "@/apps/admin/pages/infrastructure/Clusters"
import { ClusterSetup } from "@/apps/admin/pages/infrastructure/ClusterSetup"
import { ClusterSetupAmd } from "@/apps/admin/pages/infrastructure/ClusterSetupAmd"
import { ClusterOverview } from "@/apps/admin/pages/cluster/ClusterOverview"
import { Nodes } from "@/apps/admin/pages/cluster/Nodes"
import { Namespaces } from "@/apps/admin/pages/cluster/Namespaces"
import { Deployments } from "@/apps/admin/pages/workloads/Deployments"
import { Pods } from "@/apps/admin/pages/workloads/Pods"
import { Statefulsets } from "@/apps/admin/pages/workloads/Statefulsets"
import { Services } from "@/apps/admin/pages/services/Services"
import { IngressList } from "@/apps/admin/pages/services/Ingress"
import { PVCList } from "@/apps/admin/pages/storage/PVC"
import { PVList } from "@/apps/admin/pages/storage/PV"
import { Services as UserServices } from "@/apps/admin/pages/users/Services"
import { Account } from "@/apps/admin/pages/users/Account"
import { ReplicaRequests } from "@/apps/admin/pages/users/ReplicaRequests"
import "./index.css"

/**
 * Component App chính với routing và dark mode
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-background flex flex-col">
          <Routes>
            {/* Public routes - không cần đăng nhập */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes - cần đăng nhập */}
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <ProjectsList />
                  <Footer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/new"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <ProjectNew />
                  <Footer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <ProjectDetail />
                  <Footer />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin/overview"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Overview />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/infrastructure/servers"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Servers />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/infrastructure/clusters"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Clusters />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/infrastructure/cluster-setup"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <ClusterSetup />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/infrastructure/cluster-setup-amd"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <ClusterSetupAmd />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cluster/overview"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <ClusterOverview />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cluster/nodes"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Nodes />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cluster/namespaces"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Namespaces />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/workloads/deployments"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Deployments />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/workloads/pods"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Pods />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/workloads/statefulsets"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Statefulsets />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/services"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Services />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ingress"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <IngressList />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/storage/pvc"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <PVCList />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/storage/pv"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <PVList />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/replica-requests"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <ReplicaRequests />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <UserServices />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/accounts"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Account />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Default routes */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
          <Toaster position="top-right" />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

