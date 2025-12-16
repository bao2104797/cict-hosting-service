import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Terminal as TerminalIcon, Copy, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";

interface TerminalProps {
  open: boolean;
  onClose: () => void;
  server: {
    id: string;
    name: string;
    ipAddress: string;
    port?: number;
    username?: string;
  };
}

// ANSI Color Codes
const ANSI_COLORS: Record<number, string> = {
  30: '#000000', 31: '#cd0000', 32: '#00cd00', 33: '#cdcd00',
  34: '#0000ee', 35: '#cd00cd', 36: '#00cdcd', 37: '#e5e5e5',
  90: '#7f7f7f', 91: '#ff0000', 92: '#00ff00', 93: '#ffff00',
  94: '#5c5cff', 95: '#ff00ff', 96: '#00ffff', 97: '#ffffff',
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: '#000000', 41: '#cd0000', 42: '#00cd00', 43: '#cdcd00',
  44: '#0000ee', 45: '#cd00cd', 46: '#00cdcd', 47: '#e5e5e5',
  100: '#7f7f7f', 101: '#ff0000', 102: '#00ff00', 103: '#ffff00',
  104: '#5c5cff', 105: '#ff00ff', 106: '#00ffff', 107: '#ffffff',
};

/**
 * Terminal Component - SSH Terminal qua WebSocket với đầy đủ tính năng
 * Hỗ trợ: ANSI colors, command history, special keys, copy/paste, zoom, themes
 */
export function Terminal({ open, onClose, server }: TerminalProps) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [password, setPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [terminalTheme, setTerminalTheme] = useState<'dark' | 'light'>('dark');
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalContentRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Tự động kết nối khi mở dialog
  useEffect(() => {
    if (open && !connected && !connecting && !wsRef.current) {
      connectWithSshKey();
    }
    
    // Xóa terminal khi đóng dialog
    if (!open) {
      disconnect();
      setPassword("");
      setCommandInput("");
      setShowPasswordInput(false);
      setConnected(false);
      setConnecting(false);
      setCommandHistory([]);
      setHistoryIndex(-1);
      setFontSize(14);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll khi có output mới (chỉ khi autoScroll = true và user không đang scroll)
  useEffect(() => {
    if (autoScroll && !isUserScrollingRef.current && terminalContentRef.current) {
      terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight;
    }
  }, [connected, autoScroll]);

  // Xử lý scroll event để detect user scrolling
  const handleTerminalScroll = useCallback(() => {
    if (!terminalContentRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = terminalContentRef.current;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    
    isUserScrollingRef.current = !isAtBottom;
    
    // Reset auto-scroll sau 2 giây không scroll
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      if (isAtBottom) {
        isUserScrollingRef.current = false;
      }
    }, 2000);
  }, []);

  // Kết nối bằng SSH key (tự động)
  const connectWithSshKey = () => {
    if (connecting || connected || wsRef.current) return;

    setConnecting(true);
    appendToTerminal("\n[Connecting via SSH key...]\n");

    try {
      const getWebSocketUrl = () => {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
        const wsUrl = apiBaseUrl.replace(/^http/, "ws");
        return `${wsUrl}/ws/terminal`;
      };
      
      const wsUrl = getWebSocketUrl();
      console.log("Connecting to WebSocket:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const config = {
          host: server.ipAddress,
          port: server.port || 22,
          username: server.username || "root",
          serverId: parseInt(server.id),
        };

        ws.send(JSON.stringify(config));
      };

      ws.onmessage = (event) => {
        const message = event.data;
        
        if (message.includes("[server] SSH connected")) {
          const cleanMessage = processAnsiCodes(message);
          appendToTerminal(cleanMessage);
          setConnected(true);
          setConnecting(false);
          appendToTerminal("\n");
          commandInputRef.current?.focus();
        } else if (message.includes("SSH key authentication failed") || 
                   message.includes("Missing password and SSH key not available")) {
          setConnecting(false);
          setShowPasswordInput(true);
          appendToTerminal("\n⚠️  SSH key không khả dụng. Vui lòng nhập password.\n");
        } else {
          appendToTerminal(message);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        appendToTerminal("\n[ERROR] Connection error occurred\n");
        setConnecting(false);
        toast.error("Không thể kết nối đến terminal");
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason, event.wasClean);
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;
        if (terminalContentRef.current && event.code !== 1000) {
          if (!event.wasClean) {
            appendToTerminal(`\n[Connection closed: ${event.code} - ${event.reason || "Unknown"}]\n`);
          }
        }
      };

    } catch (error) {
      console.error("Failed to connect:", error);
      appendToTerminal("\n[ERROR] Failed to initialize connection\n");
      toast.error("Không thể khởi tạo kết nối");
      setConnecting(false);
    }
  };

  // Kết nối bằng password
  const connectWithPassword = () => {
    if (connecting || connected || !password.trim()) return;

    setConnecting(true);
    setShowPasswordInput(false);
    appendToTerminal("\n[Connecting via password...]\n");

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const getWebSocketUrl = () => {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
        const wsUrl = apiBaseUrl.replace(/^http/, "ws");
        return `${wsUrl}/ws/terminal`;
      };
      
      const wsUrl = getWebSocketUrl();
      console.log("Connecting to WebSocket (with password):", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const config = {
          host: server.ipAddress,
          port: server.port || 22,
          username: server.username || "root",
          serverId: parseInt(server.id),
          passwordB64: btoa(password),
        };

        ws.send(JSON.stringify(config));
      };

      ws.onmessage = (event) => {
        const message = event.data;
        appendToTerminal(message);
        
        if (message.includes("[server] SSH connected")) {
          setConnected(true);
          setConnecting(false);
          setPassword("");
          commandInputRef.current?.focus();
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        appendToTerminal("\n[ERROR] Connection error occurred\n");
        setConnecting(false);
        toast.error("Không thể kết nối đến terminal");
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason, event.wasClean);
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;
        if (!event.wasClean && event.code !== 1000) {
          appendToTerminal(`\n[Connection closed: ${event.code} - ${event.reason || "Unknown"}]\n`);
        }
      };

    } catch (error) {
      console.error("Failed to connect:", error);
      toast.error("Không thể khởi tạo kết nối");
      setConnecting(false);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setConnecting(false);
  };

  // Xử lý ANSI escape codes và render HTML với màu sắc
  const processAnsiCodes = (text: string): string => {
    // Bước 1: Loại bỏ các escape sequences không mong muốn (GIỮ LẠI SGR codes để xử lý màu sắc sau)
    let cleaned = text
      // Loại bỏ OSC (Operating System Command) sequences: \x1B]...\x07 hoặc \x1B]...\x1B\\
      .replace(/\x1B\][^\x07\x1B]*(\x07|\x1B\\)/g, '')
      // Loại bỏ bracketed paste mode: [?2004h và [?2004l
      .replace(/\x1B\[[?]2004[hl]/g, '')
      // Loại bỏ DEC private mode sequences: [?1h, [?1l, [?3h, [?3l, [?4h, [?4l, [?5h, [?5l, [?6h, [?6l, [?7h, [?7l, [?8h, [?8l, [?9h, [?9l
      .replace(/\x1B\[[?][0-9]*[hl]/g, '')
      // Loại bỏ cursor position sequences: [H, [f, [r (set scrolling region)
      .replace(/\x1B\[[0-9;]*[Hfr]/g, '')
      // Loại bỏ erase sequences: [J, [K
      .replace(/\x1B\[[0-9;]*[JK]/g, '')
      // Loại bỏ cursor movement: [A, [B, [C, [D (arrow keys)
      .replace(/\x1B\[[0-9;]*[ABCD]/g, '')
      // Loại bỏ save/restore cursor: [s, [u
      .replace(/\x1B\[[su]/g, '')
      // Loại bỏ scroll: [T, [S
      .replace(/\x1B\[[0-9;]*[ST]/g, '')
      // Loại bỏ insert/delete lines: [L, [M
      .replace(/\x1B\[[0-9;]*[LM]/g, '')
      // Loại bỏ các escape sequences từ nano/vim: (B, )0 (character set selection)
      .replace(/\x1B\([A-Z0-9]/g, '')
      .replace(/\x1B\)[A-Z0-9]/g, '')
      // Loại bỏ các escape sequences đơn lẻ khác (nhưng GIỮ LẠI SGR codes [0-9;]*m)
      .replace(/\x1B\[[?][0-9]*[a-zA-Z]/g, '')
      .replace(/\x1B\[[^0-9m]*[a-zA-Z]/g, '')
      .replace(/\x1B[@-Z\\-_]/g, '')
      // Loại bỏ các messages trong ngoặc vuông từ nano: [ Reading... ], [ Read X lines ]
      .replace(/\[ Reading\.\.\. \]/g, '')
      .replace(/\[ Read \d+ lines? \]/g, '');

    // Bước 1.5: Xử lý control characters và hiển thị chúng dưới dạng readable
    // Chỉ xử lý các control chars không phải là ESC (vì ESC cần cho SGR codes)
    cleaned = cleaned
      // Thay thế control characters bằng ký tự readable (^X format) - nhưng giữ lại ESC (\x1B)
      .replace(/\x01/g, '^A')  // Ctrl+A
      .replace(/\x02/g, '^B')  // Ctrl+B
      .replace(/\x03/g, '^C')  // Ctrl+C
      .replace(/\x04/g, '^D')  // Ctrl+D
      .replace(/\x05/g, '^E')  // Ctrl+E
      .replace(/\x06/g, '^F')  // Ctrl+F
      .replace(/\x07/g, '^G')  // Ctrl+G (Bell)
      .replace(/\x08/g, '^H')  // Ctrl+H (Backspace)
      .replace(/\x0B/g, '^K')  // Ctrl+K (Vertical Tab)
      .replace(/\x0C/g, '^L')  // Ctrl+L (Form Feed)
      .replace(/\x0E/g, '^N')  // Ctrl+N
      .replace(/\x0F/g, '^O')  // Ctrl+O
      .replace(/\x10/g, '^P')  // Ctrl+P
      .replace(/\x11/g, '^Q')  // Ctrl+Q
      .replace(/\x12/g, '^R')  // Ctrl+R
      .replace(/\x13/g, '^S')  // Ctrl+S
      .replace(/\x14/g, '^T')  // Ctrl+T
      .replace(/\x15/g, '^U')  // Ctrl+U
      .replace(/\x16/g, '^V')  // Ctrl+V
      .replace(/\x17/g, '^W')  // Ctrl+W
      .replace(/\x18/g, '^X')  // Ctrl+X
      .replace(/\x19/g, '^Y')  // Ctrl+Y
      .replace(/\x1A/g, '^Z')  // Ctrl+Z
      .replace(/\x1C/g, '^\\') // Ctrl+\
      .replace(/\x1D/g, '^]')  // Ctrl+]
      .replace(/\x1E/g, '^^')  // Ctrl+^
      .replace(/\x1F/g, '^_')  // Ctrl+_
      // Loại bỏ các ký tự không in được còn lại (nhưng giữ lại \x1B cho ESC)
      .replace(/[\x00\x09\x0A\x0D]/g, (match) => {
        // Giữ lại tab, newline, carriage return
        return match === '\x09' ? '    ' : match; // Tab thành 4 spaces
      })
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F]/g, '') // Loại bỏ các control chars còn lại
      // Loại bỏ các ký tự '=' đơn lẻ có thể là từ escape sequences (nhưng giữ lại trong text bình thường)
      .replace(/(?<!\S)=(?=\s|$|\[)/g, '')
      // Loại bỏ các ký tự đặc biệt không mong muốn
      .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width spaces

    // Bước 2: Xử lý ANSI SGR (Select Graphic Rendition) codes để render màu sắc
    const parts: Array<{ text: string; fg?: string; bg?: string; bold?: boolean; underline?: boolean }> = [];
    let currentFg: string | undefined;
    let currentBg: string | undefined;
    let currentBold = false;
    let currentUnderline = false;

    // Pattern để match chỉ SGR sequences (kết thúc bằng 'm')
    const sgrRegex = /\x1B\[([0-9;]*)(m)/g;
    let lastIndex = 0;
    let match;

    while ((match = sgrRegex.exec(cleaned)) !== null) {
      // Thêm text trước ANSI code
      if (match.index > lastIndex) {
        const textPart = cleaned.substring(lastIndex, match.index);
        if (textPart) {
          parts.push({
            text: textPart,
            fg: currentFg,
            bg: currentBg,
            bold: currentBold,
            underline: currentUnderline,
          });
        }
      }

      const codes = match[1] ? match[1].split(';').map(Number) : [0];
      const command = match[2];

      // Chỉ xử lý SGR commands (m)
      if (command === 'm') {
        for (let i = 0; i < codes.length; i++) {
          const code = codes[i];

          if (code === 0) {
            // Reset all
            currentFg = undefined;
            currentBg = undefined;
            currentBold = false;
            currentUnderline = false;
          } else if (code === 1) {
            currentBold = true;
          } else if (code === 4) {
            currentUnderline = true;
          } else if (code === 22) {
            currentBold = false;
          } else if (code === 24) {
            currentUnderline = false;
          } else if (code >= 30 && code <= 37) {
            // Standard foreground colors
            currentFg = ANSI_COLORS[code];
          } else if (code >= 90 && code <= 97) {
            // Bright foreground colors
            currentFg = ANSI_COLORS[code];
          } else if (code >= 40 && code <= 47) {
            // Standard background colors
            currentBg = ANSI_BG_COLORS[code];
          } else if (code >= 100 && code <= 107) {
            // Bright background colors
            currentBg = ANSI_BG_COLORS[code];
          } else if (code === 39) {
            currentFg = undefined;
          } else if (code === 49) {
            currentBg = undefined;
          }
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Thêm phần text còn lại
    if (lastIndex < cleaned.length) {
      const textPart = cleaned.substring(lastIndex);
      if (textPart) {
        parts.push({
          text: textPart,
          fg: currentFg,
          bg: currentBg,
          bold: currentBold,
          underline: currentUnderline,
        });
      }
    }

    // Nếu không có ANSI codes, trả về text đã clean
    if (parts.length === 0) {
      // Loại bỏ tất cả escape sequences còn sót lại
      return cleaned.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B[@-Z\\-_]/g, '');
    }

    // Render thành HTML
    return parts.map(part => {
      const styles: string[] = [];
      if (part.fg) styles.push(`color: ${part.fg}`);
      if (part.bg) styles.push(`background-color: ${part.bg}`);
      if (part.bold) styles.push('font-weight: bold');
      if (part.underline) styles.push('text-decoration: underline');
      
      // Escape HTML special characters
      const escapedText = part.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      if (styles.length > 0) {
        return `<span style="${styles.join('; ')}">${escapedText}</span>`;
      }
      return escapedText;
    }).join('');
  };

  const appendToTerminal = (text: string) => {
    if (!terminalContentRef.current) return;

    // Xử lý ANSI codes và convert sang HTML
    const htmlContent = processAnsiCodes(text);
    
    // Append HTML content
    const div = document.createElement('div');
    div.innerHTML = htmlContent;
    
    while (div.firstChild) {
      terminalContentRef.current.appendChild(div.firstChild);
    }

    // Auto-scroll nếu enabled
    if (autoScroll && !isUserScrollingRef.current) {
      requestAnimationFrame(() => {
        if (terminalContentRef.current) {
          terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight;
        }
      });
    }
  };

  const clearTerminal = () => {
    if (terminalContentRef.current) {
      terminalContentRef.current.innerHTML = "";
      terminalContentRef.current.scrollTop = 0;
    }
  };

  const copyTerminalContent = () => {
    if (!terminalContentRef.current) return;
    
    const text = terminalContentRef.current.innerText || terminalContentRef.current.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Đã copy nội dung terminal");
    }).catch(() => {
      toast.error("Không thể copy nội dung");
    });
  };

  const handleSendCommand = () => {
    if (!connected || !wsRef.current || !commandInput.trim()) return;
    
    const command = commandInput.trim();
    
    // Xử lý command đặc biệt: clear
    if (command.toLowerCase() === "clear") {
      clearTerminal();
      setCommandInput("");
      commandInputRef.current?.focus();
      return;
    }
    
    // Thêm vào history
    if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== command) {
      setCommandHistory(prev => [...prev, command]);
    }
    setHistoryIndex(-1);
    
    // Gửi command
    wsRef.current.send(command + "\n");
    setCommandInput("");
    commandInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!connected || !wsRef.current) return;

    // Enter để gửi command
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendCommand();
      return;
    }

    // Arrow Up/Down cho command history
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[newIndex]);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCommandInput("");
        } else {
          setHistoryIndex(newIndex);
          setCommandInput(commandHistory[newIndex]);
        }
      }
      return;
    }

    // Ctrl+C để interrupt (gửi SIGINT)
    if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (wsRef.current && connected) {
        // Gửi Ctrl+C character (0x03)
        wsRef.current.send(String.fromCharCode(3));
      }
      return;
    }

    // Ctrl+D để EOF (logout)
    if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (wsRef.current && connected) {
        wsRef.current.send(String.fromCharCode(4));
      }
      return;
    }

    // Ctrl+L để clear (giống clear command)
    if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      clearTerminal();
      return;
    }

    // Ctrl+X để thoát nano editor (hoặc các editor khác)
    if (e.key === "x" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (wsRef.current && connected) {
        // Gửi Ctrl+X character (0x18)
        wsRef.current.send(String.fromCharCode(24));
      }
      return;
    }

    // Ctrl+O để save trong nano
    if (e.key === "o" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (wsRef.current && connected) {
        // Gửi Ctrl+O character (0x0F)
        wsRef.current.send(String.fromCharCode(15));
      }
      return;
    }

    // Ctrl+W để search trong nano
    if (e.key === "w" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (wsRef.current && connected) {
        // Gửi Ctrl+W character (0x17)
        wsRef.current.send(String.fromCharCode(23));
      }
      return;
    }

    // Ctrl+K để cut line trong nano
    if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (wsRef.current && connected) {
        // Gửi Ctrl+K character (0x0B)
        wsRef.current.send(String.fromCharCode(11));
      }
      return;
    }

    // Ctrl+U để paste trong nano
    if (e.key === "u" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (wsRef.current && connected) {
        // Gửi Ctrl+U character (0x15)
        wsRef.current.send(String.fromCharCode(21));
      }
      return;
    }

    // Tab completion (có thể mở rộng sau)
    if (e.key === "Tab") {
      e.preventDefault();
      if (wsRef.current && connected) {
        // Gửi Tab character
        wsRef.current.send('\t');
      }
      return;
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    connectWithPassword();
  };

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(24, prev + 2));
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(10, prev - 2));
  };

  const toggleTheme = () => {
    setTerminalTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="w-[85vw] h-[85vh] max-w-[85vw] max-h-[85vh] flex flex-col overflow-hidden p-0"
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <TerminalIcon className="w-5 h-5" />
              Terminal - {server.name} ({server.ipAddress})
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyTerminalContent}
                title="Copy terminal content"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={decreaseFontSize}
                disabled={fontSize <= 10}
                title="Decrease font size"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={increaseFontSize}
                disabled={fontSize >= 24}
                title="Increase font size"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Password Input */}
        {showPasswordInput && !connected && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 p-4 mx-6 border rounded-lg flex-shrink-0">
            <div>
              <Label htmlFor="terminal-password">SSH Password</Label>
              <Input
                id="terminal-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập password để kết nối"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!password}>
                Kết nối
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowPasswordInput(false)}>
                Hủy
              </Button>
            </div>
          </form>
        )}

        {/* Terminal Display */}
        <div
          ref={terminalRef}
          className={`flex-1 min-h-0 min-w-0 ${terminalTheme === 'dark' ? 'bg-black text-green-400' : 'bg-white text-gray-800'} font-mono overflow-hidden mx-6 mb-4 rounded-lg border`}
          style={{ height: 0 }}
        >
          <div
            ref={terminalContentRef}
            onScroll={handleTerminalScroll}
            className="h-full w-full p-4 overflow-y-auto overflow-x-auto"
            style={{
              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
              fontSize: `${fontSize}px`,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: "1.5",
              tabSize: 4,
              margin: 0,
              minWidth: 0,
              userSelect: "text",
            }}
          />
        </div>

        {/* Terminal Input */}
        {connected && (
          <div className="flex flex-col gap-2 flex-shrink-0 px-6 pb-4 pt-2 border-t">
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${terminalTheme === 'dark' ? 'text-green-400' : 'text-gray-600'} font-mono text-sm`}>
                  $
                </span>
                <Input
                  ref={commandInputRef}
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Nhập command... (Ctrl+C: interrupt, Ctrl+D: EOF, Ctrl+L: clear, Ctrl+X: thoát nano, ↑↓: history)"
                  onKeyDown={handleKeyDown}
                  onPaste={(e) => {
                    // Cho phép paste bình thường
                    const pastedText = e.clipboardData.getData('text');
                    // Có thể xử lý multi-line paste ở đây nếu cần
                  }}
                  className={`font-mono pl-8 ${terminalTheme === 'dark' ? 'bg-black text-green-400 border-green-500 focus-visible:ring-green-500' : 'bg-white text-gray-800 border-gray-300 focus-visible:ring-gray-500'}`}
                  disabled={!connected}
                  autoFocus
                  style={{ fontSize: `${fontSize}px` }}
                />
              </div>
              <Button 
                onClick={handleSendCommand}
                disabled={!connected || !commandInput.trim()}
                className="min-w-[80px]"
              >
                Gửi
              </Button>
              <Button variant="outline" onClick={disconnect}>
                <X className="w-4 h-4 mr-2" />
                Đóng
              </Button>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="w-4 h-4"
                />
                Auto-scroll
              </label>
              <button
                onClick={toggleTheme}
                className="hover:text-foreground transition-colors"
              >
                Theme: {terminalTheme === 'dark' ? 'Dark' : 'Light'}
              </button>
              <span>Font: {fontSize}px</span>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        {!connected && !showPasswordInput && (
          <div className="flex justify-end gap-2 px-6 pb-4 flex-shrink-0">
            {connecting ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Đang kết nối bằng SSH key...
              </div>
            ) : (
              <Button variant="outline" onClick={onClose}>
                Đóng
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
