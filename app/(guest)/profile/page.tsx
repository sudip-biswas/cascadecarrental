import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const instant = false;
export const metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cascade-900">Your profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information and preferences.
        </p>
      </div>
      <ProfileForm profile={profile} userEmail={user.email ?? ""} />
    </div>
  );
}
