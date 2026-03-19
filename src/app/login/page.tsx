import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a1628] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[rgba(226,232,240,0.12)] bg-[rgba(255,255,255,0.04)] p-8 text-center shadow-xl backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-[#f8fbff]">
          מאקרו ישראל
        </h1>
        <p className="mt-3 text-sm text-[#c7dde6]">
          יש להתחבר כדי להמשיך
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
        >
          <button
            className="mt-8 w-full rounded-full bg-[#2563eb] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#1d4ed8]"
            type="submit"
          >
            התחברות עם Microsoft
          </button>
        </form>
      </div>
    </main>
  );
}
