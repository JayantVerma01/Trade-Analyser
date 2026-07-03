export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              TA
            </div>
            <span className="text-xl font-bold text-foreground">Trade Analyser</span>
          </div>
          <p className="text-muted-foreground text-sm">AI-powered Indian Stock Market Assistant</p>
        </div>
        {children}
      </div>
    </div>
  );
}
