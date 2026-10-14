/** Sign-in pages: two big tiles side by side, stacked on phones. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-1 flex-wrap gap-4 bg-board p-3 sm:p-4">{children}</main>
  );
}
