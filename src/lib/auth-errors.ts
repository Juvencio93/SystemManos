/** Mensagens amigáveis para erros de senha/acesso vindos do Auth. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("weak") || m.includes("easy to guess") || m.includes("pwned")) {
    return "Essa senha é muito fraca ou já apareceu em vazamentos conhecidos. Use ao menos 10 caracteres, misturando letras maiúsculas, minúsculas, números e um símbolo (evite sequências como 123456 ou o nome da empresa).";
  }
  if (m.includes("password should be at least")) {
    return "Senha muito curta. Use ao menos 8 caracteres.";
  }
  if (m.includes("already been registered") || m.includes("already exists")) {
    return "Este e-mail já está cadastrado em outro acesso. Use outro e-mail.";
  }
  return message;
}

/** Validação local básica antes de enviar ao Auth. */
export function weakPasswordReason(password: string): string | null {
  if (password.length < 8) return "Senha precisa ter ao menos 8 caracteres.";
  const common = [
    "12345678",
    "123456789",
    "1234567890",
    "senha123",
    "password",
    "password1",
    "qwerty123",
    "abc12345",
    "manostech",
    "manostech123",
  ];
  if (common.includes(password.toLowerCase())) {
    return "Essa senha é muito comum. Escolha uma senha mais forte.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Combine letras e números na senha de acesso.";
  }
  return null;
}
