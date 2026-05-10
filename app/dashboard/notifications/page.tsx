"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    setNotifications(data ?? []);
    setLoading(false);
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">Updates on approvals, assignments, and alerts.</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <button onClick={markAllRead} className="btn-secondary text-sm">Mark all as read</button>
        )}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">You're all caught up!</div>
      ) : (
        <div className="divide-y divide-gray-50 card overflow-hidden">
          {notifications.map(n => (
            <div key={n.id} onClick={() => !n.is_read && markRead(n.id)} 
              className={`px-5 py-4 flex gap-4 transition-colors ${!n.is_read ? 'bg-blue-50/50 cursor-pointer hover:bg-blue-50' : 'bg-white'}`}>
              <div className="mt-1">
                {!n.is_read ? (
                  <span className="flex w-2.5 h-2.5 bg-brand-blue rounded-full"></span>
                ) : (
                  <span className="flex w-2.5 h-2.5 bg-gray-200 rounded-full"></span>
                )}
              </div>
              <div className="flex-1">
                <div className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {n.title}
                </div>
                {n.body && <div className="text-sm text-gray-500 mt-0.5">{n.body}</div>}
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
