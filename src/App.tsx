import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { getCurrent } from '@tauri-apps/api/window';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/api/notification';
import { listen } from '@tauri-apps/api/event';
import { Minus, Square, X, Home, Settings as SettingsIcon, Activity, CheckCircle2, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { DEFAULT_SETTINGS, type PlatformConfig } from './shared-types/index';
import logo from './extension/assets/logo-transparent.png';
import './App.css';

const appWindow = getCurrent();

function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
  const [platforms, setPlatforms] = useState<PlatformConfig[]>(DEFAULT_SETTINGS.platforms);
  const [installStatus, setInstallStatus] = useState<{msg: string, isError: boolean} | null>(null);
  const [installing, setInstalling] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectCooldown, setReconnectCooldown] = useState(0);
  const [isDiscordConnected, setIsDiscordConnected] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(() => {
    return localStorage.getItem('zar-privacy-mode') === 'true';
  });
  
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('zar-theme') as 'system' | 'light' | 'dark') || 'system';
  });
  const [systemIsDark, setSystemIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  const isDark = theme === 'system' ? systemIsDark : theme === 'dark';

  // Remove the tray label check as we use native tray now

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('zar-theme', theme);
  }, [theme]);

  useEffect(() => {
    invoke('is_autostart_enabled').then(enabled => setAutostart(enabled as boolean));
  }, []);

  const handleToggleAutostart = async () => {
    const newState = !autostart;
    try {
      await invoke('set_autostart', { enabled: newState });
      setAutostart(newState);
    } catch (error) {
      console.error('Failed to set autostart:', error);
    }
  };

  useEffect(() => {
    invoke('change_theme', { isDark }).catch(console.error);
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('zar-privacy-mode', privacyMode.toString());
    invoke('set_privacy_mode', { enabled: privacyMode }).catch(console.error);
  }, [privacyMode]);

  useEffect(() => {
    const setupListeners = async () => {
      // Discord connection status from Rust
      const unlistenStatus = await listen('discord-status', (event: { payload: any }) => {
        setIsDiscordConnected(!!event.payload);
      });

      const unlistenNotFound = await listen('discord-not-found', async () => {
        const audio = new Audio('https://rpg.hamsterrepublic.com/wiki-images/d/db/Suitcase_Open.ogg');
        audio.volume = 0.5;
        audio.play().catch(() => {});

        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }
        
        if (permissionGranted) {
          sendNotification({ 
            title: 'Discord Not Detected', 
            body: 'ZarPresence is ready, but Discord isn\'t running. We\'ll start syncing the moment you open it!' 
          });
        }
      });

      return () => {
        unlistenStatus();
        unlistenNotFound();
      };
    };

    const cleanupPromise = setupListeners();
    return () => {
      cleanupPromise.then(cleanup => cleanup());
    };
  }, []);

  const togglePlatform = (id: string) => {
    setPlatforms(platforms.map(p => 
      p.id === id ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const handleInstallExtension = async () => {
    setInstalling(true);
    setInstallStatus(null);
    try {
      const response: string = await invoke('force_install_extension');
      setInstallStatus({ msg: response, isError: false });
    } catch (error: any) {
      setInstallStatus({ msg: error.toString(), isError: true });
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    if (reconnectCooldown > 0) {
      const timer = setTimeout(() => setReconnectCooldown(reconnectCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [reconnectCooldown]);

  const handleReconnectRPC = async () => {
    if (reconnectCooldown > 0 || reconnecting) return;
    setReconnecting(true);
    try {
      await invoke('reconnect_rpc');
      setReconnectCooldown(5);
    } catch (error: any) {
      setReconnectCooldown(5);
    } finally {
      setReconnecting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable Ctrl+P (Print), Ctrl+S (Save), Ctrl+Shift+I/C/J (DevTools), F12 (DevTools)
      const isDevToolsKey = e.key === 'F12' || 
                            (e.ctrlKey && e.shiftKey && ['i', 'I', 'c', 'C', 'j', 'J'].includes(e.key)) ||
                            (e.ctrlKey && ['p', 'P', 's', 'S'].includes(e.key));
      
      if (isDevToolsKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Add with capture: true to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    // Global context menu block just in case React's synthetic event is bypassed
    window.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });
    };
  }, []);

  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      className={`flex flex-col h-screen overflow-hidden select-none transition-colors duration-500 ${isDark ? 'text-slate-100 bg-[#0f111a]' : 'text-slate-900 bg-slate-50'}`}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${isDark ? 'opacity-100 bg-gradient-to-br from-[#0f111a] to-[#1a1b26]' : 'opacity-100 bg-gradient-to-br from-slate-100 to-blue-50'}`}></div>
      
      {/* Custom Titlebar */}
      <div data-tauri-drag-region className={`h-10 shrink-0 backdrop-blur-xl flex items-center justify-between px-3 border-b z-50 transition-colors ${isDark ? 'bg-black/40 border-white/5' : 'bg-white/40 border-slate-200'}`}>
        <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
          <img src={logo} alt="ZarPresence" className="w-5 h-5 object-contain" />
          <span className={`text-xs font-bold tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ZARPRESENCE</span>
        </div>
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-4 h-4 object-contain opacity-40 hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-1">
          <button onClick={() => appWindow.minimize()} className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-600 hover:text-black'}`}>
            <Minus size={14} />
          </button>
          <button onClick={() => appWindow.toggleMaximize()} className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-600 hover:text-black'}`}>
            <Square size={13} />
          </button>
          <button onClick={() => appWindow.close()} className="p-1.5 hover:bg-red-500 rounded-md transition-colors text-slate-400 hover:text-white group">
            <X size={15} className="group-hover:text-white" />
          </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden z-10 relative">
        <aside className={`flex flex-col border-r transition-all duration-500 overflow-hidden shrink-0 ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'} ${activeTab === 'home' ? 'w-16 sm:w-20 md:w-64' : 'w-16 sm:w-64'}`}>
          <div className="flex-1 py-8 px-3 sm:px-4">
            <div className="space-y-3">
              <button
                onClick={handleReconnectRPC}
                disabled={reconnecting || reconnectCooldown > 0}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group bg-blue-600/10 border border-blue-500/20 text-blue-500 hover:bg-blue-600 hover:text-white disabled:opacity-30 mb-6`}
              >
                <RefreshCw size={22} className={`shrink-0 ${reconnecting ? 'animate-spin' : ''}`} />
                <span className="font-bold tracking-tight whitespace-nowrap">
                  {reconnecting ? 'SYNCING...' : reconnectCooldown > 0 ? `WAIT ${reconnectCooldown}S` : 'RECONNECT RPC'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('home')}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${activeTab === 'home' ? (isDark ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)]' : 'bg-blue-600 text-white shadow-lg shadow-blue-200') : (isDark ? 'text-slate-500 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-900 hover:bg-white')}`}
              >
                <Home size={22} className="shrink-0 group-hover:scale-110 transition-transform" />
                <span className={`font-bold tracking-tight whitespace-nowrap transition-opacity duration-300 ${activeTab === 'home' ? 'hidden md:block' : 'hidden sm:block'}`}>Dashboard</span>
              </button>
              
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${activeTab === 'settings' ? (isDark ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)]' : 'bg-blue-600 text-white shadow-lg shadow-blue-200') : (isDark ? 'text-slate-500 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-900 hover:bg-white')}`}
              >
                <SettingsIcon size={22} className="shrink-0 group-hover:rotate-45 transition-transform duration-500" />
                <span className={`font-bold tracking-tight whitespace-nowrap transition-opacity duration-300 ${activeTab === 'home' ? 'hidden md:block' : 'hidden sm:block'}`}>Settings</span>
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t border-white/5">
             <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${isDiscordConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                <ShieldCheck size={18} className="shrink-0" />
                <span className={`text-[10px] font-black tracking-widest whitespace-nowrap transition-opacity duration-300 ${activeTab === 'home' ? 'hidden md:block' : 'hidden sm:block'}`}>RPC {isDiscordConnected ? 'ACTIVE' : 'OFFLINE'}</span>
             </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-8 md:p-12">
          
          {activeTab === 'home' && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8 max-w-5xl mx-auto">
              <div>
                <h1 className={`text-4xl sm:text-5xl md:text-6xl font-black mb-2 tracking-tighter transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Zar<span className="text-blue-600">Presence</span>
                </h1>
                <p className={`text-sm sm:text-base font-medium opacity-70 transition-colors ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Modern Discord Rich Presence, redefined.</p>
              </div>

              <div className={`rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 border shadow-2xl transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                <h2 className={`text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  <Activity className="text-blue-500 shrink-0" size={24} /> 
                  <span className="truncate">Active Platforms</span>
                </h2>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                  {platforms.map(platform => (
                    <div key={platform.id} className={`group relative flex items-center justify-between p-5 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all duration-300 ${isDark ? 'bg-black/40 border-white/5 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-blue-300 shadow-sm'}`}>
                      <div className="flex items-center gap-4 sm:gap-5 overflow-hidden">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl transition-all flex items-center justify-center shadow-inner ${platform.enabled ? (platform.id === 'youtube' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500') : (isDark ? 'bg-white/5 text-slate-600' : 'bg-white text-slate-300')}`}>
                          {platform.id === 'youtube' ? (
                            <svg className="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.377.505 9.377.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 48 48">
                              <path fill="currentColor" d="M9,26.5C9,16.835,16.835,9,26.5,9c9.243,0,16.793,7.171,17.437,16.25 C43.963,24.834,44,24.422,44,24c0-11.046-8.954-20-20-20S4,12.954,4,24c0,11.046,8.954,20,20,20c0.422,0,0.834-0.037,1.25-0.063 C16.171,43.293,9,35.743,9,26.5z"></path>
                              <path fill="currentColor" d="M36.5,28c-3.59,0-6.5-2.91-6.5-6.5c0-2.637,1.573-4.902,3.829-5.921 C31.941,14.574,29.788,14,27.5,14C20.044,14,14,20.044,14,27.5C14,34.956,20.044,41,27.5,41S41,34.956,41,27.5 c0-0.425-0.025-0.844-0.064-1.259C39.774,27.329,38.217,28,36.5,28z"></path>
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col overflow-hidden min-w-0">
                          <h3 className={`font-bold text-lg sm:text-xl truncate transition-colors ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{platform.name}</h3>
                          <span className={`text-[9px] sm:text-[10px] uppercase font-black tracking-[0.2em] mt-0.5 ${platform.enabled ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-slate-600' : 'text-slate-400')}`}>
                            {platform.enabled ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer scale-100 sm:scale-110 shrink-0 ml-2">
                        <input type="checkbox" className="sr-only peer" checked={platform.enabled} onChange={() => togglePlatform(platform.id)} />
                        <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all shadow-md ${isDark ? 'bg-slate-800 after:border-slate-300 peer-checked:bg-blue-600' : 'bg-slate-200 after:border-slate-100 peer-checked:bg-blue-500'}`}></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex flex-col gap-8 max-w-5xl mx-auto">
              <div>
                <h1 className={`text-4xl sm:text-5xl font-black mb-2 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</h1>
                <p className={`text-sm sm:text-base font-medium opacity-60 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Personalize your ZarPresence experience.</p>
              </div>

              {/* Privacy & Security (Moved to top) */}
              <div className={`rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 border shadow-2xl transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                <h2 className={`text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  <ShieldCheck className="text-blue-500" size={24} />
                  Privacy & Security
                </h2>
                <div className="space-y-6">
                  <div className={`flex items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border transition-colors ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="overflow-hidden pr-2">
                      <h3 className={`font-black text-sm sm:text-base tracking-tight truncate transition-colors ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>Privacy Mode</h3>
                      <p className={`text-[10px] sm:text-xs font-medium mt-1 opacity-60 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Hides specific video titles and timestamps from your Discord status.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer scale-110 shrink-0">
                      <input type="checkbox" className="sr-only peer" checked={privacyMode} onChange={() => setPrivacyMode(!privacyMode)} />
                      <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all shadow-md ${isDark ? 'bg-slate-800 after:border-slate-300 peer-checked:bg-blue-600' : 'bg-slate-200 after:border-slate-100 peer-checked:bg-blue-500'}`}></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Theme Settings */}
              <div className={`rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 border shadow-2xl transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                <h2 className={`text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  Theme Appearance
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                  {(['system', 'light', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${theme === t ? (isDark ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-blue-600/10 border-blue-600 text-blue-600 shadow-sm') : (isDark ? 'bg-black/20 border-white/5 text-slate-500 hover:text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800')}`}
                    >
                      <span className="capitalize font-black text-[10px] sm:text-xs tracking-widest">{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 border shadow-2xl transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                <h2 className={`text-xl sm:text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Browser Integration</h2>
                <p className={`mb-6 sm:mb-8 text-xs sm:text-sm font-medium leading-relaxed opacity-70 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                  The ZarPresence browser extension must be installed in Chrome, Edge, or Brave to track your activity and stream it to Discord.
                </p>
                
                <button 
                  onClick={handleInstallExtension}
                  disabled={installing}
                  className={`relative overflow-hidden w-full sm:w-auto px-8 py-4 font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase rounded-xl transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_40px_rgba(37,99,235,0.4)]' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl'}`}
                >
                  {installing ? 'INSTALLING...' : 'INSTALL EXTENSION'}
                </button>
                
                {installStatus && (
                  <div className={`mt-6 sm:mt-8 p-5 sm:p-6 rounded-2xl flex items-center gap-4 text-xs sm:text-sm font-bold animate-in fade-in zoom-in-95 ${installStatus.isError ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                    {installStatus.isError ? <AlertCircle size={20} className="shrink-0" /> : <CheckCircle2 size={20} className="shrink-0" />}
                    <span className="leading-relaxed break-all">{installStatus.msg}</span>
                  </div>
                )}
              </div>
              
              <div className={`rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 border shadow-2xl transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                 <h2 className={`text-xl sm:text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-800'}`}>System Behavior</h2>
                 <div className="space-y-4">
                    <div className={`flex items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border transition-colors ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                       <div className="overflow-hidden pr-2">
                         <h3 className={`font-black text-sm sm:text-base tracking-tight truncate transition-colors ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>Run in Background</h3>
                         <p className={`text-[10px] sm:text-xs font-medium mt-1 opacity-60 truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Stays active in system tray when closed.</p>
                       </div>
                       <div className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[8px] sm:text-[9px] font-black tracking-[0.15em] sm:tracking-[0.2em] border ${isDark ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' : 'text-blue-600 bg-blue-600/5 border-blue-600/20'}`}>ALWAYS ACTIVE</div>
                    </div>

                    <div className={`flex items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border transition-colors ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                       <div className="overflow-hidden pr-2">
                         <h3 className={`font-black text-sm sm:text-base tracking-tight truncate transition-colors ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>Launch on Startup</h3>
                         <p className={`text-[10px] sm:text-xs font-medium mt-1 opacity-60 truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Automatically start ZarPresence with Windows.</p>
                       </div>
                       <label className="relative inline-flex items-center cursor-pointer scale-110 shrink-0">
                        <input type="checkbox" className="sr-only peer" checked={autostart} onChange={handleToggleAutostart} />
                        <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all shadow-md ${isDark ? 'bg-slate-800 after:border-slate-300 peer-checked:bg-blue-600' : 'bg-slate-200 after:border-slate-100 peer-checked:bg-blue-500'}`}></div>
                      </label>
                    </div>
                  </div>
              </div>
            </div>
          )}


        </main>
      </div>
    </div>
  );
}
export default App;