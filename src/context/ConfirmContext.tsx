import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmOptions>({ message: '' });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = (options: string | ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      if (typeof options === 'string') {
        setConfig({
          title: 'Xác nhận hành động',
          message: options,
          confirmText: 'Xác nhận',
          cancelText: 'Hủy',
          type: 'danger',
        });
      } else {
        setConfig({
          title: options.title || 'Xác nhận hành động',
          message: options.message,
          confirmText: options.confirmText || 'Xác nhận',
          cancelText: options.cancelText || 'Hủy',
          type: options.type || 'danger',
        });
      }
      setIsOpen(true);
    });
  };

  const handleClose = (value: boolean) => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  };

  const isDanger = config.type === 'danger' || !config.type;
  const isWarning = config.type === 'warning';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform scale-100 transition-all animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="p-5 pb-4 flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  isDanger
                    ? 'bg-rose-100 text-rose-600'
                    : isWarning
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-indigo-100 text-indigo-600'
                }`}
              >
                {isDanger ? (
                  <Trash2 className="w-5 h-5" />
                ) : isWarning ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <HelpCircle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-base font-bold text-slate-800 leading-6">
                  {config.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed break-words whitespace-pre-wrap">
                  {config.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-sm cursor-pointer"
              >
                {config.cancelText || 'Hủy'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleClose(true)}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm cursor-pointer ${
                  isDanger
                    ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                    : isWarning
                    ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                }`}
              >
                {config.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
};
