import React, { useState, useEffect } from "react";
import { UserAccount } from "../coach/types";
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  LogOut, 
  Users, 
  Download, 
  Trash2, 
  AlertTriangle,
  KeyRound,
  ShieldAlert
} from "lucide-react";

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onUserChanged: (user: UserAccount | null, token: string | null) => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
}) => {
  const [mode, setMode] = useState<"login" | "register" | "switch" | "gdpr">("login");
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Register form state
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [consentGdpr, setConsentGdpr] = useState(false);

  // Users list state for multi-user switcher
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  
  // UI states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch users list when modal opens or when switching mode
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setAllUsers(data.users);
      }
    } catch (e) {
      console.error("Failed to fetch users list", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      fetchUsers();
      if (!currentUser) {
        setMode("login");
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Password Strength Evaluation Rules (Cybersecurity Guidelines)
  const hasMinLength = regPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(regPassword);
  const hasLowercase = /[a-z]/.test(regPassword);
  const hasNumber = /\d/.test(regPassword);
  const hasSpecial = /[@$!%*?&_\-#]/.test(regPassword);
  const passwordsMatch = regPassword.length > 0 && regPassword === regConfirmPassword;

  const passedRulesCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  
  const getPasswordStrength = () => {
    if (passedRulesCount === 0) return { label: "Nenhuma", color: "bg-slate-700", text: "text-slate-400", percent: 0 };
    if (passedRulesCount <= 2) return { label: "Fraca", color: "bg-rose-500", text: "text-rose-400", percent: 30 };
    if (passedRulesCount <= 4) return { label: "Média", color: "bg-amber-500", text: "text-amber-400", percent: 70 };
    return { label: "Forte (Cybersegura)", color: "bg-emerald-500", text: "text-emerald-400", percent: 100 };
  };

  const strength = getPasswordStrength();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha na autenticação.");
      }

      // Store session token
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_id", data.user.id);
      onUserChanged(data.user, data.token);

      setSuccessMsg("Autenticado com sucesso!");
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao efetuar login.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regFirstName.trim() || !regLastName.trim()) {
      setErrorMsg("Informe o nome e o sobrenome.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    if (passedRulesCount < 5) {
      setErrorMsg("A senha precisa atender a todos os requisitos de segurança cibernética.");
      return;
    }

    if (!consentGdpr) {
      setErrorMsg("É necessário aceitar os termos de consentimento da LGPD / GDPR.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: regFirstName,
          lastName: regLastName,
          email: regEmail,
          password: regPassword,
          consentGdpr: true,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao registrar usuário.");
      }

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_id", data.user.id);
      onUserChanged(data.user, data.token);

      setSuccessMsg("Conta criada com criptografia segura PBKDF2 e consentimento GDPR salvo!");
      fetchUsers();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao registrar usuário.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_id");
    onUserChanged(null, null);
    setSuccessMsg("Sessão encerrada.");
    setMode("login");
  };

  const handleSwitchUser = (user: UserAccount) => {
    // Quick switch active profile
    onUserChanged(user, null);
    setSuccessMsg(`Alternado para o perfil de ${user.firstName} ${user.lastName}`);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleGdprExport = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/user/gdpr-export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao exportar dados.");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus_dados_gdpr_${currentUser?.firstName || "atleta"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setSuccessMsg("Exportação dos seus dados pessoais concluída com sucesso (GDPR Art. 15/20).");
    } catch (e: any) {
      setErrorMsg(e.message || "Erro no download do relatório GDPR.");
    }
  };

  const handleGdprDeleteAccount = async () => {
    if (!window.confirm("ATENÇÃO: Esta ação é permanente e irreversível. Todos os seus dados, histórico de treinos e perfil serão apagados permanentemente conforme o GDPR Art. 17 (Direito ao Esquecimento). Deseja continuar?")) {
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/user/gdpr-delete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erro ao excluir conta.");

      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_id");
      onUserChanged(null, null);
      setSuccessMsg("Sua conta e dados pessoais foram completamente excluídos.");
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: any) {
      setErrorMsg(e.message || "Erro ao solicitar exclusão GDPR.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden space-y-5">
        
        {/* Header with Title & Close button */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Acesso & Privacidade Multi-usuário
              </h2>
              <p className="text-xs text-slate-400">
                Segurança cibernética com criptografia PBKDF2 e conformidade LGPD/GDPR
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => { setMode("login"); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-lg font-medium transition-all text-center ${
              mode === "login" ? "bg-cyan-500 text-black font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode("register"); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-lg font-medium transition-all text-center ${
              mode === "register" ? "bg-cyan-500 text-black font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Cadastrar
          </button>
          <button
            onClick={() => { setMode("switch"); setErrorMsg(null); setSuccessMsg(null); fetchUsers(); }}
            className={`py-2 px-1 rounded-lg font-medium transition-all text-center ${
              mode === "switch" ? "bg-cyan-500 text-black font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Usuários ({allUsers.length})
          </button>
          <button
            onClick={() => { setMode("gdpr"); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 px-1 rounded-lg font-medium transition-all text-center ${
              mode === "gdpr" ? "bg-cyan-500 text-black font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            GDPR / LGPD
          </button>
        </div>

        {/* Alert Messages */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-shake">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>{successMsg}</div>
          </div>
        )}

        {/* TAB 1: LOGIN */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="exemplo@atleta.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showLoginPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? "Autenticando..." : "Entrar com Segurança"}
            </button>

            {currentUser && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Logado como: <strong className="text-white">{currentUser.firstName} {currentUser.lastName}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sair da conta
                </button>
              </div>
            )}
          </form>
        )}

        {/* TAB 2: REGISTER */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  placeholder="Ex: Helder"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Sobrenome
                </label>
                <input
                  type="text"
                  required
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  placeholder="Ex: Alex"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                E-mail Institucional / Pessoal
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="atleta@exemplo.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Criar Senha Fortalecida
              </label>
              <div className="relative">
                <input
                  type={showRegPassword ? "text" : "password"}
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {regPassword.length > 0 && (
                <div className="mt-2 space-y-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-mono">Força da Senha:</span>
                    <span className={`font-bold ${strength.text}`}>{strength.label}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${strength.percent}%` }}
                    />
                  </div>
                  
                  {/* Password Checklist */}
                  <div className="grid grid-cols-2 gap-1 pt-1 text-[10px] font-mono">
                    <span className={hasMinLength ? "text-emerald-400" : "text-slate-500"}>
                      {hasMinLength ? "✓" : "○"} Mínimo 8 caracteres
                    </span>
                    <span className={hasUppercase ? "text-emerald-400" : "text-slate-500"}>
                      {hasUppercase ? "✓" : "○"} Maiúscula (A-Z)
                    </span>
                    <span className={hasLowercase ? "text-emerald-400" : "text-slate-500"}>
                      {hasLowercase ? "✓" : "○"} Minúscula (a-z)
                    </span>
                    <span className={hasNumber ? "text-emerald-400" : "text-slate-500"}>
                      {hasNumber ? "✓" : "○"} Número (0-9)
                    </span>
                    <span className={`col-span-2 ${hasSpecial ? "text-emerald-400" : "text-slate-500"}`}>
                      {hasSpecial ? "✓" : "○"} Caractere especial (@, $, !, %, *, ?, &, _, -, #)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Confirmar Senha
              </label>
              <input
                type="password"
                required
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-sm text-white focus:outline-none ${
                  regConfirmPassword.length > 0
                    ? passwordsMatch
                      ? "border-emerald-500"
                      : "border-rose-500"
                    : "border-slate-700"
                }`}
              />
            </div>

            {/* GDPR Consent Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer bg-slate-950 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  checked={consentGdpr}
                  onChange={(e) => setConsentGdpr(e.target.checked)}
                  className="mt-0.5 rounded text-cyan-500 focus:ring-cyan-400 bg-slate-900 border-slate-700"
                />
                <span className="text-xs text-slate-300 leading-snug">
                  Concordo com os <strong>Termos de Privacidade e GDPR / LGPD</strong>. Entendo que meus dados biométricos e esportivos serão criptografados e poderei solicitar exportação ou exclusão total a qualquer momento.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !consentGdpr}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm transition-all shadow-lg disabled:opacity-50"
            >
              {isLoading ? "Criando Conta..." : "Cadastrar com Criptografia Segura"}
            </button>
          </form>
        )}

        {/* TAB 3: MULTI-USER SWITCHER */}
        {mode === "switch" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Usuários Cadastrados no Banco</span>
              <span className="font-mono text-cyan-400">{allUsers.length} perfil(is)</span>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
              {allUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id || currentUser?.email === u.email;
                return (
                  <div
                    key={u.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isCurrent
                        ? "bg-cyan-500/10 border-cyan-500/50 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-cyan-300 text-xs">
                        {u.firstName?.[0] || u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-1.5">
                          {u.firstName} {u.lastName}
                          {isCurrent && (
                            <span className="text-[10px] bg-cyan-500 text-black px-1.5 py-0.2 rounded font-mono font-bold">
                              Ativo
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => handleSwitchUser(u)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        Alternar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: PRIVACY & GDPR CONTROLS */}
        {mode === "gdpr" && (
          <div className="space-y-4">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                Direitos do Titular de Dados (LGPD / GDPR)
              </div>
              <p className="text-slate-400 leading-relaxed">
                Suas informações de saúde e telemetria esportiva são armazenadas com algoritmo de hash <strong>PBKDF2 SHA-512</strong> com salt de 128 bits.
              </p>
            </div>

            <div className="space-y-3">
              {/* Export Data */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-cyan-400" /> Direito de Portabilidade (Art. 15 / 20)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Baixe um relatório JSON com todo o seu histórico de perfil e treinos.
                  </div>
                </div>
                <button
                  onClick={handleGdprExport}
                  className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-medium transition-colors shrink-0"
                >
                  Exportar
                </button>
              </div>

              {/* Right to be forgotten */}
              <div className="bg-rose-500/5 p-3.5 rounded-xl border border-rose-500/20 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-rose-300 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Direito ao Esquecimento (Art. 17)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Exclua permanentemente sua conta e limpe todos os seus registros do servidor.
                  </div>
                </div>
                <button
                  onClick={handleGdprDeleteAccount}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-medium transition-colors shrink-0"
                >
                  Excluir Conta
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
