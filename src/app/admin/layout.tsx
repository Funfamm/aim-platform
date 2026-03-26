import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession()

    // Allow the admin login redirect page to render without auth
    // All other admin pages require admin/superadmin role
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        redirect('/login?redirect=/admin')
    }

    return <>{children}</>
}
