import { z } from "zod";

export const AsaasCustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  cpfCnpj: z.string(),
  phone: z.string().optional(),
  mobilePhone: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  complement: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  externalReference: z.string().optional(),
  notificationDisabled: z.boolean().optional(),
  additionalEmails: z.string().optional(),
  municipalRegistration: z.string().optional(),
  stateRegistration: z.string().optional(),
  observations: z.string().optional(),
});

export const AsaasPaymentSchema = z.object({
  id: z.string(),
  customer: z.string(),
  value: z.number(),
  netValue: z.number(),
  billingType: z.enum(["BOLETO", "CREDIT_CARD", "PIX", "UNDEFINED"]),
  status: z.string(),
  dueDate: z.string(),
  originalDueDate: z.string(),
  paymentDate: z.string().nullable(),
  clientPaymentDate: z.string().nullable(),
  invoiceUrl: z.string().optional(),
  bankSlipUrl: z.string().nullable(),
  transactionReceiptUrl: z.string().nullable(),
  externalReference: z.string().optional(),
  deleted: z.boolean().optional(),
  anticipated: z.boolean().optional(),
  anticipable: z.boolean().optional(),
  lastInvoiceViewedDate: z.string().nullable(),
  lastBankSlipViewedDate: z.string().nullable(),
  postalService: z.boolean().optional(),
});

export const AsaasPixQrCodeSchema = z.object({
  success: z.boolean(),
  encodedImage: z.string(),
  payload: z.string(),
  expirationDate: z.string(),
});

export type AsaasCustomer = z.infer<typeof AsaasCustomerSchema>;
export type AsaasPayment = z.infer<typeof AsaasPaymentSchema>;
export type AsaasPixQrCode = z.infer<typeof AsaasPixQrCodeSchema>;
