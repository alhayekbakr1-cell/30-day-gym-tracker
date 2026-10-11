import GymTracker from "../GymTracker";
export const dynamic = "force-dynamic";
/** This route intentionally renders no identity or personal records, even online. */
// Full navigation is required to recheck server identity after offline startup.
/* eslint-disable @next/next/no-html-link-for-pages -- full reload confirms identity instead of reusing offline client state */
export default function Offline() {
  return <div data-offline-shell="generic"><div className="offline-start" role="status"><strong>Offline app shell</strong><p>Reconnect and open the tracker to confirm your ChatGPT account. Personal records stay hidden until then. Previously saved device drafts have not been removed.</p><a href="/" target="_top">Reconnect to my tracker</a></div><GymTracker user={null} signInPath="/signin-with-chatgpt?return_to=%2F" signOutPath="/signout-with-chatgpt?return_to=%2F" /></div>;
}
