const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseJsonSafe = (raw: unknown) => {
  try {
    return JSON.parse(String(raw ?? "{}"));
  } catch {
    return {};
  }
};

export const withBridgeTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "Bridge request timeout"
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });

export const waitForBridgeOperationResult = async (
  bridge: any,
  operationId: string,
  options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
  }
) => {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const pollIntervalMs = options?.pollIntervalMs ?? 180;
  const startedAt = Date.now();

  if (!bridge?.get_async_operation_result) {
    throw new Error("Bridge method get_async_operation_result is unavailable");
  }

  while (Date.now() - startedAt < timeoutMs) {
    const raw = await Promise.resolve(bridge.get_async_operation_result(operationId));
    const state = parseJsonSafe(raw) as {
      status?: string;
      result?: any;
      error?: string;
      message?: string;
    };

    if (state?.status === "success") {
      if (typeof state.result === "string") return parseJsonSafe(state.result);
      return state.result ?? state;
    }

    if (state?.status === "error") {
      throw new Error(state.error || state.message || "Async bridge operation failed");
    }

    await sleep(pollIntervalMs);
  }

  throw new Error("Async bridge operation timeout");
};

export const invokeBridgeMethodJson = async (
  bridge: any,
  methodName: string,
  args: any[] = [],
  options?: {
    kickoffTimeoutMs?: number;
    pollTimeoutMs?: number;
    pollIntervalMs?: number;
  }
) => {
  if (!bridge || typeof bridge[methodName] !== "function") {
    throw new Error(`Bridge method unavailable: ${methodName}`);
  }

  const kickoffTimeoutMs = options?.kickoffTimeoutMs ?? 1500;
  const kickoffRaw = await withBridgeTimeout(
    Promise.resolve(bridge[methodName](...args)),
    kickoffTimeoutMs,
    `${methodName} kickoff timeout`
  );

  const kickoff = parseJsonSafe(kickoffRaw) as {
    status?: string;
    operation_id?: string;
  };

  const operationId = String(kickoff?.operation_id || "");
  if (operationId && (kickoff?.status === "pending" || kickoff?.status === "processing")) {
    return waitForBridgeOperationResult(bridge, operationId, {
      timeoutMs: options?.pollTimeoutMs ?? 15000,
      pollIntervalMs: options?.pollIntervalMs ?? 180,
    });
  }

  return kickoff;
};

