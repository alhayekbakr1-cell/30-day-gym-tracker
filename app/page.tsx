import GymTracker from "./GymTracker";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const activeUser =
    user ??
    (process.env.NODE_ENV === "development"
      ? { email: "preview@gym.local", fullName: "Preview Athlete" }
      : null);
  const name = activeUser
    ? (activeUser.fullName?.trim().split(/\s+/)[0] ??
      activeUser.email.split("@")[0])
    : null;

  return (
    <GymTracker
      signInPath={chatGPTSignInPath("/")}
      signOutPath={chatGPTSignOutPath("/")}
      user={
        activeUser
          ? { email: activeUser.email, name: name ?? "Athlete" }
          : null
      }
    />
  );
}
