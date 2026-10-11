import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cascade-100 flex flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cascade-700 rounded-md" />
          <span className="text-xl font-bold text-cascade-900">Cascade</span>
        </div>
      </Link>
      {children}
    </div>
  );
}
