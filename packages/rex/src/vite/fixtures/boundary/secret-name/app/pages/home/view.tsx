const runtimeConfig = (globalThis as { __NOTES_CONFIG__?: Record<string, string> }).__NOTES_CONFIG__ ?? {};
const stripeKey = runtimeConfig.STRIPE_SECRET_KEY;

export default function View() {
  return <p>{stripeKey === undefined ? "no key" : "key"}</p>;
}
