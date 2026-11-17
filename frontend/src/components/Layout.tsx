import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { PageSkeleton } from './ui/Skeleton'
import { FeedbackButton } from './FeedbackButton'
import { Footer } from './Footer'
import { Header } from './Header'
import { VipProvider } from './vip/VipProvider'

export function Layout() {
  return (
    <VipProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-page flex-1 px-4 pb-16 pt-6 sm:px-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
      </div>
      <FeedbackButton />
    </VipProvider>
  )
}
