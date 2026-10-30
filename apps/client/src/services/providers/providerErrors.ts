import type { ProviderError } from "@resonara/contracts";

export class ProviderRequestError
  extends Error
  implements ProviderError
{
  readonly code: ProviderError["code"];
  readonly status: number | null;

  constructor(
    code: ProviderError["code"],
    message: string,
    status: number | null,
  ) {
    super(message);
    this.name = "ProviderRequestError";
    this.code = code;
    this.status = status;
  }
}
