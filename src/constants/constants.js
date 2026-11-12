const USER_TYPES = {
  PERSONAL: "personal",
  COMPANY: "company",
  INDIVIDUAL: "individual",
  CLIENT: "client",
  ADMIN: "admin"
};

const KYC_STATUS_LIST = {
  PENDING: "pending",
  INPROGRESS: "inprogress",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const PHASE_A_COMPANY_NAME = "NGC";

module.exports = { USER_TYPES, KYC_STATUS_LIST, PHASE_A_COMPANY_NAME };
