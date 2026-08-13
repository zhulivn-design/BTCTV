import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  HardDrive,
  BarChart3,
  Search,
  ShieldCheck,
  Info
} from 'lucide-react';

interface DailyUsageRecord {
  date: string;
  reads: number;
  writes: number;
  deletes: number;
}

interface ApiLogItem {
  id: string;
  timestamp: string;
  operation: 'read' | 'write' | 'delete';
  collection: string;
  docId?: string;
  status: 'success' | 'quota_exhausted' | 'error';
  message?: string;
  count: number;
}

interface FirestoreUsageData {
  today: string;
  isQuotaExhausted: boolean;
  statusLevel: 'normal' | 'warning' | 'critical' | 'exhausted';
  todayUsage: DailyUsageRecord;
  limits: {
    freeDailyReads: number;
    freeDailyWrites: number;
    freeDailyDeletes: number;
  };
  percents: {
    readPercent: number;
    writePercent: number;
    deletePercent: number;
  };
  history: DailyUsageRecord[];
  recentLogs: ApiLogItem[];
}

export const FirestoreLogsView: React.FC = () => {
  const [data, setData] = useState<FirestoreUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterOp, setFilterOp] = useState<'all' | 'read' | 'write' | 'delete' | 'error'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsageData = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/admin/firestore-usage');
      if (resp.ok) {
        const resJson = await resp.json();
        if (resJson && resJson.ok) {
          setData(resJson);
        }
      }
    } catch (e) {
      console.warn('Error loading firestore usage metrics:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tất cả lịch sử log gọi API?')) return;
    try {
      await fetch('/api/admin/firestore-usage/clear-logs', { method: 'POST' });
      fetchUsageData();
    } catch (e) {
      console.error('Error clearing logs:', e);
    }
  };

  useEffect(() => {
    fetchUsageData();
    const interval = setInterval(fetchUsageData, 4000);
    return () => clearInterval(interval);
  }, []);

  const todayUsage = data?.todayUsage || { date: new Date().toISOString().slice(0, 10), reads: 0, writes: 0, deletes: 0 };
  const limits = data?.limits || { freeDailyReads: 50000, freeDailyWrites: 20000, freeDailyDeletes: 20000 };
  const percents = data?.percents || { readPercent: 0, writePercent: 0, deletePercent: 0 };
  const logs = data?.recentLogs || [];
  const history = data?.history || [];

  const filteredLogs = logs.filter((log) => {
    if (filterOp === 'error' && log.status !== 'error' && log.status !== 'quota_exhausted') return false;
    if (filterOp !== 'all' && filterOp !== 'error' && log.operation !== filterOp) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchCol = log.collection.toLowerCase().includes(term);
      const matchDoc = (log.docId || '').toLowerCase().includes(term);
      const matchMsg = (log.message || '').toLowerCase().includes(term);
      if (!matchCol && !matchDoc && !matchMsg) return false;
    }
    return true;
  });

  const getStatusBadge = () => {
    if (data?.isQuotaExhausted || data?.statusLevel === 'exhausted') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-xs font-bold">
          <XCircle className="w-4 h-4 text-rose-400" /> Vượt Hạn Mức (Đã tự động chuyển sang Bộ Nhớ RAM)
        </div>
      );
    }
    if (data?.statusLevel === 'critical') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold">
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Nguy Cơ Vượt Hạn Mức (&gt;80%)
        </div>
      );
    }
    if (data?.statusLevel === 'warning') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full text-xs font-bold">
          <AlertTriangle className="w-4 h-4 text-yellow-400" /> Cảnh Báo (&gt;50%)
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> An Toàn (Trong Hạn Mức Miễn Phí Spark)
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Status */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Database className="w-6 h-6 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">Theo Dõi Nhật Ký API & Hạn Mức Firestore</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Thống kê chi tiết các yêu cầu Đọc, Ghi, Xóa đến Firebase Firestore theo ngày ({data?.today || 'Hôm nay'})
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <button
            type="button"
            onClick={fetchUsageData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Làm mới thông số"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} /> Làm mới
          </button>
        </div>
      </div>

      {/* Reassurance Banner */}
      <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-200 space-y-1">
          <p className="font-semibold text-indigo-100">💡 Cơ chế Bảo Vệ Hạn Mức Tự Động (Spark Plan Safe Guard):</p>
          <p className="text-indigo-300/90 leading-relaxed">
            Hệ thống áp dụng bộ đệm bộ nhớ đệm RAM / JSON cục bộ trên máy chủ Express. Các hoạt động ping kiểm tra thời gian thực (Heartbeat) của thiết bị không gọi tới Firestore. Trong trường hợp hiếm hoi chạm hạn mức miễn phí (50.000 Reads/ngày), ứng dụng sẽ tự động chuyển sang lưu trữ bộ nhớ đệm mà không làm ngắt quãng hiển thị TV.
          </p>
        </div>
      </div>

      {/* 3 Metric Cards for Daily Limits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* READS CARD */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" /> Đọc Dữ Liệu (Reads)
            </span>
            <span className="text-xs font-bold text-cyan-400">{percents.readPercent}%</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{todayUsage.reads.toLocaleString()}</span>
            <span className="text-xs text-slate-400 font-mono">/ {limits.freeDailyReads.toLocaleString()} lượt</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                percents.readPercent >= 90
                  ? 'bg-rose-500'
                  : percents.readPercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-cyan-500'
              }`}
              style={{ width: `${percents.readPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Còn lại:</span>
            <span className="font-bold text-slate-200">
              {Math.max(0, limits.freeDailyReads - todayUsage.reads).toLocaleString()} lượt
            </span>
          </div>
        </div>

        {/* WRITES CARD */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-amber-400" /> Ghi Dữ Liệu (Writes)
            </span>
            <span className="text-xs font-bold text-amber-400">{percents.writePercent}%</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{todayUsage.writes.toLocaleString()}</span>
            <span className="text-xs text-slate-400 font-mono">/ {limits.freeDailyWrites.toLocaleString()} lượt</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                percents.writePercent >= 90
                  ? 'bg-rose-500'
                  : percents.writePercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${percents.writePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Còn lại:</span>
            <span className="font-bold text-slate-200">
              {Math.max(0, limits.freeDailyWrites - todayUsage.writes).toLocaleString()} lượt
            </span>
          </div>
        </div>

        {/* DELETES CARD */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-rose-400" /> Xóa Dữ Liệu (Deletes)
            </span>
            <span className="text-xs font-bold text-rose-400">{percents.deletePercent}%</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-100">{todayUsage.deletes.toLocaleString()}</span>
            <span className="text-xs text-slate-400 font-mono">/ {limits.freeDailyDeletes.toLocaleString()} lượt</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                percents.deletePercent >= 90
                  ? 'bg-rose-500'
                  : percents.deletePercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${percents.deletePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Còn lại:</span>
            <span className="font-bold text-slate-200">
              {Math.max(0, limits.freeDailyDeletes - todayUsage.deletes).toLocaleString()} lượt
            </span>
          </div>
        </div>
      </div>

      {/* Daily Summary Table */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" /> Bảng Tổng Kết API Thực Hiện Theo Ngày
          </h4>
          <span className="text-xs text-slate-400">Lưu lịch sử 14 ngày gần nhất</span>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Ngày</th>
                <th className="p-3">Yêu Cầu Đọc (Reads)</th>
                <th className="p-3">Yêu Cầu Ghi (Writes)</th>
                <th className="p-3">Yêu Cầu Xóa (Deletes)</th>
                <th className="p-3">Mức Độ Sử Dụng</th>
                <th className="p-3">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono">
              {history.map((item) => {
                const rPct = (item.reads / limits.freeDailyReads) * 100;
                const wPct = (item.writes / limits.freeDailyWrites) * 100;
                const dPct = (item.deletes / limits.freeDailyDeletes) * 100;
                const maxP = Math.max(rPct, wPct, dPct);

                return (
                  <tr key={item.date} className={item.date === data?.today ? 'bg-cyan-950/20 font-bold' : 'hover:bg-slate-800/40'}>
                    <td className="p-3 text-slate-200 font-sans">
                      {item.date} {item.date === data?.today && <span className="ml-1 px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-[10px]">(Hôm nay)</span>}
                    </td>
                    <td className="p-3 text-cyan-300">
                      {item.reads.toLocaleString()} <span className="text-[10px] text-slate-500">({rPct.toFixed(1)}%)</span>
                    </td>
                    <td className="p-3 text-amber-300">
                      {item.writes.toLocaleString()} <span className="text-[10px] text-slate-500">({wPct.toFixed(1)}%)</span>
                    </td>
                    <td className="p-3 text-rose-300">
                      {item.deletes.toLocaleString()} <span className="text-[10px] text-slate-500">({dPct.toFixed(1)}%)</span>
                    </td>
                    <td className="p-3">
                      <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden inline-block align-middle mr-2">
                        <div
                          className={`h-full ${maxP >= 80 ? 'bg-rose-500' : maxP >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, maxP)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans">{maxP.toFixed(1)}%</span>
                    </td>
                    <td className="p-3 font-sans">
                      {maxP >= 100 ? (
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[11px] font-bold">Vượt Hạn Mức</span>
                      ) : maxP >= 80 ? (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-bold">Nguy Cơ Cao</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-bold">An Toàn</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500 italic font-sans">
                    Chưa có dữ liệu nhật ký cho những ngày qua.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Detailed Log Viewer */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" /> Lịch Sử Chi Tiết Yêu Cầu API Firestore Trực Tiếp
          </h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearLogs}
              className="px-3 py-1.5 bg-rose-900/40 hover:bg-rose-800/60 text-rose-300 border border-rose-800/60 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa nhật ký
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setFilterOp('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterOp === 'all' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tất cả ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterOp('read')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterOp === 'read' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Đọc (READ)
            </button>
            <button
              type="button"
              onClick={() => setFilterOp('write')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterOp === 'write' ? 'bg-amber-950 text-amber-300 border border-amber-800/50' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ghi (WRITE)
            </button>
            <button
              type="button"
              onClick={() => setFilterOp('delete')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterOp === 'delete' ? 'bg-rose-950 text-rose-300 border border-rose-800/50' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Xóa (DELETE)
            </button>
            <button
              type="button"
              onClick={() => setFilterOp('error')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                filterOp === 'error' ? 'bg-rose-900 text-rose-200 border border-rose-700' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lỗi / Quá Hạn Mức
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo Collection, Doc ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Logs Terminal Window */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 h-80 overflow-y-auto font-mono text-xs space-y-1.5">
          {filteredLogs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            const dateStr = new Date(log.timestamp).toLocaleDateString();

            return (
              <div
                key={log.id}
                className={`p-2 rounded-lg border flex flex-wrap items-center justify-between gap-2 transition-all ${
                  log.status === 'quota_exhausted' || log.status === 'error'
                    ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                    : 'bg-slate-900/60 border-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    {dateStr} {timeStr}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      log.operation === 'read'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : log.operation === 'write'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {log.operation.toUpperCase()}
                  </span>
                  <span className="text-slate-200 font-bold">{log.collection}</span>
                  {log.docId && <span className="text-slate-400">/{log.docId}</span>}
                  {log.count > 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
                      +{log.count} docs
                    </span>
                  )}
                </div>

                <div>
                  {log.status === 'success' ? (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Thành công
                    </span>
                  ) : log.status === 'quota_exhausted' ? (
                    <span className="text-[10px] px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded font-semibold flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-rose-400" /> Quá Hạn Mức
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-400" /> {log.message || 'Lỗi'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-slate-500 font-sans italic text-xs">
              Chưa ghi nhận hoạt động gọi API nào phù hợp với bộ lọc.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
