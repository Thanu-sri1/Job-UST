import React, { useEffect, useMemo, useState } from 'react';
import {
  analyticsAPI,
  commentAPI,
  fileAPI,
  notificationAPI,
  reminderAPI,
  searchAPI,
} from '../api/axios';

const TABS = ['Search', 'Notifications', 'Analytics', 'Comments', 'Files', 'Reminders'];

function EmptyState({ children }) {
  return <div className="text-sm text-gray-500 py-6 text-center">{children}</div>;
}

function Panel({ title, children, action }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ServiceWorkspace({ tasks, user }) {
  const [active, setActive] = useState('Search');
  const [selectedTaskId, setSelectedTaskId] = useState('');

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) setSelectedTaskId(tasks[0]._id);
  }, [selectedTaskId, tasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task._id === selectedTaskId),
    [selectedTaskId, tasks]
  );

  return (
    <div className="mt-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Service workspace</h2>
          <p className="text-sm text-gray-500">Use the new microservices from the dashboard.</p>
        </div>
        <select className="input lg:max-w-sm" value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
          {tasks.length === 0 ? (
            <option value="">Create a task to use task-scoped services</option>
          ) : (
            tasks.map((task) => (
              <option key={task._id} value={task._id}>
                {task.title}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
              active === tab
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === 'Search' && <SearchPanel />}
      {active === 'Notifications' && <NotificationsPanel />}
      {active === 'Analytics' && <AnalyticsPanel user={user} />}
      {active === 'Comments' && <CommentsPanel task={selectedTask} />}
      {active === 'Files' && <FilesPanel task={selectedTask} />}
      {active === 'Reminders' && <RemindersPanel task={selectedTask} />}
    </div>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await searchAPI.tasks({ q: query, status: status || undefined });
      setResults(res.data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel title="Task search">
      <form onSubmit={runSearch} className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, description, or tags" />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <button className="btn-primary" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
      </form>
      <div className="mt-4 divide-y divide-gray-100">
        {results.length === 0 ? (
          <EmptyState>No indexed results yet. Create or update a task, then search again.</EmptyState>
        ) : (
          results.map((item) => (
            <div key={item.taskId || item.id} className="py-3">
              <div className="font-medium text-gray-900">{item.title}</div>
              <div className="text-sm text-gray-500">{item.description || 'No description'}</div>
              <div className="text-xs text-gray-400 mt-1">{item.status} - {item.priority}</div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function NotificationsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll();
      setItems(res.data.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await notificationAPI.markRead(id);
    load();
  };

  return (
    <Panel title="Notifications" action={<button className="btn-secondary text-sm py-1.5" onClick={load}>Refresh</button>}>
      {loading ? <EmptyState>Loading notifications...</EmptyState> : items.length === 0 ? (
        <EmptyState>No notifications yet.</EmptyState>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item._id} className="py-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">{item.title}</div>
                <div className="text-sm text-gray-500">{item.message}</div>
                <div className="text-xs text-gray-400 mt-1">{item.type} - {item.channel}</div>
              </div>
              {!item.read && <button className="btn-secondary text-xs py-1" onClick={() => markRead(item._id)}>Read</button>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AnalyticsPanel({ user }) {
  const [summary, setSummary] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [adminOverview, setAdminOverview] = useState(null);

  useEffect(() => {
    analyticsAPI.getSummary().then((res) => setSummary(res.data.summary)).catch(() => {});
    analyticsAPI.getCompleted('week').then((res) => setCompleted(res.data.metrics || [])).catch(() => {});
    if (user?.role === 'admin') {
      analyticsAPI.getAdminOverview().then((res) => setAdminOverview(res.data.overview)).catch(() => {});
    }
  }, [user?.role]);

  const cards = [
    ['Created', summary?.tasksCreated || 0],
    ['Updated', summary?.tasksUpdated || 0],
    ['Completed', summary?.tasksCompleted || 0],
    ['Comments', summary?.commentsCreated || 0],
    ['Files', summary?.filesAttached || 0],
  ];

  return (
    <Panel title="Analytics">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(([label, value]) => (
          <div key={label} className="border border-gray-200 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Completed this week</h3>
        {completed.length === 0 ? <EmptyState>No analytics events yet.</EmptyState> : (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
            {completed.map((day) => (
              <div key={day.date} className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{day.date.slice(5)}</div>
                <div className="font-semibold">{day.tasksCompleted}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {adminOverview && (
        <div className="mt-4 text-sm text-gray-600">
          Admin overview: {adminOverview.tasksCreated || 0} created, {adminOverview.tasksCompleted || 0} completed in 30 days.
        </div>
      )}
    </Panel>
  );
}

function CommentsPanel({ task }) {
  const [body, setBody] = useState('');
  const [comments, setComments] = useState([]);

  const load = async () => {
    if (!task?._id) return;
    const res = await commentAPI.getByTask(task._id);
    setComments(res.data.comments || []);
  };

  useEffect(() => { load().catch(() => setComments([])); }, [task?._id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!task?._id || !body.trim()) return;
    await commentAPI.create(task._id, { body });
    setBody('');
    load();
  };

  if (!task) return <Panel title="Comments"><EmptyState>Select or create a task first.</EmptyState></Panel>;

  return (
    <Panel title={`Comments for ${task.title}`}>
      <form onSubmit={submit} className="flex gap-3">
        <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment" />
        <button className="btn-primary">Post</button>
      </form>
      <div className="mt-4 divide-y divide-gray-100">
        {comments.length === 0 ? <EmptyState>No comments yet.</EmptyState> : comments.map((comment) => (
          <div key={comment._id} className="py-3">
            <div className="text-sm font-medium text-gray-900">{comment.authorName}</div>
            <div className="text-sm text-gray-600">{comment.body}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FilesPanel({ task }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!task?._id) return;
    const res = await fileAPI.getByTask(task._id);
    setFiles(res.data.attachments || []);
  };

  useEffect(() => { load().catch(() => setFiles([])); }, [task?._id]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !task?._id) return;
    setUploading(true);
    try {
      await fileAPI.upload(task._id, file);
      await load();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const download = async (file) => {
    const res = await fileAPI.download(file._id);
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!task) return <Panel title="Files"><EmptyState>Select or create a task first.</EmptyState></Panel>;

  return (
    <Panel title={`Files for ${task.title}`} action={<label className="btn-primary text-sm cursor-pointer">{uploading ? 'Uploading...' : 'Upload'}<input type="file" className="hidden" onChange={upload} disabled={uploading} /></label>}>
      {files.length === 0 ? <EmptyState>No files attached.</EmptyState> : (
        <div className="divide-y divide-gray-100">
          {files.map((file) => (
            <div key={file._id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">{file.filename}</div>
                <div className="text-xs text-gray-500">{Math.ceil(file.size / 1024)} KB - {file.mimeType}</div>
              </div>
              <button className="btn-secondary text-sm py-1.5" onClick={() => download(file)}>Download</button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RemindersPanel({ task }) {
  const [reminders, setReminders] = useState([]);
  const [remindAt, setRemindAt] = useState('');

  const load = async () => {
    const res = await reminderAPI.getMine();
    setReminders(res.data.reminders || []);
  };

  useEffect(() => { load().catch(() => setReminders([])); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!task?._id || !remindAt) return;
    await reminderAPI.create(task._id, { remindAt, channel: 'in_app', message: `Reminder for ${task.title}` });
    setRemindAt('');
    load();
  };

  return (
    <Panel title="Reminders">
      <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
        <input className="input" type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} disabled={!task} />
        <button className="btn-primary" disabled={!task}>Schedule</button>
      </form>
      <div className="mt-4 divide-y divide-gray-100">
        {reminders.length === 0 ? <EmptyState>No reminders scheduled.</EmptyState> : reminders.map((reminder) => (
          <div key={reminder._id} className="py-3 flex justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-900">{new Date(reminder.remindAt).toLocaleString()}</div>
              <div className="text-xs text-gray-500">{reminder.message}</div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 h-fit">{reminder.status}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
