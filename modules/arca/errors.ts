export class ArcaError extends Error {
  constructor(
    message: string,
    public code = "arca.error",
  ) {
    super(message);
  }
}
export class ArcaConfigurationError extends ArcaError {
  constructor(message: string) {
    super(message, "arca.configuration");
  }
}
export class ArcaAuthenticationError extends ArcaError {
  constructor(message: string) {
    super(message, "arca.authentication");
  }
}
export class ArcaWsfeError extends ArcaError {
  constructor(message: string) {
    super(message, "arca.wsfe");
  }
}
export class ArcaTimeoutError extends ArcaError {
  constructor() {
    super("ARCA no respondió dentro del tiempo esperado.", "arca.timeout");
  }
}
export class ArcaRejectedInvoiceError extends ArcaError {
  constructor(message: string) {
    super(message, "arca.rejected");
  }
}
