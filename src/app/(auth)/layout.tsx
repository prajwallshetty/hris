export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      {children}
    </div>
  );
}
