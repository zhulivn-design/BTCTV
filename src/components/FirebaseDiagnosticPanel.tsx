import React, { useEffect, useState } from 'react';
import {
  Database,
  Server,
  CheckCircle2,
  AlertTriangle,
  Copy,
  RefreshCw,
  X,
  Code,
  Terminal,
  ShieldCheck,
  Check,
  Globe
} from 'lucide-react';
import { runFirebaseDiagnostics, FirebaseDiagnosticResult } from '../lib/firebaseDiagnostic';

interface FirebaseDiagnosticPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseDiagnosticPanel: React.FC<FirebaseDiagnosticPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<FirebaseDiagnosticResult | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await runFirebaseDiagnostics();
      setResult(res);
    } catch (err) {
      console.error('Error running diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintConsole = () => {
    runFirebaseDiagnostics();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Bảng Chẩn Đoán Cấu Hình Firestore & Database
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Live Status
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Xác minh kết nối Firestore & thông số cấu hình dự án Firebase
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Quick Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Status Card 1: Match / Connection Status */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                <span>Trạng Thái Kết Nối API & Client</span>
                <Server className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-center gap-2">
                {!result?.serverConfig ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm font-bold text-emerald-400">Kết Nối Trực Tiếp (Client Direct)</span>
                  </>
                ) : result?.isMatching ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm font-bold text-emerald-400">Đồng Bộ Fullstack 100%</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <span className="text-sm font-bold text-rose-400">Có Khác Biệt (Mismatch)</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {!result?.serverConfig
                  ? 'Ứng dụng truy vấn trực tiếp cơ sở dữ liệu Firestore từ trình duyệt.'
                  : result?.isMatching
                  ? 'Server API và Client đều truy vấn cùng một cơ sở dữ liệu Firestore.'
                  : 'Kiểm tra cấu hình server và client bên dưới để xem sự lệch cấu hình.'}
              </p>
            </div>

            {/* Status Card 2: Client Firestore Ping */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                <span>Truy Vấn Firestore</span>
                <Globe className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-center gap-2">
                {result?.clientFirestoreTest.success ? (
                  <>
                    <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm font-bold text-emerald-400">
                      Kết Nối Thành Công ({result.clientFirestoreTest.groupDocsCount} groups)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <span className="text-sm font-bold text-rose-400">Lỗi Truy Vấn</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Đã gửi truy vấn trực tiếp từ trình duyệt đến Firestore thành công.
              </p>
            </div>

            {/* Status Card 3: Active Database ID */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                <span>Database ID Hiện Tại</span>
                <Database className="w-4 h-4 text-amber-400" />
              </div>
              <div className="font-mono text-xs font-bold text-amber-300 break-all bg-slate-900/80 p-1.5 rounded border border-slate-700/50">
                {result?.clientConfig.databaseId || 'Đang tải...'}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Project ID: <span className="text-slate-200 font-mono">{result?.clientConfig.projectId}</span>
              </p>
            </div>

          </div>

          {/* Config Detail Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Code className="w-4 h-4 text-amber-400" />
              Chi Tiết Cấu Hình Firebase Initialized (Firebase Config Values)
            </h3>

            <div className="border border-slate-700/80 rounded-xl overflow-hidden bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700/80">
                  <tr>
                    <th className="py-2.5 px-4">Thông Số (Property)</th>
                    <th className="py-2.5 px-4">Giá Trị Client (Trình Duyệt)</th>
                    <th className="py-2.5 px-4">Giá Trị Server API</th>
                    <th className="py-2.5 px-4 text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  
                  {/* Row: Project ID */}
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-400">Project ID</td>
                    <td className="py-2.5 px-4 text-amber-300 font-bold">{result?.clientConfig.projectId}</td>
                    <td className="py-2.5 px-4 text-amber-300 font-bold">{result?.serverConfig?.projectId || 'Client Direct'}</td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      {!result?.serverConfig ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : result?.clientConfig.projectId === result?.serverConfig?.projectId ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Lệch
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Row: Database ID */}
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-400">Database ID (Firestore)</td>
                    <td className="py-2.5 px-4 text-emerald-300 font-bold break-all">{result?.clientConfig.databaseId}</td>
                    <td className="py-2.5 px-4 text-emerald-300 font-bold break-all">{result?.serverConfig?.databaseId || 'Client Direct'}</td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      {!result?.serverConfig ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : result?.clientConfig.databaseId === result?.serverConfig?.databaseId ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Lệch
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Row: Auth Domain */}
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-400">Auth Domain</td>
                    <td className="py-2.5 px-4 text-slate-200">{result?.clientConfig.authDomain}</td>
                    <td className="py-2.5 px-4 text-slate-200">{result?.serverConfig?.authDomain || 'Client Direct'}</td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      {!result?.serverConfig ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : result?.clientConfig.authDomain === result?.serverConfig?.authDomain ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Lệch
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Row: Storage Bucket */}
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-400">Storage Bucket</td>
                    <td className="py-2.5 px-4 text-slate-200">{result?.clientConfig.storageBucket}</td>
                    <td className="py-2.5 px-4 text-slate-200">{result?.serverConfig?.storageBucket || 'Client Direct'}</td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      {!result?.serverConfig ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : result?.clientConfig.storageBucket === result?.serverConfig?.storageBucket ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Lệch
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Row: API Key */}
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-400">API Key</td>
                    <td className="py-2.5 px-4 text-slate-400">{result?.clientConfig.apiKeyMasked}</td>
                    <td className="py-2.5 px-4 text-slate-400">{result?.serverConfig?.apiKeyMasked || 'Client Direct'}</td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      {!result?.serverConfig ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : result?.clientConfig.apiKeyMasked === result?.serverConfig?.apiKeyMasked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Lệch
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Row: App ID */}
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-400">App ID</td>
                    <td className="py-2.5 px-4 text-slate-300 break-all">{result?.clientConfig.appId}</td>
                    <td className="py-2.5 px-4 text-slate-300 break-all">{result?.serverConfig?.appId || 'Client Direct'}</td>
                    <td className="py-2.5 px-4 text-center font-sans">
                      {!result?.serverConfig ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : result?.clientConfig.appId === result?.serverConfig?.appId ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Khớp (OK)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Lệch
                        </span>
                      )}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* Console Log Notice */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <Terminal className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-semibold text-slate-200">Hướng Dẫn Kiểm Tra Qua Browser Console (Developer Tools)</div>
              <p className="text-slate-400">
                Bấm phím <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono text-[10px]">F12</kbd> hoặc chuột phải chọn <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono text-[10px]">Inspect &gt; Console</kbd>, sau đó gõ lệnh:
              </p>
              <div className="font-mono text-cyan-300 bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-xs w-fit select-all">
                logFirebaseInfo()
              </div>
              <p className="text-slate-500 text-[11px]">
                Lệnh này sẽ xuất bảng báo cáo chi tiết trực tiếp kèm mã màu trong console trình duyệt.
              </p>
            </div>
          </div>

        </div>

        {/* Panel Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-t border-slate-800">
          <div className="text-xs text-slate-400 font-mono">
            {result?.timestamp ? `Cập nhật: ${new Date(result.timestamp).toLocaleTimeString()}` : ''}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrintConsole}
              className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              In Ra Console
            </button>

            <button
              onClick={handleCopyJson}
              className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              {copied ? 'Đã Sao Chép!' : 'Sao Chép JSON'}
            </button>

            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Đang Kiểm Tra...' : 'Chạy Chẩn Đoán Lại'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
