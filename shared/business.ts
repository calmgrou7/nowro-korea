export type BusinessData = {
  businessName: string;
  areaId: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  description: string;
  consent: boolean;
};
export type BusinessApplication = {
  id: string;
  data: BusinessData;
  status: "pending" | "approved" | "rejected" | "revoked";
  revision: number;
  reviewNote: string;
  verificationMethod: string;
  reviewedAt: string | null;
  created: string;
  updated: string;
};
