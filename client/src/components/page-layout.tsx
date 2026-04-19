import { cn } from '@/lib/utils'
import PageHeader from './page-header'

interface PropsType {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  rightAction?: React.ReactNode
  showHeader?: boolean
  addMarginTop?: boolean
  renderPageHeader?: React.ReactNode
  isFullWidth?: boolean // 1. Thêm prop này
}

const PageLayout = ({
  children,
  className,
  title,
  subtitle,
  rightAction,
  showHeader = true,
  addMarginTop = false,
  renderPageHeader,
  isFullWidth = false //  2. Mặc định là false để không ảnh hưởng trang khác
}: PropsType) => {
  return (
    <div>
      {showHeader && (
        <PageHeader
          title={title}
          subtitle={subtitle}
          rightAction={rightAction}
          renderPageHeader={renderPageHeader}
        />
      )}
      <div
        className={cn(
          'w-full pt-8',
          // 3. Nếu không full width thì mới gắn max-width và canh giữa (mx-auto)
          !isFullWidth && 'max-w-[var(--max-width)] mx-auto',
          addMarginTop && '-mt-20',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export default PageLayout
