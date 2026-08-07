import { optimize, type OptimizerInput, type OptimizerResult } from './optimizer';

interface OptimizerRequest {
  readonly requestId: number;
  readonly input: OptimizerInput;
}

interface OptimizerResponse {
  readonly requestId: number;
  readonly result?: OptimizerResult;
  readonly error?: string;
}

self.addEventListener('message', (event: MessageEvent<OptimizerRequest>) => {
  const { requestId, input } = event.data;
  let response: OptimizerResponse;
  try {
    response = { requestId, result: optimize(input) };
  } catch (error) {
    response = {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  self.postMessage(response);
});
