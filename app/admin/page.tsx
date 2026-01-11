import { getAdminDashboardData } from '@/app/actions';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AnnouncementControl from '@/components/admin/AnnouncementControl';
import SystemHealthMonitor from '@/components/admin/SystemHealthMonitor'; 
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getCurrentUser();
  
  if (!user || user.userId !== process.env.SUPER_ADMIN_ID) {
    redirect('/');
  }

  const data = await getAdminDashboardData();

  return (
    <div className="space-y-12">
        
        <div className="grid lg:grid-cols-2 gap-8">
            <AnnouncementControl />
            <SystemHealthMonitor /> 
        </div>
        
        <AdminDashboard 
            kpis={data.kpis} 
            hosts={data.hosts} 
            chartData={data.chart} 
        />
    </div>
  );
}