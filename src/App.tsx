import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { supabase, type LessonWithStudent, type Student } from '@/lib/supabase';

type View = 'schedule' | 'students' | 'statistics';
type Toast = { message: string; tone: 'success' | 'error' } | null;

type LessonForm = {
  studentId: string;
  date: string;
  time: string;
  duration: string;
  note: string;
  settled: boolean;
};

const colors = ['#ef8354', '#e7b94f', '#70b77e', '#5aa9e6', '#a78bfa', '#e26d8b', '#38b2ac', '#87909b'];
const ROW_HEIGHT = 28;
const START_HOUR = 7;
const END_HOUR = 24;
const MINUTES = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, index) => START_HOUR * 60 + index * 30);
const TIME_COL = 92;
const slotRange = (minute: number) => {
  const end = minute + 30;
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}-${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
};

const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const formatDate = (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`;
const formatWeekday = (date: Date) => ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
const formatCurrency = (value: number) => `¥${value.toFixed(2)}`;
const formatTime = (value: string) => new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

function App() {
  const [view, setView] = useState<View>('schedule');
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<LessonWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [scheduleStart, setScheduleStart] = useState(() => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const showToast = (message: string, tone: Toast['tone'] = 'success') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    const [studentsResult, lessonsResult] = await Promise.all([
      supabase.from('students').select('*').order('created_at', { ascending: true }),
      supabase.from('lessons').select('*, students(id, name, color, hourly_rate)').order('start_at', { ascending: true }),
    ]);
    if (studentsResult.error || lessonsResult.error) {
      showToast('数据加载失败，请检查网络后重试', 'error');
      setLoading(false);
      return;
    }
    setStudents(studentsResult.data as Student[]);
    setLessons(lessonsResult.data as LessonWithStudent[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const addStudent = async (name: string, hourlyRate: number, color: string) => {
    const { data, error } = await supabase.from('students').insert({ name, hourly_rate: hourlyRate, color }).select().maybeSingle();
    if (error || !data) { showToast('新增学生失败，请稍后重试', 'error'); return false; }
    setStudents((current) => [...current, data as Student]);
    showToast('学生已添加');
    return true;
  };

  const updateStudent = async (id: string, name: string, hourlyRate: number, color: string) => {
    const { data, error } = await supabase.from('students').update({ name, hourly_rate: hourlyRate, color }).eq('id', id).select().maybeSingle();
    if (error || !data) { showToast('保存学生信息失败', 'error'); return false; }
    setStudents((current) => current.map((s) => s.id === id ? data as Student : s));
    setLessons((current) => current.map((l) => l.student_id === id ? { ...l, students: { ...l.students, name, hourly_rate: hourlyRate, color } } : l));
    showToast('学生信息已更新');
    return true;
  };

  const deleteStudent = async (student: Student) => {
    if (!window.confirm(`确定要删除「${student.name}」及其全部课程记录吗？`)) return;
    const { error } = await supabase.from('students').delete().eq('id', student.id);
    if (error) { showToast('删除失败，请稍后重试', 'error'); return; }
    setStudents((current) => current.filter((s) => s.id !== student.id));
    setLessons((current) => current.filter((l) => l.student_id !== student.id));
    showToast('学生已删除');
  };

  const saveLesson = async (form: LessonForm, editingLesson?: LessonWithStudent) => {
    const startAt = `${form.date}T${form.time}:00`;
    const payload = { student_id: form.studentId, start_at: startAt, duration_minutes: Number(form.duration), note: form.note.trim(), settled: form.settled };
    if (editingLesson) {
      const { data, error } = await supabase.from('lessons').update(payload).eq('id', editingLesson.id).select('*, students(id, name, color, hourly_rate)').maybeSingle();
      if (error || !data) { showToast('保存课程失败', 'error'); return false; }
      setLessons((current) => current.map((l) => l.id === editingLesson.id ? data as LessonWithStudent : l));
    } else {
      const { data, error } = await supabase.from('lessons').insert(payload).select('*, students(id, name, color, hourly_rate)').maybeSingle();
      if (error || !data) { showToast('创建课程失败', 'error'); return false; }
      setLessons((current) => [...current, data as LessonWithStudent]);
    }
    showToast(editingLesson ? '课程已更新' : '课程已创建');
    return true;
  };

  const deleteLesson = async (lesson: LessonWithStudent) => {
    if (!window.confirm('确定删除这节课程吗？')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', lesson.id);
    if (error) { showToast('删除课程失败', 'error'); return; }
    setLessons((current) => current.filter((l) => l.id !== lesson.id));
    showToast('课程已删除');
  };

  const toggleLessonSettled = async (lesson: LessonWithStudent) => {
    const next = !lesson.settled;
    const { error } = await supabase.from('lessons').update({ settled: next }).eq('id', lesson.id);
    if (error) { showToast('更新结算状态失败', 'error'); return; }
    setLessons((current) => current.map((l) => l.id === lesson.id ? { ...l, settled: next } : l));
    showToast(next ? '已标记为已结算' : '已标记为未结算');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7f9] text-ink-950">
      <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-ink-100 bg-white transition-transform duration-200 lg:static lg:translate-x-0`}>
        <div className="flex h-[60px] items-center gap-2.5 border-b border-ink-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-950 text-white shadow-soft"><CalendarDays size={18} /></div>
          <div><div className="text-sm font-bold tracking-tight">排课管家</div><div className="text-[9px] font-medium tracking-[0.16em] text-ink-400">LESSON MANAGER</div></div>
        </div>
        <div className="flex-1 px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">工作台</p>
          <nav className="space-y-1">
            <SidebarItem icon={<LayoutDashboard size={17} />} label="排课总览" active={view === 'schedule'} onClick={() => { setView('schedule'); setIsSidebarOpen(false); }} />
            <SidebarItem icon={<Users size={17} />} label="学生管理" active={view === 'students'} onClick={() => { setView('students'); setIsSidebarOpen(false); }} />
            <SidebarItem icon={<BarChart3 size={17} />} label="课时统计" active={view === 'statistics'} onClick={() => { setView('statistics'); setIsSidebarOpen(false); }} />
          </nav>
          <p className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">快捷入口</p>
          <button onClick={() => { setView('students'); setIsSidebarOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-ink-600 transition hover:bg-ink-50"><Plus size={16} className="text-ink-400" />添加新学生</button>
        </div>
        <div className="border-t border-ink-100 p-4"><div className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-[10px] font-semibold text-white">讲</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">我的教室</div><div className="text-[10px] text-ink-400">在线教学空间</div></div><Settings2 size={14} className="text-ink-400" /></div></div>
      </aside>
      {isSidebarOpen && <button aria-label="关闭菜单" onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 z-30 bg-ink-950/20 lg:hidden" />}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <button aria-label="打开菜单" onClick={() => setIsSidebarOpen(true)} className="absolute left-2 top-2 z-30 rounded-lg bg-white/80 p-1.5 text-ink-600 shadow-soft backdrop-blur lg:hidden"><Menu size={18} /></button>
        <div className="flex flex-1 flex-col overflow-hidden p-3 lg:p-4">
          {loading ? <LoadingState /> : view === 'schedule' ? <ScheduleView lessons={lessons} students={students} scheduleStart={scheduleStart} setScheduleStart={setScheduleStart} onSaveLesson={saveLesson} onDeleteLesson={deleteLesson} /> : view === 'students' ? <StudentsView students={students} lessons={lessons} onAdd={addStudent} onUpdate={updateStudent} onDelete={deleteStudent} /> : <StatisticsView students={students} lessons={lessons} onToggleSettled={toggleLessonSettled} />}
        </div>
      </main>
      {toast && <div className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-pop animate-pop ${toast.tone === 'error' ? 'bg-red-600' : 'bg-ink-900'}`}>{toast.tone === 'success' ? <Check size={16} /> : <X size={16} />}{toast.message}</div>}
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition ${active ? 'bg-ink-950 text-white shadow-soft' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-950'}`}>{icon}<span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}</button>;
}

function LoadingState() {
  return <div className="flex h-full items-center justify-center"><div className="flex items-center gap-3 text-sm text-ink-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-ink-800" />正在加载你的课表...</div></div>;
}

function ScheduleView({ lessons, students, scheduleStart, setScheduleStart, onSaveLesson, onDeleteLesson }: { lessons: LessonWithStudent[]; students: Student[]; scheduleStart: Date; setScheduleStart: (date: Date) => void; onSaveLesson: (form: LessonForm, editingLesson?: LessonWithStudent) => Promise<boolean>; onDeleteLesson: (lesson: LessonWithStudent) => Promise<void> }) {
  const [modal, setModal] = useState<{ date: string; time: string; lesson?: LessonWithStudent } | null>(null);
  const days = useMemo(() => Array.from({ length: 30 }, (_, index) => { const day = new Date(scheduleStart); day.setDate(scheduleStart.getDate() + index); return day; }), [scheduleStart]);
  const monthTitle = `${scheduleStart.getFullYear()}年${scheduleStart.getMonth() + 1}月`;
  const monthLessons = lessons.filter((lesson) => { const date = new Date(lesson.start_at); return date >= scheduleStart && date < new Date(scheduleStart.getFullYear(), scheduleStart.getMonth(), scheduleStart.getDate() + 30); });
  const previousRange = () => { const date = new Date(scheduleStart); date.setDate(date.getDate() - 30); setScheduleStart(date); };
  const nextRange = () => { const date = new Date(scheduleStart); date.setDate(date.getDate() + 30); setScheduleStart(date); };
  const today = () => { const date = new Date(); date.setDate(1); setScheduleStart(date); };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={today} className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-600 shadow-soft transition hover:border-ink-300">今天</button>
          <div className="flex overflow-hidden rounded-lg border border-ink-200 bg-white shadow-soft">
            <button aria-label="上一段" onClick={previousRange} className="border-r border-ink-100 p-1.5 text-ink-500 hover:bg-ink-50"><ChevronLeft size={15} /></button>
            <button aria-label="下一段" onClick={nextRange} className="p-1.5 text-ink-500 hover:bg-ink-50"><ChevronRight size={15} /></button>
          </div>
          <span className="ml-1 text-sm font-bold tracking-tight">{monthTitle}</span>
          <span className="text-xs text-ink-400">· 未来30天 · {monthLessons.length}节</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ink-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />已结算</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />待结算</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-soft">
        <div className="scroll-thin h-full overflow-auto">
          <div className="min-w-[1280px]">
            <div className="grid" style={{ gridTemplateColumns: `${TIME_COL}px repeat(30, minmax(80px, 1fr))` }}>
              <div className="sticky left-0 z-30 border-b border-r border-ink-100 bg-ink-50" />
              {days.map((day, index) => (
                <div key={dateKey(day)} className={`border-b border-r border-ink-100 px-1 py-1.5 text-center ${index === 0 ? 'bg-amber-50/50' : 'bg-ink-50/30'}`}>
                  <div className="text-[9px] font-medium text-ink-400">周{formatWeekday(day)}</div>
                  <div className={`mt-0.5 text-xs font-bold ${index === 0 ? 'text-amber-700' : 'text-ink-700'}`}>{formatDate(day)}</div>
                </div>
              ))}
            </div>
            <div className="grid" style={{ gridTemplateColumns: `${TIME_COL}px repeat(30, minmax(80px, 1fr))` }}>
              {MINUTES.map((minute) => (
                <div key={minute} className="contents">
                  <div className="sticky left-0 z-20 flex items-center justify-center border-b border-r border-ink-100 bg-ink-50 text-[9px] font-medium text-ink-400" style={{ height: ROW_HEIGHT }}>
                    {slotRange(minute)}
                  </div>
                  {days.map((day) => {
                    const dayKey = dateKey(day);
                    const hour = Math.floor(minute / 60);
                    const time = `${pad(hour)}:${minute % 60 === 0 ? '00' : '30'}`;
                    const lesson = monthLessons.find((item) => dateKey(new Date(item.start_at)) === dayKey && new Date(item.start_at).getHours() * 60 + new Date(item.start_at).getMinutes() === minute);
                    return (
                      <div key={`${dayKey}-${time}`} onClick={() => !lesson && setModal({ date: dayKey, time })} className={`relative border-b border-r border-ink-100 transition ${lesson ? 'cursor-pointer' : 'cursor-pointer hover:bg-amber-50/40'}`} style={{ height: ROW_HEIGHT }}>
                        {lesson && <LessonBlock lesson={lesson} onClick={() => setModal({ date: dayKey, time, lesson })} />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex shrink-0 flex-wrap gap-1.5">
        <MiniMetric label="本月课程" value={`${monthLessons.length}节`} icon={<CalendarDays size={12} />} tone="blue" />
        <MiniMetric label="授课学生" value={`${new Set(monthLessons.map((l) => l.student_id)).size}位`} icon={<Users size={12} />} tone="amber" />
        <MiniMetric label="待结算" value={`${monthLessons.filter((l) => !l.settled).length}节`} icon={<CircleDollarSign size={12} />} tone="rose" />
        <MiniMetric label="预计课时费" value={formatCurrency(monthLessons.reduce((s, l) => s + l.students.hourly_rate * l.duration_minutes / 60, 0))} icon={<Sparkles size={12} />} tone="green" />
      </div>

      {modal && <LessonModal initialDate={modal.date} initialTime={modal.time} lesson={modal.lesson} students={students} onClose={() => setModal(null)} onSave={async (form) => { const ok = await onSaveLesson(form, modal.lesson); if (ok) setModal(null); }} onDelete={modal.lesson ? async () => { await onDeleteLesson(modal.lesson!); setModal(null); } : undefined} />}
    </div>
  );
}

function LessonBlock({ lesson, onClick }: { lesson: LessonWithStudent; onClick: () => void }) {
  const height = Math.max(18, lesson.duration_minutes / 30 * ROW_HEIGHT - 3);
  return (
    <button onClick={(event) => { event.stopPropagation(); onClick(); }} className="absolute inset-x-0.5 top-0.5 z-10 overflow-hidden rounded border-l-2 px-1 text-left shadow-soft transition hover:brightness-[0.97]" style={{ height, backgroundColor: `${lesson.students.color}1a`, borderLeftColor: lesson.students.color }}>
      <div className="flex items-center gap-0.5">
        <span className="truncate text-[10px] font-bold leading-tight" style={{ color: lesson.students.color }}>{lesson.students.name}</span>
        {lesson.settled ? <Check size={9} className="shrink-0 text-emerald-600" /> : <CircleDollarSign size={9} className="shrink-0 text-amber-600" />}
      </div>
      {height > 34 && <div className="mt-0.5 flex items-center gap-0.5 text-[8px] leading-tight text-ink-500"><Clock3 size={8} />{formatTime(lesson.start_at)}</div>}
      {height > 48 && lesson.note && <div className="mt-0.5 truncate text-[8px] leading-tight text-ink-400">{lesson.note}</div>}
    </button>
  );
}

function MiniMetric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: 'blue' | 'amber' | 'rose' | 'green' }) {
  const styles = { blue: 'text-blue-600', amber: 'text-amber-600', rose: 'text-rose-600', green: 'text-emerald-600' };
  return <div className="flex items-center gap-1.5 rounded-md border border-ink-100 bg-white px-2 py-1 shadow-soft"><span className={styles[tone]}>{icon}</span><span className="text-[10px] text-ink-400">{label}</span><span className="text-[11px] font-bold tracking-tight">{value}</span></div>;
}

function StudentsView({ students, lessons, onAdd, onUpdate, onDelete }: { students: Student[]; lessons: LessonWithStudent[]; onAdd: (name: string, rate: number, color: string) => Promise<boolean>; onUpdate: (id: string, name: string, rate: number, color: string) => Promise<boolean>; onDelete: (student: Student) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Student | null>(null);
  const [showForm, setShowForm] = useState(false);
  const visibleStudents = students.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white px-3 py-2 shadow-soft sm:w-[300px]"><Search size={16} className="text-ink-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索学生姓名..." className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" /></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-ink-800"><Plus size={16} />添加学生</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {students.length === 0 ? <EmptyState title="还没有学生档案" description="添加第一位学生，开始安排课程吧" action="添加学生" onAction={() => setShowForm(true)} /> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleStudents.map((student) => {
              const studentLessons = lessons.filter((l) => l.student_id === student.id);
              const unsettled = studentLessons.filter((l) => !l.settled);
              return (
                <div key={student.id} className="group rounded-2xl border border-ink-100 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: student.color }}>{student.name.slice(0, 1)}</div>
                      <div><h3 className="text-sm font-bold">{student.name}</h3><p className="mt-0.5 text-[11px] text-ink-400">每小时 {formatCurrency(Number(student.hourly_rate))}</p></div>
                    </div>
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button aria-label="编辑" onClick={() => { setEditing(student); setShowForm(true); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"><FileText size={14} /></button>
                      <button aria-label="删除" onClick={() => onDelete(student)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"><X size={14} /></button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 divide-x divide-ink-100 rounded-xl bg-ink-50">
                    <div className="px-3 py-2.5"><div className="text-[10px] text-ink-400">累计课程</div><div className="mt-1 text-sm font-bold">{studentLessons.length}<span className="ml-1 text-[10px] font-normal text-ink-400">节</span></div></div>
                    <div className="px-3 py-2.5"><div className="text-[10px] text-ink-400">待结算</div><div className="mt-1 text-sm font-bold text-amber-600">{formatCurrency(unsettled.reduce((s, l) => s + Number(student.hourly_rate) * l.duration_minutes / 60, 0))}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showForm && <StudentModal student={editing} onClose={() => setShowForm(false)} onSave={async (name, rate, color) => { const ok = editing ? await onUpdate(editing.id, name, rate, color) : await onAdd(name, rate, color); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function StatisticsView({ students, lessons, onToggleSettled }: { students: Student[]; lessons: LessonWithStudent[]; onToggleSettled: (lesson: LessonWithStudent) => Promise<void> }) {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
  const [to, setTo] = useState(dateKey(now));
  const [studentFilter, setStudentFilter] = useState('all');
  const filteredLessons = lessons.filter((l) => { const d = dateKey(new Date(l.start_at)); return d >= from && d <= to && (studentFilter === 'all' || l.student_id === studentFilter); });
  const totalAmount = filteredLessons.reduce((s, l) => s + Number(l.students.hourly_rate) * l.duration_minutes / 60, 0);
  const settledAmount = filteredLessons.filter((l) => l.settled).reduce((s, l) => s + Number(l.students.hourly_rate) * l.duration_minutes / 60, 0);
  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade">
      <div className="mb-4 shrink-0 rounded-xl border border-ink-100 bg-white p-3 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1"><label className="mb-1.5 block text-[11px] font-semibold text-ink-500">日期范围</label><div className="flex items-center gap-2"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-xs outline-none focus:border-ink-500" /><span className="text-xs text-ink-400">至</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-xs outline-none focus:border-ink-500" /></div></div>
          <div className="lg:w-52"><label className="mb-1.5 block text-[11px] font-semibold text-ink-500">学生筛选</label><select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs outline-none focus:border-ink-500"><option value="all">全部学生</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
      </div>
      <div className="mb-4 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="总课程数" value={`${filteredLessons.length} 节`} icon={<CalendarDays size={15} />} tone="blue" />
        <MetricCard label="总课时" value={`${(filteredLessons.reduce((s, l) => s + l.duration_minutes, 0) / 60).toFixed(1)} 小时`} icon={<Clock3 size={15} />} tone="amber" />
        <MetricCard label="应收课时费" value={formatCurrency(totalAmount)} icon={<CircleDollarSign size={15} />} tone="green" />
        <MetricCard label="已结算" value={formatCurrency(settledAmount)} icon={<Check size={15} />} tone="rose" />
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-soft">
        <div className="border-b border-ink-100 px-4 py-2.5 text-[11px] text-ink-400">点击状态可切换结算</div>
        {filteredLessons.length === 0 ? <EmptyState title="这个时间段还没有课程" description="调整筛选范围，或去排课总览添加课程" /> : (
          <div className="scroll-thin h-full overflow-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="sticky top-0 bg-ink-50/95 text-[10px] font-semibold uppercase tracking-wider text-ink-400 backdrop-blur">
                <tr><th className="px-4 py-2.5">上课日期</th><th className="px-4 py-2.5">学生</th><th className="px-4 py-2.5">时长</th><th className="px-4 py-2.5">课时费</th><th className="px-4 py-2.5">备注</th><th className="px-4 py-2.5">结算</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {[...filteredLessons].sort((a, b) => b.start_at.localeCompare(a.start_at)).map((lesson) => (
                  <tr key={lesson.id} className="text-xs transition hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-700">{new Date(lesson.start_at).toLocaleDateString('zh-CN')}<span className="ml-2 text-ink-400">{formatTime(lesson.start_at)}</span></td>
                    <td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: lesson.students.color }} />{lesson.students.name}</span></td>
                    <td className="px-4 py-3 text-ink-500">{lesson.duration_minutes}分钟</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(lesson.students.hourly_rate) * lesson.duration_minutes / 60)}</td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-ink-400">{lesson.note || '—'}</td>
                    <td className="px-4 py-3"><button onClick={() => onToggleSettled(lesson)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${lesson.settled ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>{lesson.settled ? <Check size={12} /> : <CircleDollarSign size={12} />}{lesson.settled ? '已结算' : '未结算'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentModal({ student, onClose, onSave }: { student: Student | null; onClose: () => void; onSave: (name: string, rate: number, color: string) => Promise<void> }) {
  const [name, setName] = useState(student?.name ?? '');
  const [rate, setRate] = useState(String(student?.hourly_rate ?? ''));
  const [color, setColor] = useState(student?.color ?? colors[0]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!name.trim() || !rate) return; await onSave(name.trim(), Number(rate), color); };
  return <Modal title={student ? '编辑学生信息' : '添加新学生'} onClose={onClose}><form onSubmit={submit} className="space-y-4"><FormField label="学生姓名"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：林小满" className="form-input" /></FormField><FormField label="课时费（元 / 小时）"><input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="例如：200" className="form-input" /></FormField><FormField label="日历显示颜色"><div className="flex flex-wrap gap-2">{colors.map((item) => <button type="button" key={item} onClick={() => setColor(item)} className={`h-8 w-8 rounded-full transition ${color === item ? 'ring-2 ring-ink-950 ring-offset-2' : 'hover:scale-110'}`} style={{ backgroundColor: item }} aria-label={`选择颜色 ${item}`} />)}</div></FormField><ModalActions onClose={onClose} submitLabel={student ? '保存修改' : '添加学生'} /></form></Modal>;
}

function LessonModal({ initialDate, initialTime, lesson, students, onClose, onSave, onDelete }: { initialDate: string; initialTime: string; lesson?: LessonWithStudent; students: Student[]; onClose: () => void; onSave: (form: LessonForm) => Promise<void>; onDelete?: () => Promise<void> }) {
  const original = lesson ? new Date(lesson.start_at) : null;
  const [studentId, setStudentId] = useState(lesson?.student_id ?? students[0]?.id ?? '');
  const [date, setDate] = useState(lesson && original ? dateKey(original) : initialDate);
  const [time, setTime] = useState(lesson && original ? `${pad(original.getHours())}:${pad(original.getMinutes())}` : initialTime);
  const [duration, setDuration] = useState(String(lesson?.duration_minutes ?? 60));
  const [note, setNote] = useState(lesson?.note ?? '');
  const [settled, setSettled] = useState(lesson?.settled ?? false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!studentId) return; await onSave({ studentId, date, time, duration, note, settled }); };
  return <Modal title={lesson ? '编辑课程' : '安排新课程'} onClose={onClose}><form onSubmit={submit} className="space-y-4"><FormField label="选择学生"><select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="form-input"><option value="" disabled>请选择学生</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatCurrency(Number(s.hourly_rate))}/小时</option>)}</select></FormField><div className="grid grid-cols-2 gap-3"><FormField label="课程日期"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" /></FormField><FormField label="开始时间"><select value={time} onChange={(e) => setTime(e.target.value)} className="form-input">{MINUTES.map((m) => <option key={m} value={`${pad(Math.floor(m / 60))}:${pad(m % 60)}`}>{pad(Math.floor(m / 60))}:{pad(m % 60)}</option>)}</select></FormField></div><FormField label="课程时长"><div className="grid grid-cols-4 gap-2">{['30', '60', '90', '120'].map((item) => <button type="button" key={item} onClick={() => setDuration(item)} className={`rounded-lg border py-2 text-xs font-semibold transition ${duration === item ? 'border-ink-950 bg-ink-950 text-white' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{item} 分钟</button>)}</div></FormField><FormField label="备注信息"><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：重点复习第三章" rows={3} className="form-input resize-none" /></FormField><button type="button" onClick={() => setSettled(!settled)} className="flex w-full items-center justify-between rounded-xl border border-ink-100 bg-ink-50 px-3 py-3 text-left"><span><span className="block text-xs font-semibold">课时费结算状态</span><span className="mt-1 block text-[10px] text-ink-400">可在统计页面随时修改</span></span><span className={`relative h-6 w-11 rounded-full transition ${settled ? 'bg-emerald-500' : 'bg-ink-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${settled ? 'left-6' : 'left-1'}`} /></span></button><ModalActions onClose={onClose} submitLabel={lesson ? '保存修改' : '创建课程'} onDelete={onDelete} /></form></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/30 p-4 backdrop-blur-[2px] animate-fade"><div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-pop animate-pop"><div className="mb-5 flex items-center justify-between"><h3 className="text-base font-bold">{title}</h3><button onClick={onClose} aria-label="关闭" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-800"><X size={18} /></button></div>{children}</div></div>; }
function FormField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-[11px] font-semibold text-ink-600">{label}</span>{children}</label>; }
function ModalActions({ onClose, submitLabel, onDelete }: { onClose: () => void; submitLabel: string; onDelete?: () => Promise<void> }) { return <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-5"><div>{onDelete && <button type="button" onClick={onDelete} className="text-xs font-semibold text-red-600 hover:text-red-700">删除课程</button>}</div><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-ink-200 px-4 py-2.5 text-xs font-semibold text-ink-600 hover:bg-ink-50">取消</button><button type="submit" className="rounded-lg bg-ink-950 px-4 py-2.5 text-xs font-semibold text-white shadow-soft hover:bg-ink-800">{submitLabel}</button></div></div>; }
function EmptyState({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) { return <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-50 text-ink-400"><FileText size={21} /></div><h3 className="text-sm font-bold">{title}</h3><p className="mt-2 text-xs text-ink-400">{description}</p>{action && onAction && <button onClick={onAction} className="mt-5 rounded-lg bg-ink-950 px-4 py-2 text-xs font-semibold text-white">{action}</button>}</div>; }

export default App;
