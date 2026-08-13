import React, { useState } from 'react';
import { Delete, CornerDownLeft, Space, Globe } from 'lucide-react';

interface TVVirtualKeyboardProps {
  value: string;
  onChange: (val: string) => void;
  onDone: () => void;
}

export const TVVirtualKeyboard: React.FC<TVVirtualKeyboardProps> = ({
  value,
  onChange,
  onDone,
}) => {
  const [layoutMode, setLayoutMode] = useState<'qwerty' | 'symbols'>('qwerty');

  const qwertyRows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '/'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', ':']
  ];

  const shortcuts = ['https://', 'www.', '.com', '.vn', '.org', '.net'];

  const handleKeyPress = (char: string) => {
    onChange(value + char);
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 backdrop-blur-xl shadow-2xl space-y-3">
      {/* Shortcut Row */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-800">
        <span className="text-xs text-slate-400 font-semibold self-center mr-1 flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-cyan-400" /> Nhanh:
        </span>
        {shortcuts.map((sc) => (
          <button
            key={sc}
            type="button"
            onClick={() => handleKeyPress(sc)}
            className="px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-cyan-600 text-cyan-200 hover:text-white rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all cursor-pointer"
          >
            {sc}
          </button>
        ))}
      </div>

      {/* Main Keys Grid */}
      <div className="space-y-2">
        {qwertyRows.map((row, rIndex) => (
          <div key={rIndex} className="flex justify-center gap-1.5">
            {row.map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleKeyPress(char)}
                className="w-10 h-10 bg-slate-800 hover:bg-cyan-500 text-slate-100 hover:text-white font-mono text-base font-bold rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow"
              >
                {char}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Control Action Keys */}
      <div className="flex justify-between gap-2 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={handleBackspace}
          className="flex-1 py-2.5 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold rounded-xl border border-rose-500/30 focus:outline-none focus:ring-2 focus:ring-rose-400 transition-all flex items-center justify-center gap-1 cursor-pointer"
        >
          <Delete className="w-4 h-4" /> Xóa (BS)
        </button>

        <button
          type="button"
          onClick={() => handleKeyPress(' ')}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all flex items-center justify-center gap-1 cursor-pointer"
        >
          <Space className="w-4 h-4" /> Dấu cách
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all cursor-pointer"
        >
          Xóa hết
        </button>

        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-300 transition-all flex items-center justify-center gap-1 cursor-pointer"
        >
          <CornerDownLeft className="w-4 h-4" /> Hoàn tất
        </button>
      </div>
    </div>
  );
};
