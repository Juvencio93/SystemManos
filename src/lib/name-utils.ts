export interface Profile {
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
}

export interface Company {
  name: string;
  trade_name?: string | null;
  legal_name?: string | null;
}

export interface Branch {
  name: string;
  trade_name?: string | null;
  legal_name?: string | null;
}

/**
 * Fonte de dados para saudações.
 * Aceita tanto o formato camelCase (Frontend/useAccess) quanto snake_case (Database/Backend).
 */
export type GreetingSource = {
  displayName?: string | null;
  fullName?: string | null;
  display_name?: string | null;
  full_name?: string | null;
};

/**
 * Retorna o nome de saudação do usuário.
 * Prioridade:
 * 1. displayName / display_name (escolhido pelo usuário)
 * 2. fullName / full_name (nome completo)
 * 3. Primeiro nome do full_name
 * 4. Texto genérico baseado no papel
 */
export function getUserGreetingName(
  profile: GreetingSource | null,
  fallbackRole: string = "Usuário",
): string {
  if (!profile) return fallbackRole;

  const displayName = profile.displayName?.trim() || profile.display_name?.trim();
  if (displayName) return displayName;

  const fullName = profile.fullName?.trim() || profile.full_name?.trim();
  if (fullName) {
    const firstName = fullName.split(" ")[0];
    return firstName || fullName;
  }

  return fallbackRole;
}

/**
 * Retorna o nome fantasia oficial da empresa (Matriz).
 * Prioridade:
 * 1. trade_name (Nome Fantasia)
 * 2. legal_name (Razão Social)
 * 3. name (Campo de nome legado)
 */
export function getCompanyDisplayName(company: Company | null): string {
  if (!company) return "Empresa sem nome";

  return (
    company.trade_name?.trim() ||
    company.legal_name?.trim() ||
    company.name?.trim() ||
    "Empresa sem nome"
  );
}

/**
 * Retorna o nome fantasia oficial da filial.
 * Prioridade:
 * 1. trade_name da filial
 * 2. legal_name da filial
 * 3. name da filial
 */
export function getBranchDisplayName(branch: Branch | null): string {
  if (!branch) return "Filial sem nome";

  return (
    branch.trade_name?.trim() ||
    branch.legal_name?.trim() ||
    branch.name?.trim() ||
    "Filial sem nome"
  );
}
