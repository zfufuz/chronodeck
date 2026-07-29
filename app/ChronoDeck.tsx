"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Category = "focus" | "meeting" | "life" | "deadline";
type ViewMode = "day" | "week" | "month";
type EventStatus = "active" | "done";

type TimeEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  start: string;
  end: string;
  category: Category;
  priority: "low" | "medium" | "high";
  flexible: boolean;
  progress: number;
  status: EventStatus;
  recurrence: "none" | "daily" | "weekly";
  nextAction?: string;
  createdAt: number;
  updatedAt: number;
};

const CATEGORIES: Record<Category, { label: string; short: string }> = {
  focus: { label: "深度工作", short: "专注" },
  meeting: { label: "会议沟通", short: "会议" },
  life: { label: "生活休息", short: "生活" },
  deadline: { label: "关键截止", short: "截止" },
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const HOURS = Array.from({ length: 15 }, (_, index) => index + 8);
const STORAGE_KEY = "chronodeck:events:v1";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(key: string, days: number) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function toTime(value: number) {
  const safe = Math.max(0, Math.min(1439, value));
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
}

function duration(event: TimeEvent) {
  return Math.max(0, minutes(event.end) - minutes(event.start));
}

function formatDuration(value: number) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (!hours) return `${mins} 分钟`;
  return mins ? `${hours} 小时 ${mins} 分` : `${hours} 小时`;
}

function monthTitle(key: string) {
  const date = fromDateKey(key);
  return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
}

function longDate(key: string) {
  const date = fromDateKey(key);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  return `${date.getMonth() + 1}月${date.getDate()}日 · 周${weekday}`;
}

function weekStart(key: string) {
  const date = fromDateKey(key);
  const delta = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

function monthCells(key: string) {
  const current = fromDateKey(key);
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  first.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(date.getDate() + index);
    return toDateKey(date);
  });
}

function createSeedEvents(today: string): TimeEvent[] {
  const now = Date.now();
  return [
    {
      id: "seed-brief",
      title: "产品晨间校准",
      description: "确认今天的关键结果与风险。",
      date: today,
      start: "09:00",
      end: "09:35",
      category: "meeting",
      priority: "medium",
      flexible: false,
      progress: 100,
      status: "done",
      recurrence: "daily",
      nextAction: "同步三项关键决策",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-focus",
      title: "时序舱交互原型",
      description: "完成时间预算与智能重排的关键流程。",
      date: today,
      start: "10:10",
      end: "12:10",
      category: "focus",
      priority: "high",
      flexible: true,
      progress: 62,
      status: "active",
      recurrence: "none",
      nextAction: "完成冲突提示的三种状态",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-lunch",
      title: "午餐与短途散步",
      description: "离开屏幕，恢复注意力。",
      date: today,
      start: "12:30",
      end: "13:20",
      category: "life",
      priority: "low",
      flexible: true,
      progress: 0,
      status: "active",
      recurrence: "daily",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-review",
      title: "设计评审",
      description: "演示核心路径并记录反馈。",
      date: today,
      start: "14:30",
      end: "15:30",
      category: "meeting",
      priority: "high",
      flexible: false,
      progress: 0,
      status: "active",
      recurrence: "none",
      nextAction: "整理评审问题清单",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-deadline",
      title: "提交演示版本",
      description: "完成最终检查并发布。",
      date: today,
      start: "17:20",
      end: "18:10",
      category: "deadline",
      priority: "high",
      flexible: false,
      progress: 20,
      status: "active",
      recurrence: "none",
      nextAction: "检查公开链接",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-tomorrow",
      title: "复盘与下轮规划",
      description: "整理今天的行动记录。",
      date: addDays(today, 1),
      start: "10:00",
      end: "11:20",
      category: "focus",
      priority: "medium",
      flexible: true,
      progress: 0,
      status: "active",
      recurrence: "weekly",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function emptyDraft(date: string, start = "09:00"): Omit<TimeEvent, "id" | "createdAt" | "updatedAt"> {
  return {
    title: "",
    description: "",
    date,
    start,
    end: toTime(minutes(start) + 60),
    category: "focus",
    priority: "medium",
    flexible: true,
    progress: 0,
    status: "active",
    recurrence: "none",
    nextAction: "",
  };
}

function parseQuickInput(input: string, selectedDate: string) {
  const text = input.trim();
  let date = selectedDate;
  if (/明天/.test(text)) date = addDays(toDateKey(new Date()), 1);
  if (/今天/.test(text)) date = toDateKey(new Date());
  if (/后天/.test(text)) date = addDays(toDateKey(new Date()), 2);
  const dateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (dateMatch) {
    const base = new Date();
    date = `${base.getFullYear()}-${pad(Number(dateMatch[1]))}-${pad(Number(dateMatch[2]))}`;
  }

  const timeMatch = text.match(/(上午|下午|晚上|中午)?\s*(\d{1,2})(?:[:：点时](\d{1,2})?)?/);
  let hour = timeMatch ? Number(timeMatch[2]) : 9;
  const minute = timeMatch?.[3] ? Number(timeMatch[3]) : 0;
  if (timeMatch?.[1] && /下午|晚上/.test(timeMatch[1]) && hour < 12) hour += 12;
  if (timeMatch?.[1] === "中午" && hour < 11) hour += 12;
  const start = `${pad(hour)}:${pad(minute)}`;
  const durationMatch = text.match(/(\d+(?:\.\d+)?)\s*(小时|分钟)/);
  const length = durationMatch
    ? durationMatch[2] === "小时"
      ? Number(durationMatch[1]) * 60
      : Number(durationMatch[1])
    : 60;
  const cleaned = text
    .replace(/今天|明天|后天/g, "")
    .replace(/\d{1,2}月\d{1,2}[日号]?/g, "")
    .replace(/(上午|下午|晚上|中午)?\s*\d{1,2}(?:[:：点时]\d{0,2})?/g, "")
    .replace(/\d+(?:\.\d+)?\s*(小时|分钟)/g, "")
    .replace(/安排|创建|提醒我|日程/g, "")
    .trim();
  return { date, start, end: toTime(minutes(start) + length), title: cleaned || "新日程" };
}

function overlaps(a: TimeEvent, b: Pick<TimeEvent, "date" | "start" | "end" | "id">) {
  return a.id !== b.id && a.date === b.date && minutes(a.start) < minutes(b.end) && minutes(a.end) > minutes(b.start);
}

function findSlot(events: TimeEvent[], date: string, length: number, ignoreId = "") {
  const daily = events
    .filter((event) => event.date === date && event.id !== ignoreId && event.status === "active")
    .sort((a, b) => minutes(a.start) - minutes(b.start));
  let cursor = 8 * 60;
  for (const event of daily) {
    if (minutes(event.start) - cursor >= length) return toTime(cursor);
    cursor = Math.max(cursor, minutes(event.end));
  }
  return 22 * 60 - cursor >= length ? toTime(cursor) : null;
}

export default function ChronoDeck() {
  const today = useMemo(() => toDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<ViewMode>("day");
  const [events, setEvents] = useState<TimeEvent[]>(() => createSeedEvents(today));
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [quickInput, setQuickInput] = useState("");
  const [editing, setEditing] = useState<TimeEvent | null>(null);
  const [draft, setDraft] = useState(() => emptyDraft(today));
  const [showEditor, setShowEditor] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [focusEvent, setFocusEvent] = useState<TimeEvent | null>(null);
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [light, setLight] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setEvents(JSON.parse(saved));
    } catch {
      setToast("本地数据读取失败，已载入演示日程");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!running || !focusEvent) return;
    const timer = window.setInterval(() => {
      setFocusSeconds((value) => {
        if (value <= 1) {
          setRunning(false);
          setToast("专注完成，做得很好");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, focusEvent]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        quickRef.current?.focus();
      }
      if (event.key === "Escape") {
        setShowEditor(false);
        setFocusEvent(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleEvents = useMemo(
    () =>
      events.filter((event) => {
        const matchesFilter = filter === "all" || event.category === filter;
        const text = `${event.title} ${event.description} ${event.nextAction || ""}`.toLowerCase();
        return matchesFilter && text.includes(query.toLowerCase());
      }),
    [events, filter, query],
  );

  const dayEvents = useMemo(
    () => visibleEvents.filter((event) => event.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start)),
    [visibleEvents, selectedDate],
  );
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart(selectedDate), index)), [selectedDate]);
  const cells = useMemo(() => monthCells(selectedDate), [selectedDate]);
  const activeMinutes = dayEvents.filter((event) => event.status === "active").reduce((sum, event) => sum + duration(event), 0);
  const capacity = 9 * 60;
  const load = Math.min(140, Math.round((activeMinutes / capacity) * 100));
  const categoryTotals = (Object.keys(CATEGORIES) as Category[]).map((category) => ({
    category,
    value: dayEvents.filter((event) => event.category === category && event.status === "active").reduce((sum, event) => sum + duration(event), 0),
  }));
  const nextEvent = dayEvents.find((event) => event.status === "active");
  const staleCount = events.filter((event) => event.status === "active" && Date.now() - event.updatedAt > 2 * 86_400_000).length;

  function announce(message: string) {
    setToast(message);
  }

  function openNew(date = selectedDate, start = "09:00") {
    setEditing(null);
    setDraft(emptyDraft(date, start));
    setSuggestion(null);
    setShowEditor(true);
  }

  function openEdit(event: TimeEvent) {
    setEditing(event);
    setDraft({ ...event });
    setSuggestion(null);
    setShowEditor(true);
  }

  function saveDraft(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    if (minutes(draft.end) <= minutes(draft.start)) {
      announce("结束时间需要晚于开始时间");
      return;
    }
    const candidate: TimeEvent = {
      ...draft,
      id: editing?.id || `event-${Date.now()}`,
      title: draft.title.trim(),
      description: draft.description.trim(),
      createdAt: editing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    const conflict = events.some((item) => overlaps(item, candidate));
    if (conflict && !suggestion) {
      const slot = findSlot(events, candidate.date, duration(candidate), candidate.id);
      setSuggestion(slot);
      announce(slot ? `发现冲突，可调整至 ${slot}` : "当天已无足够空档");
      return;
    }
    setEvents((current) => editing ? current.map((item) => (item.id === editing.id ? candidate : item)) : [...current, candidate]);
    setShowEditor(false);
    announce(editing ? "日程已更新" : "日程已进入时间轨道");
  }

  function applySuggestion() {
    if (!suggestion) return;
    const length = minutes(draft.end) - minutes(draft.start);
    setDraft((current) => ({ ...current, start: suggestion, end: toTime(minutes(suggestion) + length) }));
    setSuggestion(null);
  }

  function quickCreate(event: FormEvent) {
    event.preventDefault();
    if (!quickInput.trim()) return;
    const parsed = parseQuickInput(quickInput, selectedDate);
    setDraft({ ...emptyDraft(parsed.date, parsed.start), ...parsed });
    setEditing(null);
    setQuickInput("");
    setSuggestion(null);
    setShowEditor(true);
  }

  function toggleDone(event: TimeEvent) {
    setEvents((current) =>
      current.map((item) =>
        item.id === event.id
          ? { ...item, status: item.status === "done" ? "active" : "done", progress: item.status === "done" ? item.progress : 100, updatedAt: Date.now() }
          : item,
      ),
    );
    announce(event.status === "done" ? "已重新加入计划" : "已完成，时间被好好使用");
  }

  function removeEvent(id: string) {
    setEvents((current) => current.filter((item) => item.id !== id));
    setShowEditor(false);
    announce("日程已删除");
  }

  function moveDate(delta: number) {
    if (view === "month") {
      const date = fromDateKey(selectedDate);
      date.setMonth(date.getMonth() + delta);
      setSelectedDate(toDateKey(date));
    } else {
      setSelectedDate(addDays(selectedDate, delta * (view === "week" ? 7 : 1)));
    }
  }

  function smartReplan() {
    const movable = dayEvents.find((event) => event.flexible && event.status === "active");
    if (!movable) {
      announce("今天没有可自动调整的日程");
      return;
    }
    const slot = findSlot(events, movable.date, duration(movable), movable.id);
    if (!slot || slot === movable.start) {
      announce("当前节奏已经是较优安排");
      return;
    }
    setEvents((current) =>
      current.map((event) =>
        event.id === movable.id
          ? { ...event, start: slot, end: toTime(minutes(slot) + duration(event)), updatedAt: Date.now() }
          : event,
      ),
    );
    announce(`已将“${movable.title}”调整至 ${slot}`);
  }

  function startFocus(event: TimeEvent) {
    setFocusEvent(event);
    setFocusSeconds(25 * 60);
    setRunning(false);
  }

  const renderEventCard = (event: TimeEvent, compact = false) => (
    <button
      key={event.id}
      className={`event-card ${event.category} ${event.status} ${compact ? "compact" : ""}`}
      onClick={() => openEdit(event)}
      style={!compact ? {
        top: `${((minutes(event.start) - 8 * 60) / 60) * 72}px`,
        height: `${Math.max(48, (duration(event) / 60) * 72 - 6)}px`,
      } : undefined}
    >
      <span className="event-time">{event.start}–{event.end}</span>
      <strong>{event.title}</strong>
      {!compact && <small>{CATEGORIES[event.category].label} · {event.progress}%</small>}
      {event.priority === "high" && <i>重要</i>}
    </button>
  );

  return (
    <main className={light ? "app-shell light" : "app-shell"}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><i /><i /><i /></span>
          <div><strong>时序舱</strong><small>CHRONODECK</small></div>
        </div>
        <form className="quick-create" onSubmit={quickCreate}>
          <span>＋</span>
          <input ref={quickRef} value={quickInput} onChange={(e) => setQuickInput(e.target.value)} placeholder="说一句话安排时间，例如：明天下午3点设计评审 1小时" aria-label="快速创建日程" />
          <kbd>⌘ K</kbd>
          <button type="submit">解析</button>
        </form>
        <div className="top-actions">
          <button className="icon-button" onClick={() => setLight((value) => !value)} aria-label="切换主题">{light ? "☾" : "☼"}</button>
          <button className="avatar" aria-label="个人中心">Y</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar panel">
          <div className="month-nav">
            <button onClick={() => moveDate(-1)} aria-label="上个月">‹</button>
            <strong>{monthTitle(selectedDate)}</strong>
            <button onClick={() => moveDate(1)} aria-label="下个月">›</button>
          </div>
          <div className="mini-week">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="mini-calendar">
            {cells.map((key) => {
              const dayLoad = events.filter((event) => event.date === key).reduce((sum, event) => sum + duration(event), 0);
              const outside = fromDateKey(key).getMonth() !== fromDateKey(selectedDate).getMonth();
              return (
                <button key={key} className={`${key === selectedDate ? "selected" : ""} ${key === today ? "today" : ""} ${outside ? "outside" : ""}`} onClick={() => setSelectedDate(key)}>
                  {fromDateKey(key).getDate()}
                  {dayLoad > 0 && <i style={{ opacity: Math.min(1, .28 + dayLoad / 480) }} />}
                </button>
              );
            })}
          </div>
          <button className="today-button" onClick={() => setSelectedDate(today)}>回到今天</button>

          <div className="side-section">
            <div className="section-label"><span>我的节奏</span><button onClick={() => setFilter("all")}>清除</button></div>
            {(Object.keys(CATEGORIES) as Category[]).map((category) => (
              <button key={category} className={`category-filter ${filter === category ? "active" : ""}`} onClick={() => setFilter(filter === category ? "all" : category)}>
                <i className={category} />
                <span>{CATEGORIES[category].label}</span>
                <em>{events.filter((event) => event.category === category && event.status === "active").length}</em>
              </button>
            ))}
          </div>

          <div className="side-section pulse-card">
            <span className="pulse-icon">⌁</span>
            <div><small>节奏洞察</small><strong>{load > 100 ? "负荷已超载" : load > 75 ? "今天略显紧凑" : "今天留有余量"}</strong></div>
            <p>{load > 100 ? "建议将一项灵活任务移动到明天。" : "下午的连续专注窗口最值得保护。"}</p>
          </div>
        </aside>

        <section className="main-stage">
          <div className="stage-header">
            <div>
              <span className="eyebrow">{selectedDate === today ? "TODAY · 当前航行日" : "SELECTED · 观察日"}</span>
              <h1>{longDate(selectedDate)}</h1>
              <p>{selectedDate === today ? "上午好，颜薪。" : "正在查看这一天的时间结构。"} 今天还有 <strong>{formatDuration(Math.max(0, capacity - activeMinutes))}</strong> 可自由安排。</p>
            </div>
            <div className="view-controls">
              <div className="segmented">
                {(["day", "week", "month"] as ViewMode[]).map((mode) => <button key={mode} className={view === mode ? "active" : ""} onClick={() => setView(mode)}>{mode === "day" ? "日" : mode === "week" ? "周" : "月"}</button>)}
              </div>
              <button className="secondary-button" onClick={smartReplan}>✦ 智能重排</button>
              <button className="primary-button" onClick={() => openNew()}>＋ 新建日程</button>
            </div>
          </div>

          <div className="search-row">
            <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索日程、行动或备注" /></label>
            {filter !== "all" && <button className={`active-filter ${filter}`} onClick={() => setFilter("all")}>{CATEGORIES[filter].label} ×</button>}
            <span className="sync-state"><i /> 已保存到本机</span>
          </div>

          {view === "day" && (
            <div className="timeline panel">
              <div className="time-axis">
                {HOURS.map((hour) => <div key={hour} className="hour-label" style={{ top: `${(hour - 8) * 72}px` }}>{pad(hour)}:00</div>)}
              </div>
              <div className="timeline-grid" onDoubleClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const raw = 8 * 60 + Math.round(((event.clientY - rect.top) / 72) * 60 / 15) * 15;
                openNew(selectedDate, toTime(raw));
              }}>
                {HOURS.map((hour) => <div key={hour} className="hour-line" style={{ top: `${(hour - 8) * 72}px` }} />)}
                {selectedDate === today && <div className="now-line" style={{ top: `${Math.max(0, Math.min(1008, ((new Date().getHours() * 60 + new Date().getMinutes() - 480) / 60) * 72))}px` }}><span>现在</span></div>}
                <div className="event-lane">{dayEvents.map((event) => renderEventCard(event))}</div>
                {dayEvents.length === 0 && <button className="empty-state" onClick={() => openNew()}><span>＋</span><strong>这一天还是一张白纸</strong><small>点击创建第一项安排，或双击时间轨道</small></button>}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="week-board panel">
              {weekDays.map((key) => (
                <div key={key} className={`week-column ${key === today ? "today" : ""}`} onClick={() => setSelectedDate(key)}>
                  <div className="week-heading"><span>周{WEEKDAYS[weekDays.indexOf(key)]}</span><strong>{fromDateKey(key).getDate()}</strong></div>
                  <div className="week-load"><i style={{ width: `${Math.min(100, events.filter((e) => e.date === key).reduce((sum, e) => sum + duration(e), 0) / 5.4)}%` }} /></div>
                  {visibleEvents.filter((event) => event.date === key).map((event) => renderEventCard(event, true))}
                  <button className="week-add" onClick={(event) => { event.stopPropagation(); openNew(key); }}>＋</button>
                </div>
              ))}
            </div>
          )}

          {view === "month" && (
            <div className="month-board panel">
              {WEEKDAYS.map((day) => <div className="month-weekday" key={day}>周{day}</div>)}
              {cells.map((key) => {
                const itemEvents = visibleEvents.filter((event) => event.date === key);
                const outside = fromDateKey(key).getMonth() !== fromDateKey(selectedDate).getMonth();
                return (
                  <button key={key} className={`month-cell ${outside ? "outside" : ""} ${key === today ? "today" : ""}`} onClick={() => { setSelectedDate(key); setView("day"); }}>
                    <span>{fromDateKey(key).getDate()}</span>
                    {itemEvents.slice(0, 3).map((event) => <i className={event.category} key={event.id}>{event.title}</i>)}
                    {itemEvents.length > 3 && <small>还有 {itemEvents.length - 3} 项</small>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="inspector">
          <section className="budget-card panel">
            <div className="card-heading"><div><span className="eyebrow">TIME BUDGET</span><h2>今日时间预算</h2></div><span className={`load-badge ${load > 100 ? "over" : ""}`}>{load}%</span></div>
            <div className="budget-visual">
              <div className="budget-ring" style={{ "--load": `${Math.min(100, load) * 3.6}deg` } as React.CSSProperties}>
                <div><strong>{formatDuration(activeMinutes)}</strong><small>已安排</small></div>
              </div>
              <div className="budget-stats">
                <div><small>剩余可用</small><strong>{formatDuration(Math.max(0, capacity - activeMinutes))}</strong></div>
                <div><small>日程数量</small><strong>{dayEvents.length} 项</strong></div>
                <div><small>停滞计划</small><strong>{staleCount} 项</strong></div>
              </div>
            </div>
            <div className="rhythm">
              <div className="section-label"><span>节奏指纹</span><small>{load > 100 ? "超载型" : categoryTotals[0].value > 180 ? "专注型" : "平衡型"}</small></div>
              <div className="rhythm-strip">
                {categoryTotals.filter((item) => item.value > 0).map((item) => <i key={item.category} className={item.category} style={{ flex: Math.max(1, item.value) }} />)}
                {activeMinutes < capacity && <i className="free" style={{ flex: capacity - activeMinutes }} />}
              </div>
              <div className="rhythm-legend">{categoryTotals.map((item) => <span key={item.category}><i className={item.category} />{CATEGORIES[item.category].short} {Math.round(item.value / 60 * 10) / 10}h</span>)}</div>
            </div>
          </section>

          <section className="next-card panel">
            <div className="card-heading"><div><span className="eyebrow">UP NEXT</span><h2>下一项安排</h2></div><span className="live-dot"><i /> LIVE</span></div>
            {nextEvent ? (
              <>
                <div className={`next-accent ${nextEvent.category}`} />
                <span className="next-time">{nextEvent.start} — {nextEvent.end}</span>
                <h3>{nextEvent.title}</h3>
                <p>{nextEvent.nextAction || nextEvent.description || "准备进入下一段时间。"}</p>
                <div className="progress-label"><span>当前进度</span><strong>{nextEvent.progress}%</strong></div>
                <div className="progress-bar"><i style={{ width: `${nextEvent.progress}%` }} /></div>
                <div className="next-actions">
                  <button onClick={() => startFocus(nextEvent)}>▶ 进入专注</button>
                  <button onClick={() => toggleDone(nextEvent)}>✓ 完成</button>
                </div>
              </>
            ) : <div className="all-clear"><span>✓</span><strong>今天已经清空</strong><small>现在可以安心休息。</small></div>}
          </section>

          <section className="insight-card">
            <span>✦</span>
            <div><strong>航行建议</strong><p>{load > 100 ? "时间预算已透支，优先移动可调整事项。" : "把最长的空档留给高认知任务，避免被会议切碎。"}</p></div>
          </section>
        </aside>
      </section>

      {showEditor && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowEditor(false)}>
          <form className="event-editor panel" onSubmit={saveDraft}>
            <div className="editor-heading">
              <div><span className="eyebrow">{editing ? "EDIT ORBIT" : "NEW ORBIT"}</span><h2>{editing ? "调整时间轨道" : "创建一段有价值的时间"}</h2></div>
              <button type="button" onClick={() => setShowEditor(false)}>×</button>
            </div>
            <label className="wide-field"><span>日程标题</span><input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="这段时间要完成什么？" /></label>
            <div className="editor-grid">
              <label><span>日期</span><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
              <label><span>开始</span><input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></label>
              <label><span>结束</span><input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></label>
            </div>
            <label className="wide-field"><span>说明</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="补充背景、目标或准备事项" /></label>
            <div className="category-picker">
              <span>时间类型</span>
              <div>{(Object.keys(CATEGORIES) as Category[]).map((category) => <button type="button" key={category} className={`${category} ${draft.category === category ? "active" : ""}`} onClick={() => setDraft({ ...draft, category })}><i />{CATEGORIES[category].label}</button>)}</div>
            </div>
            <div className="editor-grid">
              <label><span>优先级</span><select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as TimeEvent["priority"] })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
              <label><span>重复</span><select value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value as TimeEvent["recurrence"] })}><option value="none">不重复</option><option value="daily">每天</option><option value="weekly">每周</option></select></label>
              <label><span>完成度 {draft.progress}%</span><input type="range" min="0" max="100" step="5" value={draft.progress} onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })} /></label>
            </div>
            <label className="wide-field"><span>下一步最小行动</span><input value={draft.nextAction || ""} onChange={(e) => setDraft({ ...draft, nextAction: e.target.value })} placeholder="例如：先列出三个评审问题" /></label>
            <label className="flexible-toggle"><input type="checkbox" checked={draft.flexible} onChange={(e) => setDraft({ ...draft, flexible: e.target.checked })} /><i /><span><strong>允许智能重排</strong><small>发生冲突时，可以建议更合适的空档</small></span></label>
            {suggestion && <div className="conflict-box"><span>!</span><div><strong>检测到时间冲突</strong><small>系统发现 {suggestion} 有一段完整空档。</small></div><button type="button" onClick={applySuggestion}>采用建议</button></div>}
            <div className="editor-actions">
              {editing && <button type="button" className="delete-button" onClick={() => removeEvent(editing.id)}>删除日程</button>}
              <span />
              <button type="button" onClick={() => setShowEditor(false)}>取消</button>
              <button type="submit" className="primary-button">{editing ? "保存调整" : "进入时间轨道"}</button>
            </div>
          </form>
        </div>
      )}

      {focusEvent && (
        <div className="focus-overlay">
          <button className="focus-close" onClick={() => { setFocusEvent(null); setRunning(false); }}>退出专注 ×</button>
          <span className="focus-kicker">FOCUS ORBIT · {CATEGORIES[focusEvent.category].label}</span>
          <h2>{focusEvent.title}</h2>
          <div className="focus-timer">{pad(Math.floor(focusSeconds / 60))}<i>:</i>{pad(focusSeconds % 60)}</div>
          <p>{focusEvent.nextAction || "只处理当前这一件事。"}</p>
          <button className="focus-play" onClick={() => setRunning((value) => !value)}>{running ? "暂停" : focusSeconds === 0 ? "重新开始" : "开始专注"}</button>
          <button className="focus-done" onClick={() => { toggleDone(focusEvent); setFocusEvent(null); setRunning(false); }}>✓ 标记完成</button>
        </div>
      )}

      {toast && <div className="toast" role="status"><span>✦</span>{toast}</div>}
    </main>
  );
}
