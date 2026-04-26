import React, { useState, useEffect, useCallback } from 'react';
import { taskAPI, userAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';

const FILTERS = ['all', 'todo', 'in-progress', 'done'];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ todo: 0, 'in-progress': 0, done: 0, total: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [profile, setProfile] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const [tasksRes, statsRes] = await Promise.all([taskAPI.getAll(params), taskAPI.getStats()]);
      setTasks(tasksRes.data.tasks);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTasks();
    userAPI.getProfile().then((r) => setProfile(r.data)).catch(() => {});
  }, [fetchTasks]);

  const handleSave = async (data) => {
    if (editingTask) {
      await taskAPI.update(editingTask._id, data);
    } else {
      await taskAPI.create(data);
    }
    setEditingTask(null);
    fetchTasks();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    await taskAPI.delete(id);
    fetchTasks();
  };

  const handleStatusChange = async (id, status) => {
    await taskAPI.update(id, { status });
    fetchTasks();
  };

  const openCreate = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">TaskFlow</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              Hi, <span className="font-medium">{profile?.name || user?.name}</span>
            </span>
            <button onClick={logout} className="btn-secondary text-sm py-1.5">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'To Do', value: stats.todo, color: 'text-gray-600' },
            { label: 'In Progress', value: stats['in-progress'], color: 'text-blue-600' },
            { label: 'Done', value: stats.done, color: 'text-emerald-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center">
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'All' : f === 'in-progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={openCreate} className="btn-primary text-sm whitespace-nowrap">
            + New Task
          </button>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500 text-lg">No tasks found</p>
            <p className="text-gray-400 text-sm mt-1">
              {filter !== 'all' ? 'Try a different filter or ' : ''}
              <button onClick={openCreate} className="text-blue-600 hover:underline">
                create your first task
              </button>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onEdit={openEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </main>

      {modalOpen && (
        <TaskModal
          task={editingTask}
          onClose={() => { setModalOpen(false); setEditingTask(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
