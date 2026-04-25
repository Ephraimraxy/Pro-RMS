import { useState, useEffect } from 'react';
import { hrAPI } from '../lib/api';
import {
  Clock, ChevronLeft, ChevronRight, Download,
  CheckCircle2, XCircle, AlertTriangle, CalendarDays,
  Users, TrendingUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// Status: P=Present, A=Absent, L=Late, H=Holiday, LV=On Leave, WE=Weekend
const STATUS_CONFIG = {
  P:  { label: 'P',  bg: 'bg-emerald-100 text-emerald-700', title: 'Present'  },
  L:  { label: 'L',  bg: 'bg-amber-100 text-amber-700',     title: 'Late'     },
  A:  { label: 'A',  bg: 'bg-red-100 text-red-700',         title: 'Absent'   },
  H:  { label: 'H',  bg: 'bg-blue-100 text-blue-700',       title: 'Holiday'  },
  LV: { label: 'LV', bg: 'bg-indigo-100 text-indigo-700',   title: 'On Leave' },
  WE: { label: '—',  bg: 'bg-muted/30 text-muted-foreground/30', title: 'Weekend' },
  '': { label: '·',  bg: 'bg-muted/20 text-muted-foreground/20', title: 'No Data' },
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const isWeekend = (year, month, day) => {
  const dow = new Date(year, month, day).getDay();
  return dow === 0 || dow === 6;
};

const exportCSV = (employees, days, attendanceMap, year, month) => {
  const header = ['Employee', 'Department', ...days.map(d => `${d}/${month+1}`), 'Present', 'Absent', 'Late'];
  const rows = employees.map(emp => {
    const record = attendanceMap[emp.id] || {};
    let p = 0, a = 0, l = 0;
    const cells = days.map(d => {
      const status = isWeekend(year, month, d) ? 'WE' : (record[d] || '');
      if (status === 'P') p++;
      else if (status === 'A') a++;
      else if (status === 'L') l++;
      return STATUS_CONFIG[status]?.title || '—';
    });
    return [`${emp.firstName} ${emp.lastName}`, emp.department || '', ...cells, p, a, l];
  });

  const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_${MONTHS[month]}_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const AttendanceTracker = ({ onViewChange }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [employees, setEmployees] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // { employeeId: { day: 'P'|'A'|'L'|'H'|'LV' } }
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState(null); // { empId, day }
  const [saving, setSaving] = useState(false);

  const totalDays = getDaysInMonth(year, month);
  const workDays = Array.from({ length: totalDays }, (_, i) => i + 1)
    .filter(d => !isWeekend(year, month, d));
  const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);

  const load = async () => {
    setLoading(true);
    try {
      const [empRes, attRes] = await Promise.allSettled([
        hrAPI.getEmployees(),
        hrAPI.getAttendance({ year, month: month + 1 }),
      ]);
      if (empRes.status === 'fulfilled') {
        const emps = Array.isArray(empRes.value) ? empRes.value : (empRes.value?.results || []);
        setEmployees(emps.filter(e => e.status === 'active' || !e.status));
      }
      if (attRes.status === 'fulfilled') {
        const records = Array.isArray(attRes.value) ? attRes.value : (attRes.value?.results || []);
        const map = {};
        records.forEach(r => {
          if (!map[r.employeeId]) map[r.employeeId] = {};
          const day = new Date(r.date).getDate();
          map[r.employeeId][day] = r.status;
        });
        setAttendanceMap(map);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const handleCellClick = (empId, day) => {
    if (isWeekend(year, month, day)) return;
    setEditCell({ empId, day });
  };

  const handleStatusSelect = async (status) => {
    if (!editCell) return;
    const { empId, day } = editCell;
    const prev = attendanceMap[empId]?.[day];
    setAttendanceMap(m => ({ ...m, [empId]: { ...(m[empId] || {}), [day]: status } }));
    setEditCell(null);
    try {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      await hrAPI.markAttendance({ employeeId: empId, date, status });
    } catch (err) {
      setAttendanceMap(m => ({ ...m, [empId]: { ...(m[empId] || {}), [day]: prev } }));
      toast.error('Failed to save attendance.');
    }
  };

  // Summary stats
  const totalPresent = employees.reduce((sum, emp) => {
    const rec = attendanceMap[emp.id] || {};
    return sum + Object.values(rec).filter(s => s === 'P').length;
  }, 0);
  const totalAbsent = employees.reduce((sum, emp) => {
    const rec = attendanceMap[emp.id] || {};
    return sum + Object.values(rec).filter(s => s === 'A').length;
  }, 0);
  const totalLate = employees.reduce((sum, emp) => {
    const rec = attendanceMap[emp.id] || {};
    return sum + Object.values(rec).filter(s => s === 'L').length;
  }, 0);
  const possibleDays = employees.length * workDays.length;
  const attendanceRate = possibleDays > 0 ? Math.round(((totalPresent + totalLate) / possibleDays) * 100) : 0;

  return (
    <div className="max-w-full mx-auto space-y-5 pb-20 animate-slide-up px-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
            Attendance <span className="text-primary italic font-serif">Tracker</span>
          </h1>
          <p className="text-muted-foreground text-[13px] font-medium">
            Click any cell to mark attendance. Weekends are locked.
          </p>
        </div>
        <button
          onClick={() => exportCSV(employees, allDays, attendanceMap, year, month)}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-border/50 text-foreground rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm active:scale-95 shrink-0"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Month Navigator */}
      <div className="glass bg-white/70 rounded-2xl border border-border/40 p-4 flex items-center justify-between">
        <button onClick={prevMonth} className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground tracking-tighter">{MONTHS[month]} {year}</h2>
          <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{workDays.length} working days · {employees.length} active employees</p>
        </div>
        <button onClick={nextMonth} className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Attendance Rate', value: `${attendanceRate}%`, icon: TrendingUp, color: 'emerald' },
          { label: 'Total Present',   value: totalPresent,          icon: CheckCircle2, color: 'blue'    },
          { label: 'Total Absent',    value: totalAbsent,           icon: XCircle,      color: 'red'     },
          { label: 'Late Arrivals',   value: totalLate,             icon: AlertTriangle, color: 'amber'  },
        ].map(s => (
          <div key={s.label} className="glass bg-white/70 rounded-2xl border border-border/40 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-${s.color}-500/10 border border-${s.color}-500/20 text-${s.color}-600 flex items-center justify-center shrink-0`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-black text-foreground tracking-tighter">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== '' && k !== 'WE').map(([key, cfg]) => (
          <div key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black ${cfg.bg} border border-current/20`}>
            <span className="w-4 h-4 rounded flex items-center justify-center font-black text-[9px] bg-current/10">{cfg.label}</span>
            {cfg.title}
          </div>
        ))}
      </div>

      {/* Attendance Grid */}
      <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-2xl shadow-primary/5 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" />)}
          </div>
        ) : employees.length === 0 ? (
          <div className="py-20 text-center space-y-4 p-8">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto opacity-40">
              <Users size={32} className="text-muted-foreground" />
            </div>
            <p className="text-xl font-black text-foreground">No Active Employees</p>
            <p className="text-sm text-muted-foreground">Add active employees in the directory first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="text-left" style={{ minWidth: `${Math.max(900, 160 + allDays.length * 42)}px` }}>
              <thead>
                <tr className="border-b border-border/30">
                  <th className="sticky left-0 z-10 bg-[#FAF9F6] px-5 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] min-w-[160px]">
                    Employee
                  </th>
                  {allDays.map(d => {
                    const we = isWeekend(year, month, d);
                    const dow = ['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(year, month, d).getDay()];
                    return (
                      <th key={d} className={`px-1 py-4 text-center text-[9px] font-black uppercase tracking-widest min-w-[36px] ${we ? 'text-muted-foreground/30' : 'text-muted-foreground/60'}`}>
                        <div>{d}</div>
                        <div className="text-[8px] opacity-60">{dow}</div>
                      </th>
                    );
                  })}
                  <th className="px-5 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">P</th>
                  <th className="px-3 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">A</th>
                  <th className="px-3 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">L</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => {
                  const rec = attendanceMap[emp.id] || {};
                  let p = 0, a = 0, l = 0;
                  return (
                    <tr key={emp.id} className={`border-b border-border/10 ${idx % 2 === 0 ? 'bg-white/30' : 'bg-white/10'} hover:bg-white/60 transition-colors`}>
                      <td className="sticky left-0 z-10 bg-inherit px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[9px] font-black flex items-center justify-center shrink-0">
                            {`${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-foreground whitespace-nowrap">{emp.firstName} {emp.lastName}</p>
                            <p className="text-[9px] text-muted-foreground/60 truncate max-w-[100px]">{emp.department || ''}</p>
                          </div>
                        </div>
                      </td>
                      {allDays.map(d => {
                        const we = isWeekend(year, month, d);
                        const status = we ? 'WE' : (rec[d] || '');
                        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[''];
                        if (status === 'P') p++;
                        else if (status === 'A') a++;
                        else if (status === 'L') l++;
                        return (
                          <td
                            key={d}
                            onClick={() => handleCellClick(emp.id, d)}
                            title={cfg.title}
                            className={`px-1 py-2.5 text-center cursor-${we ? 'default' : 'pointer'} relative`}
                          >
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[9px] font-black transition-all ${cfg.bg} ${!we ? 'hover:scale-110 hover:shadow-sm' : ''}`}>
                              {cfg.label}
                            </span>
                            {/* Popover for editing */}
                            {editCell?.empId === emp.id && editCell?.day === d && (
                              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white rounded-2xl border border-border/60 shadow-2xl p-2 flex gap-1.5 animate-in zoom-in-90 duration-150">
                                {['P','L','A','H','LV'].map(s => {
                                  const c = STATUS_CONFIG[s];
                                  return (
                                    <button
                                      key={s}
                                      onClick={(e) => { e.stopPropagation(); handleStatusSelect(s); }}
                                      title={c.title}
                                      className={`w-8 h-8 rounded-lg text-[9px] font-black transition-all hover:scale-110 ${c.bg}`}
                                    >
                                      {c.label}
                                    </button>
                                  );
                                })}
                                <button onClick={(e) => { e.stopPropagation(); setEditCell(null); }} className="w-8 h-8 rounded-lg text-[9px] font-black bg-muted text-muted-foreground hover:bg-muted/80 transition-all">
                                  ×
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-5 py-2.5 text-center text-[12px] font-black text-emerald-600">{p}</td>
                      <td className="px-3 py-2.5 text-center text-[12px] font-black text-red-600">{a}</td>
                      <td className="px-3 py-2.5 text-center text-[12px] font-black text-amber-600">{l}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Click outside to close popover */}
      {editCell && (
        <div className="fixed inset-0 z-40" onClick={() => setEditCell(null)} />
      )}
    </div>
  );
};

export default AttendanceTracker;
