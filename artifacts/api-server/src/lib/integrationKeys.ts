// Server-side integration key constants — mirrors client-side integrationConfig.ts
export const INTEGRATION_KEYS = {
  DOCUMENT_INTAKE:        "document_intake_webhook",
  DOCUMENT_RETRIEVAL:     "document_retrieval_webhook",
  WORKFLOW_UPDATES:       "workflow_updates_webhook",
  FINANCIAL_INGESTION:    "financial_ingestion_webhook",
  EXPENSE_INGESTION:      "expense_ingestion_webhook",
  RECONCILIATION:         "reconciliation_webhook",
  REPORTING:              "reporting_webhook",
  PORTFOLIO_PROVISIONING: "portfolio_provisioning_webhook",
} as const;

export type IntegrationKey = (typeof INTEGRATION_KEYS)[keyof typeof INTEGRATION_KEYS];
