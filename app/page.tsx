import GymTracker from "./GymTracker";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const name = user
    ? (user.fullName?.trim().split(/\s+/)[0] ?? user.email.split("@")[0])
    : null;

  return (
    <GymTracker
      signInPath={chatGPTSignInPath("/")}
      signOutPath={chatGPTSignOutPath("/")}
      user={user ? { email: user.email, name: name ?? "Athlete" } : null}
    />
  );
}
