export const LEGAL_DOCUMENTS = {
  privacyPolicy: { version: "1.2", updatedAt: "10 de novembro de 2026" },
  termsOfUse: { version: "1.2", updatedAt: "10 de novembro de 2026" },
  dataSubjectRights: { version: "1.1", updatedAt: "28 de outubro de 2026" },
  refundPolicy: { version: "1.0", updatedAt: "10 de novembro de 2026" },
  cookiePolicy: { version: "1.0", updatedAt: "10 de novembro de 2026" },
} as const;

export const PRIVACY_POLICY_VERSION = LEGAL_DOCUMENTS.privacyPolicy.version;
