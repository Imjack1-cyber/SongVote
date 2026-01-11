import { getAdminDashboardData } from '@/app/actions';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic'; // Ensure no caching of admin stats

export default async function AdminPage() {
  const user = await getCurrentUser();
  
  if (!user || user.userId !== process.env.SUPER_ADMIN_ID) {
    redirect('/');
  }

  const data = await getAdminDashboardData();

  return (
    <AdminDashboard 
        kpis={data.kpis} 
        hosts={data.hosts} 
        chartData={data.chart} 
    />
  );
}