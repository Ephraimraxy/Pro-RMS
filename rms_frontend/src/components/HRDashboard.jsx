import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { hrAPI } from '../lib/api';
import {
  Users, CalendarDays, Clock, UserPlus, HeartHandshake,
  CheckCircle2, XCircle, ArrowRight, Eye, TrendingUp,
  AlertCircle, Briefcase, DollarSign
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const StatCard = ({ label, value, icon: Icon, color, sub, onClick }) => (
  <div
    onClick={onClick}
    className={`glass p-5 rounded-[2rem] border border-border/40 relative overflow-hidden group hover:border-primary/40 transition-all bg-white/70 shadow-sm hover:shadow-xl hover:shadow-primary/5 ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
  >
    <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/5 blur-[80px] rounded-full translate-x-12 -translate-y-12`} />
    <div className="flex flex-col gap-4 relative z-10">
      <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 text-${color}-600 flex items-center justify-center group-hover:bg-${color}-500 group-hover:text-white transition-all duration-500 shadow-inner`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-1">{label}</p>
        <h3 className="text-4xl font-black text-foreground tracking-tighter leading-none">{value}</h3>
        {sub && <p className="text-[10px] text-muted-foreground/50 mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  </div>
);

const leaveStatusColors = {
  pending:  'bg-amber-50 border-amber-200 text-amber-700',
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  rejected: 'bg-red-50 border-red-200 text-red-700',
};

const leaveTypeColors = {
  Annual:      'text-blue-600',
  Sick:        'text-red-500',
  Maternity:   'text-pink-500',
  Emergency:   'text-orange-500',
  Compassionate:'text-indigo-500',
};

const QuickActionBtn = ({ icon: Icon, label, color, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border bg-white hover:border-${color}-400 hover:bg-${color}-50 transition-all group active:scale-95 shadow-sm`}
  >
    <div className={`w-10 h-10 rounded-xl bg-${color}-100 border border-${color}-200 text-${color}-600 flex items-center justify-center group-hover:scale-110 transition-transform`}>
      <Icon size={20} />
    </div>
    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">{label}</span>
  </button>
);

const HRDashboard = ({ onViewChange }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ employees: 0, pendingLeaves: 0, attendanceRate: 0, openPositions: 0 });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, leavesRes] = await Promise.allSettled([
          hrAPI.getHRStats(),
          hrAPI.getLeaves({ status: 'pending', limit: 5 }),
        ]);
        if (statsRes.status === 'fulfilled' && statsRes.value) setStats(statsRes.value);
        if (leavesRes.status === 'fulfilled' && leavesRes.value) {
          const data = Array.isArray(leavesRes.value) ? leavesRes.value : (leavesRes.value.results || []);
          setRecentLeaves(data.slice(0, 5));
        }
      } catch (err) {
        console.error('HR Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const attendanceDisplay = stats.attendanceRate
    ? `${Math.round(stats.attendanceRate)}%`
    : '—';

  return (
    <div className="max-w-full mx-auto space-y-5 pb-20 animate-slide-up px-1">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
          People &amp; <span className="text-primary italic font-serif">Culture</span>
        </h1>
        <p className="text-muted-foreground text-[13px] font-medium tracking-tight">
          HR command centre — managing people, performance &amp; process.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Employees"
          value={String(stats.employees || 0).padStart(2, '0')}
          icon={Users}
          color="blue"
          onClick={() => onViewChange('hr_employees')}
        />
        <StatCard
          label="Pending Leaves"
          value={String(stats.pendingLeaves || 0).padStart(2, '0')}
          icon={CalendarDays}
          color="amber"
          sub="Awaiting approval"
          onClick={() => onViewChange('hr_leaves')}
        />
        <StatCard
          label="Attendance Rate"
          value={attendanceDisplay}
          icon={Clock}
          color="emerald"
          sub="This month"
          onClick={() => onViewChange('hr_attendance')}
        />
        <StatCard
          label="Open Positions"
          value={String(stats.openPositions || 0).padStart(2, '0')}
          icon={UserPlus}
          color="purple"
          sub="Active job listings"
          onClick={() => onViewChange('hr_recruitment')}
        />
      </div>

      {/* Quick Actions */}
      <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          <h3 className="text-base font-bold text-foreground tracking-tight">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <QuickActionBtn icon={Users} label="Employees" color="blue" onClick={() => onViewChange('hr_employees')} />
          <QuickActionBtn icon={CalendarDays} label="Leave" color="amber" onClick={() => onViewChange('hr_leaves')} />
          <QuickActionBtn icon={Clock} label="Attendance" color="emerald" onClick={() => onViewChange('hr_attendance')} />
          <QuickActionBtn icon={DollarSign} label="Payroll" color="green" onClick={() => onViewChange('hr_payroll')} />
          <QuickActionBtn icon={UserPlus} label="Recruit" color="purple" onClick={() => onViewChange('hr_recruitment')} />
          <QuickActionBtn icon={Briefcase} label="Departments" color="orange" onClick={() => onViewChange('department_manager')} />
        </div>
      </div>

      {/* Recent Leave Requests */}
      <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 p-1 shadow-2xl shadow-primary/5 overflow-hidden">
        <div className="bg-[#FAF9F6]/30 rounded-[1.8rem] p-4 lg:p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border/20 pb-4">
            <div className="flex items-center space-x-4">
              <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
              <h3 className="text-xl font-bold text-foreground tracking-tight">Pending Leave Requests</h3>
              {recentLeaves.length > 0 && (
                <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.15em] animate-pulse">
                  {recentLeaves.length} Awaiting
                </span>
              )}
            </div>
            <button
              onClick={() => onViewChange('hr_leaves')}
              className="px-5 py-2 rounded-xl bg-white border border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center gap-3 active:scale-95"
            >
              <Eye size={14} /> Manage All
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-muted/40 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : recentLeaves.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-xl font-black text-foreground tracking-tight">All Clear</p>
                <p className="text-sm text-muted-foreground font-medium">No pending leave requests at this time.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="pb-3 px-5">Employee</th>
                    <th className="pb-3 px-5">Leave Type</th>
                    <th className="pb-3 px-5">Duration</th>
                    <th className="pb-3 px-5">Days</th>
                    <th className="pb-3 px-5">Status</th>
                    <th className="pb-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeaves.map(lv => (
                    <tr key={lv.id} className="group transition-all">
                      <td className="py-3 px-5 bg-white/50 border-y border-l border-border/30 rounded-l-2xl group-hover:bg-white transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[10px] font-black flex items-center justify-center">
                            {(lv.employeeName || lv.employee?.name || 'E').split(' ').slice(0, 2).map(w => w[0]).join('')}
                          </div>
                          <div>
                            <p className="text-[12px] font-bold text-foreground">{lv.employeeName || lv.employee?.name || '—'}</p>
                            <p className="text-[9px] text-muted-foreground/60 font-mono">{lv.department || lv.employee?.department || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                        <span className={`text-[11px] font-black ${leaveTypeColors[lv.leaveType] || 'text-foreground'}`}>
                          {lv.leaveType || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <span>{lv.startDate ? new Date(lv.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</span>
                          <ArrowRight size={9} className="opacity-40" />
                          <span>{lv.endDate ? new Date(lv.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                        <span className="text-sm font-black text-foreground">{lv.days ?? '—'}</span>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-border/30 group-hover:bg-white transition-colors">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${leaveStatusColors[lv.status] || 'bg-muted border-border text-muted-foreground'}`}>
                          {lv.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3 px-5 bg-white/50 border-y border-r border-border/30 rounded-r-2xl group-hover:bg-white transition-colors text-right">
                        <button
                          onClick={() => onViewChange('hr_leaves')}
                          className="p-2 bg-background hover:bg-primary hover:text-white rounded-xl text-primary transition-all border border-primary/10 shadow-sm active:scale-90"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* HR Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Employees On Leave Today', value: stats.onLeaveToday ?? '—', icon: CalendarDays, color: 'blue' },
          { label: 'New Hires This Month',      value: stats.newHires ?? '—',      icon: TrendingUp,  color: 'emerald' },
          { label: 'Payroll Processed',         value: stats.payrollProcessed ? `₦${Number(stats.payrollProcessed).toLocaleString()}` : '—', icon: DollarSign, color: 'green' },
        ].map(m => (
          <div key={m.label} className="glass bg-white/70 rounded-2xl border border-border/40 p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-11 h-11 rounded-2xl bg-${m.color}-500/10 border border-${m.color}-500/20 text-${m.color}-600 flex items-center justify-center shrink-0`}>
              <m.icon size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.15em]">{m.label}</p>
              <p className="text-2xl font-black text-foreground tracking-tighter">{m.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HRDashboard;
