import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Copy, Check, MessageSquare, Terminal } from 'lucide-react';
import { errorTracker } from '../services/errorTracker';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Record to global error tracker
    errorTracker.captureError(
      error,
      {
        componentStack: errorInfo.componentStack
      },
      'CRITICAL',
      'KASIR'
    );
  }

  handleSoftReload = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleHardReload = () => {
    window.location.reload();
  };

  handleCopyDetails = () => {
    const { error, errorInfo } = this.state;
    const details = [
      '=== KETOKO POS ERROR REPORT ===',
      `Waktu: ${new Date().toISOString()}`,
      `Pesan: ${error?.message || 'Unknown Error'}`,
      `Stack Trace: ${error?.stack || 'N/A'}`,
      `Component Stack: ${errorInfo?.componentStack || 'N/A'}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`
    ].join('\n\n');

    navigator.clipboard.writeText(details);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  handleWhatsAppTechnician = () => {
    const { error } = this.state;
    const text = encodeURIComponent(
      `Halo Tim Teknis Ketoko POS, saya mengalami kendala pada tampilan aplikasi:\n\n*Pesan Eror:* ${error?.message || 'Error UI'}\n*Waktu:* ${new Date().toLocaleString('id-ID')}\n*Perangkat:* ${navigator.userAgent}\n\nMohon bantuannya untuk pengecekan.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-850 rounded-3xl border border-rose-500/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-scaleUp">
            
            {/* Ambient Background Glow */}
            <div className="absolute -right-20 -top-20 w-60 h-60 rounded-full bg-rose-500/10 blur-3xl pointer-events-none"></div>

            {/* Error Header */}
            <div className="flex items-center gap-4 border-b border-slate-700/60 pb-5">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Crash Prevention Shield
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  {this.props.fallbackTitle || 'Terjadi Kendala pada Tampilan'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sistem keamanan Ketoko mencegah layar blank putih (White Screen). Data transaksi & stok tetap aman di database lokal.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="my-5 bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-xs font-mono space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <Terminal className="w-4 h-4 shrink-0" />
                <span className="truncate">{error?.name || 'Error'}: {error?.message || 'Unknown Exception'}</span>
              </div>
              {error?.stack && (
                <div className="text-[11px] text-slate-400 max-h-32 overflow-y-auto custom-scroll pt-2 border-t border-slate-800/80 leading-relaxed font-mono whitespace-pre-wrap">
                  {error.stack}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={this.handleSoftReload}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold flex items-center justify-center gap-2 text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Pulihkan Tampilan (Soft)</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleHardReload}
                  className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-2 text-xs sm:text-sm border border-slate-700 transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Muat Ulang Penuh (F5)</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={this.handleCopyDetails}
                  className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  {this.state.copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{this.state.copied ? 'Log Berhasil Disalin!' : 'Salin Detail Eror'}</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleWhatsAppTechnician}
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Bantuan WA Teknisi</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
