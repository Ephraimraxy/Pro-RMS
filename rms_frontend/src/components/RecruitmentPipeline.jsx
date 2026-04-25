import { useState, useEffect } from 'react';
import { hrAPI } from '../lib/api';
import {
  UserPlus, Plus, X, Briefcase, MapPin, Clock,
  CheckCircle2, XCircle, ArrowRight, Eye, Edit2,
  Trash2, AlertCircle, ChevronRight, Users, Star,
  Mail, Phone
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
const STAGE_COLORS = {
  Applied:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
  Screening: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  Interview: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-400' },
  Offer:     { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-400' },
  Hired:     { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-700',dot: 'bg-emerald-400'},
  Rejected:  { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-400'    },
};

const JOB_STATUS = {
  open:   'bg-emerald-50 border-emerald-200 text-emerald-700',
  closed: 'bg-muted border-border text-muted-foreground',
  draft:  'bg-amber-50 border-amber-200 text-amber-700',
};

const EMPTY_JOB = { title: '', department: '', location: '', type: 'Full-time', description: '', requirements: '', status: 'open' };
const EMPTY_APPLICANT = { name: '', email: '', phone: '', stage: 'Applied', notes: '', rating: 0 };

const RatingStars = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(s => (
      <button key={s} type="button" onClick={() => onChange && onChange(s)} className={`transition-colors ${s <= value ? 'text-amber-400' : 'text-muted/40'} hover:text-amber-400`}>
        <Star size={14} fill={s <= value ? 'currentColor' : 'none'} />
      </button>
    ))}
  </div>
);

const ApplicantCard = ({ applicant, stages, onMove, onDelete, onView }) => {
  const cfg = STAGE_COLORS[applicant.stage] || STAGE_COLORS.Applied;
  const currentIdx = STAGES.indexOf(applicant.stage);
  const nextStage = STAGES[currentIdx + 1];

  return (
    <div className="bg-white rounded-2xl border border-border/40 p-4 space-y-3 hover:border-primary/30 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-black text-foreground">{applicant.name || '—'}</p>
          {applicant.email && <p className="text-[9px] text-muted-foreground/60 truncate max-w-[150px]">{applicant.email}</p>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onView(applicant)} className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
            <Eye size={12} />
          </button>
          <button onClick={() => onDelete(applicant)} className="p-1 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {applicant.rating > 0 && <RatingStars value={applicant.rating} />}

      {applicant.notes && (
        <p className="text-[10px] text-muted-foreground line-clamp-2 italic">"{applicant.notes}"</p>
      )}

      <div className="flex items-center gap-1.5 pt-1 border-t border-border/20">
        {nextStage && nextStage !== 'Hired' && (
          <button
            onClick={() => onMove(applicant, nextStage)}
            className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-95 ${STAGE_COLORS[nextStage].bg} ${STAGE_COLORS[nextStage].border} border ${STAGE_COLORS[nextStage].text} hover:opacity-80`}
          >
            → {nextStage}
          </button>
        )}
        {currentIdx < STAGES.length - 1 && nextStage === 'Hired' && (
          <button
            onClick={() => onMove(applicant, 'Hired')}
            className="flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white border border-emerald-600 flex items-center justify-center gap-1 hover:bg-emerald-600 transition-all active:scale-95"
          >
            <CheckCircle2 size={10} /> Hire
          </button>
        )}
        <button
          onClick={() => onMove(applicant, 'Rejected')}
          className="p-1.5 rounded-xl bg-red-50 text-destructive border border-red-200 hover:bg-destructive hover:text-white transition-colors"
          title="Reject"
        >
          <XCircle size={12} />
        </button>
      </div>
    </div>
  );
};

const RecruitmentPipeline = ({ onViewChange }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState(EMPTY_JOB);
  const [savingJob, setSavingJob] = useState(false);
  const [showApplicantForm, setShowApplicantForm] = useState(false);
  const [applicantForm, setApplicantForm] = useState(EMPTY_APPLICANT);
  const [savingApplicant, setSavingApplicant] = useState(false);
  const [deleteJobTarget, setDeleteJobTarget] = useState(null);
  const [deleteApplicantTarget, setDeleteApplicantTarget] = useState(null);
  const [viewApplicant, setViewApplicant] = useState(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await hrAPI.getJobs();
      const data = Array.isArray(res) ? res : (res?.results || []);
      setJobs(data);
      if (data.length > 0 && !selectedJob) setSelectedJob(data[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadApplicants = async (jobId) => {
    if (!jobId) return;
    setLoadingApplicants(true);
    try {
      const res = await hrAPI.getApplicants(jobId);
      setApplicants(Array.isArray(res) ? res : (res?.results || []));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingApplicants(false);
    }
  };

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => { if (selectedJob) loadApplicants(selectedJob.id); }, [selectedJob?.id]);

  const handleSaveJob = async (e) => {
    e.preventDefault();
    if (!jobForm.title || !jobForm.department) { toast.error('Job title and department are required.'); return; }
    setSavingJob(true);
    try {
      if (editingJob) {
        await hrAPI.updateJob(editingJob.id, jobForm);
        toast.success('Job updated.');
      } else {
        await hrAPI.createJob(jobForm);
        toast.success('Job opening created.');
      }
      setShowJobForm(false);
      setEditingJob(null);
      setJobForm(EMPTY_JOB);
      loadJobs();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save job.');
    } finally {
      setSavingJob(false);
    }
  };

  const handleSaveApplicant = async (e) => {
    e.preventDefault();
    if (!applicantForm.name) { toast.error('Applicant name is required.'); return; }
    setSavingApplicant(true);
    try {
      await hrAPI.createApplicant(selectedJob.id, applicantForm);
      toast.success('Applicant added.');
      setShowApplicantForm(false);
      setApplicantForm(EMPTY_APPLICANT);
      loadApplicants(selectedJob.id);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add applicant.');
    } finally {
      setSavingApplicant(false);
    }
  };

  const handleMoveApplicant = async (applicant, stage) => {
    setApplicants(prev => prev.map(a => a.id === applicant.id ? { ...a, stage } : a));
    try {
      await hrAPI.updateApplicantStage(applicant.id, stage);
    } catch (err) {
      setApplicants(prev => prev.map(a => a.id === applicant.id ? { ...a, stage: applicant.stage } : a));
      toast.error('Failed to move applicant.');
    }
  };

  const handleCloseJob = async (job) => {
    try {
      await hrAPI.closeJob(job.id);
      toast.success(`"${job.title}" closed.`);
      loadJobs();
    } catch (err) {
      toast.error('Failed to close job.');
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobTarget) return;
    try {
      await hrAPI.deleteJob(deleteJobTarget.id);
      toast.success('Job removed.');
      setDeleteJobTarget(null);
      setSelectedJob(null);
      loadJobs();
    } catch (err) {
      toast.error('Failed to delete job.');
    }
  };

  const applicantsByStage = (stage) => applicants.filter(a => a.stage === stage);
  const openJobs = jobs.filter(j => j.status === 'open').length;

  return (
    <div className="max-w-full mx-auto space-y-5 pb-20 animate-slide-up px-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
            Recruitment <span className="text-primary italic font-serif">Pipeline</span>
          </h1>
          <p className="text-muted-foreground text-[13px] font-medium">
            {openJobs} open position{openJobs !== 1 ? 's' : ''} · {applicants.length} applicant{applicants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setEditingJob(null); setJobForm(EMPTY_JOB); setShowJobForm(true); }}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 shrink-0"
        >
          <Plus size={16} /> New Job Opening
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Job List Sidebar */}
        <div className="lg:w-72 shrink-0 space-y-3">
          <h3 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.25em] px-1">Job Openings</h3>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted/40 rounded-2xl animate-pulse" />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="glass bg-white/70 rounded-2xl border border-border/40 p-6 text-center space-y-3">
              <Briefcase size={28} className="text-muted-foreground/30 mx-auto" />
              <p className="text-[12px] font-black text-foreground">No Jobs Posted</p>
              <button onClick={() => { setEditingJob(null); setJobForm(EMPTY_JOB); setShowJobForm(true); }} className="text-[10px] font-black text-primary hover:underline">
                + Post First Job
              </button>
            </div>
          ) : (
            jobs.map(job => (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`glass rounded-2xl border p-4 cursor-pointer transition-all group ${selectedJob?.id === job.id ? 'border-primary/50 bg-primary/5 shadow-md' : 'border-border/40 bg-white/70 hover:border-primary/30'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-foreground truncate">{job.title}</p>
                    <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5 truncate">{job.department} · {job.location || 'On-site'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border tracking-widest ${JOB_STATUS[job.status] || JOB_STATUS.open}`}>
                        {job.status || 'open'}
                      </span>
                      <span className="text-[9px] text-muted-foreground/50 font-medium">{job.type || 'Full-time'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setEditingJob(job); setJobForm(job); setShowJobForm(true); }} className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteJobTarget(job); }} className="p-1 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                {selectedJob?.id === job.id && (
                  <div className="mt-2 pt-2 border-t border-primary/10 flex items-center justify-between">
                    <span className="text-[9px] text-primary font-black uppercase tracking-widest">{applicants.length} applicants</span>
                    {job.status === 'open' && (
                      <button onClick={(e) => { e.stopPropagation(); handleCloseJob(job); }} className="text-[8px] font-black text-muted-foreground hover:text-destructive uppercase tracking-widest transition-colors">
                        Close
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Kanban Board */}
        <div className="flex-1 min-w-0">
          {!selectedJob ? (
            <div className="glass bg-white/70 rounded-[2rem] border border-border/40 py-24 text-center space-y-4">
              <Briefcase size={36} className="text-muted-foreground/20 mx-auto" />
              <p className="text-lg font-black text-foreground/50">Select a job opening</p>
              <p className="text-sm text-muted-foreground/50">Choose a position from the left panel to view its pipeline.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-foreground tracking-tight">{selectedJob.title}</h2>
                  <p className="text-[10px] text-muted-foreground/60 font-medium">{selectedJob.department} · {selectedJob.type}</p>
                </div>
                <button
                  onClick={() => { setApplicantForm(EMPTY_APPLICANT); setShowApplicantForm(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-border/50 text-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm active:scale-95"
                >
                  <UserPlus size={13} /> Add Applicant
                </button>
              </div>

              {/* Kanban Columns */}
              {loadingApplicants ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {STAGES.map(s => <div key={s} className="h-48 bg-muted/40 rounded-2xl animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {STAGES.map(stage => {
                    const stageApps = applicantsByStage(stage);
                    const cfg = STAGE_COLORS[stage];
                    return (
                      <div key={stage} className={`rounded-2xl border p-3 space-y-3 ${cfg.bg} ${cfg.border}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.text}`}>{stage}</span>
                          </div>
                          <span className={`text-[9px] font-black ${cfg.text} opacity-60`}>{stageApps.length}</span>
                        </div>
                        <div className="space-y-2 min-h-[80px]">
                          {stageApps.length === 0 ? (
                            <div className="h-16 flex items-center justify-center rounded-xl border border-dashed border-current/20">
                              <p className={`text-[9px] font-medium ${cfg.text} opacity-40`}>No applicants</p>
                            </div>
                          ) : (
                            stageApps.map(app => (
                              <ApplicantCard
                                key={app.id}
                                applicant={app}
                                stages={STAGES}
                                onMove={handleMoveApplicant}
                                onDelete={setDeleteApplicantTarget}
                                onView={setViewApplicant}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rejected column */}
              {applicantsByStage('Rejected').length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-700">Rejected ({applicantsByStage('Rejected').length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {applicantsByStage('Rejected').map(app => (
                      <div key={app.id} className="bg-white rounded-xl border border-red-100 p-3 flex items-center justify-between group">
                        <p className="text-[11px] font-bold text-foreground/60 truncate">{app.name}</p>
                        <button onClick={() => setDeleteApplicantTarget(app)} className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted-foreground hover:text-destructive transition-all">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Job Form Slide-In */}
      {showJobForm && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowJobForm(false)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto custom-scrollbar shadow-2xl animate-in slide-in-from-right-5 duration-300 flex flex-col">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-border/40 px-6 py-5 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-black text-foreground">{editingJob ? 'Edit Job' : 'New Job Opening'}</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">{editingJob ? 'Update posting details' : 'Create a new vacancy'}</p>
              </div>
              <button onClick={() => setShowJobForm(false)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveJob} className="p-6 space-y-4 flex-1">
              {[
                { label: 'Job Title', key: 'title', required: true },
                { label: 'Department', key: 'department', required: true },
                { label: 'Location', key: 'location' },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</label>
                  <input value={jobForm[f.key] || ''} onChange={e => setJobForm(p => ({ ...p, [f.key]: e.target.value }))} required={f.required} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Type</label>
                  <select value={jobForm.type} onChange={e => setJobForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    {['Full-time','Part-time','Contract','Internship','Remote'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</label>
                  <select value={jobForm.status} onChange={e => setJobForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    <option value="open">Open</option>
                    <option value="draft">Draft</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Job Description</label>
                <textarea value={jobForm.description} onChange={e => setJobForm(p => ({ ...p, description: e.target.value }))} rows={4} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none" placeholder="Describe the role and responsibilities…" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Requirements</label>
                <textarea value={jobForm.requirements} onChange={e => setJobForm(p => ({ ...p, requirements: e.target.value }))} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none" placeholder="List key qualifications…" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowJobForm(false)} className="flex-1 py-3 rounded-xl border border-border/50 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:bg-muted transition-all">Cancel</button>
                <button type="submit" disabled={savingJob} className="flex-1 py-3 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60 active:scale-95">
                  {savingJob ? 'Saving…' : editingJob ? 'Update Job' : 'Post Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Applicant Form Slide-In */}
      {showApplicantForm && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowApplicantForm(false)} />
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto custom-scrollbar shadow-2xl animate-in slide-in-from-right-5 duration-300 flex flex-col">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-border/40 px-6 py-5 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-black text-foreground">Add Applicant</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">For: {selectedJob?.title}</p>
              </div>
              <button onClick={() => setShowApplicantForm(false)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveApplicant} className="p-6 space-y-4 flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Full Name <span className="text-destructive">*</span></label>
                <input value={applicantForm.name} onChange={e => setApplicantForm(p => ({ ...p, name: e.target.value }))} required className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Email</label>
                <input type="email" value={applicantForm.email} onChange={e => setApplicantForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Phone</label>
                <input type="tel" value={applicantForm.phone} onChange={e => setApplicantForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Entry Stage</label>
                <select value={applicantForm.stage} onChange={e => setApplicantForm(p => ({ ...p, stage: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Initial Rating</label>
                <RatingStars value={applicantForm.rating} onChange={v => setApplicantForm(p => ({ ...p, rating: v }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Notes</label>
                <textarea value={applicantForm.notes} onChange={e => setApplicantForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-white text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none" placeholder="Interview notes, referral source…" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowApplicantForm(false)} className="flex-1 py-3 rounded-xl border border-border/50 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:bg-muted transition-all">Cancel</button>
                <button type="submit" disabled={savingApplicant} className="flex-1 py-3 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60 active:scale-95">
                  {savingApplicant ? 'Adding…' : 'Add Applicant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Applicant Detail */}
      {viewApplicant && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewApplicant(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <button onClick={() => setViewApplicant(null)} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
              <X size={16} />
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-foreground">{viewApplicant.name}</h3>
              <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border tracking-widest ${STAGE_COLORS[viewApplicant.stage]?.bg} ${STAGE_COLORS[viewApplicant.stage]?.border} ${STAGE_COLORS[viewApplicant.stage]?.text}`}>
                {viewApplicant.stage}
              </span>
            </div>
            {viewApplicant.rating > 0 && <RatingStars value={viewApplicant.rating} />}
            <div className="space-y-2">
              {viewApplicant.email && (
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-primary/60 shrink-0" />
                  <span className="text-[12px] text-foreground">{viewApplicant.email}</span>
                </div>
              )}
              {viewApplicant.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-primary/60 shrink-0" />
                  <span className="text-[12px] text-foreground">{viewApplicant.phone}</span>
                </div>
              )}
              {viewApplicant.notes && (
                <div className="mt-2 p-3 bg-muted/30 rounded-xl text-[11px] text-muted-foreground italic">
                  "{viewApplicant.notes}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Job Confirm */}
      {deleteJobTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteJobTarget(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center mx-auto">
              <AlertCircle size={28} className="text-destructive" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-foreground">Delete Job?</h3>
              <p className="text-sm text-muted-foreground"><strong>"{deleteJobTarget.title}"</strong> and all its applicants will be deleted permanently.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteJobTarget(null)} className="flex-1 py-3 rounded-xl border border-border/50 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:bg-muted transition-all">Cancel</button>
              <button onClick={handleDeleteJob} className="flex-1 py-3 rounded-xl bg-destructive text-white text-[11px] font-black uppercase tracking-widest hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruitmentPipeline;
