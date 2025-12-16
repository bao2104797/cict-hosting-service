import { Database, Server, Globe, Play, Pause } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ComponentStats {
  total: number
  running: number
  paused: number
  other: number
}

interface StatsChartProps {
  title: string
  icon: React.ReactNode
  stats: ComponentStats
  color: string
}

/**
 * Component hiển thị thống kê với biểu đồ bar chart đơn giản
 */
export function StatsChart({ title, icon, stats, color }: StatsChartProps) {
  const { total, running, paused, other } = stats
  const runningPercent = total > 0 ? (running / total) * 100 : 0
  const pausedPercent = total > 0 ? (paused / total) * 100 : 0
  const otherPercent = total > 0 ? (other / total) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-lg font-semibold">
            {total}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Thống kê số lượng */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {running}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Đang chạy</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {paused}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Đang dừng</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {other}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Khác</div>
            </div>
          </div>

          {/* Biểu đồ bar chart */}
          {total > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500"></div>
                  <span>Đang chạy</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-yellow-500"></div>
                  <span>Đang dừng</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-gray-400"></div>
                  <span>Khác</span>
                </div>
              </div>
              <div className="h-8 w-full bg-muted rounded-full overflow-hidden flex">
                {runningPercent > 0 && (
                  <div
                    className="bg-green-500 transition-all duration-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${runningPercent}%` }}
                    title={`Đang chạy: ${running}`}
                  >
                    {runningPercent > 10 && running}
                  </div>
                )}
                {pausedPercent > 0 && (
                  <div
                    className="bg-yellow-500 transition-all duration-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${pausedPercent}%` }}
                    title={`Đang dừng: ${paused}`}
                  >
                    {pausedPercent > 10 && paused}
                  </div>
                )}
                {otherPercent > 0 && (
                  <div
                    className="bg-gray-400 transition-all duration-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${otherPercent}%` }}
                    title={`Khác: ${other}`}
                  >
                    {otherPercent > 10 && other}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-4">
              Chưa có {title.toLowerCase()} nào
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface OverviewStatsProps {
  databases: ComponentStats
  backends: ComponentStats
  frontends: ComponentStats
}

/**
 * Component tổng hợp thống kê cho tab Tổng quan
 */
export function OverviewStats({ databases, backends, frontends }: OverviewStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatsChart
        title="Databases"
        icon={<Database className="w-5 h-5 text-blue-500" />}
        stats={databases}
        color="blue"
      />
      <StatsChart
        title="Backends"
        icon={<Server className="w-5 h-5 text-purple-500" />}
        stats={backends}
        color="purple"
      />
      <StatsChart
        title="Frontends"
        icon={<Globe className="w-5 h-5 text-green-500" />}
        stats={frontends}
        color="green"
      />
    </div>
  )
}

