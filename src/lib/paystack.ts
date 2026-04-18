declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref?: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose?: () => void;
      }) => { openIframe: () => void };
    };
  }
}

const PAYSTACK_JS_URL = "https://js.paystack.co/v1/inline.js";

let paystackScriptPromise: Promise<void> | null = null;

const loadPaystackScript = (): Promise<void> => {
  if (window.PaystackPop) return Promise.resolve();
  if (paystackScriptPromise) return paystackScriptPromise;

  paystackScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PAYSTACK_JS_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Paystack script")));
      return;
    }

    const script = document.createElement("script");
    script.src = PAYSTACK_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack script"));
    document.body.appendChild(script);
  });

  return paystackScriptPromise;
};

type StartPaystackCheckoutArgs = {
  publicKey: string;
  email: string;
  amountInGhs: number;
  metadata?: Record<string, unknown>;
};

export const startPaystackCheckout = async ({
  publicKey,
  email,
  amountInGhs,
  metadata,
}: StartPaystackCheckoutArgs): Promise<string> => {
  if (!publicKey) throw new Error("Paystack public key is not configured");
  if (!email) throw new Error("Email is required for Paystack checkout");
  if (!Number.isFinite(amountInGhs) || amountInGhs <= 0) throw new Error("Invalid checkout amount");

  await loadPaystackScript();
  if (!window.PaystackPop) throw new Error("Paystack checkout is unavailable right now");

  const amountInKobo = Math.round(amountInGhs * 100);

  return new Promise<string>((resolve, reject) => {
    const handler = window.PaystackPop!.setup({
      key: publicKey,
      email,
      amount: amountInKobo,
      currency: "GHS",
      metadata,
      callback: (response) => resolve(response.reference),
      onClose: () => reject(new Error("Payment cancelled")),
    });

    handler.openIframe();
  });
};
