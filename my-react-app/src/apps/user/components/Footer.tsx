/**
 * Component Footer cho trang web
 */
export function Footer() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 text-sm text-muted-foreground">
          <div className="flex flex-col gap-2">
            <div>
              <span className="font-medium text-foreground">Người hướng dẫn:</span>{" "}
              <span>TS. Lâm Chí Nguyện</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Sinh viên thực hiện:</span>{" "}
              <span>Nguyễn Gia Bảo - B2104797, Nguyễn Minh Thành - B2104824</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

