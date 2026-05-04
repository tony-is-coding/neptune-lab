import { Link, useNavigate } from "react-router-dom";

export function Login() {
  const navigate = useNavigate();
  
  return (
    <div className="bg-parchment min-h-screen flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[440px] bg-ivory rounded-lg p-10 shadow-whisper border border-surface-container flex flex-col items-center">
        
        <div className="flex items-center gap-3 mb-10">
          <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>water</span>
          <span className="text-2xl font-bold text-charcoal">Neptune-AI</span>
        </div>
        
        <div className="text-center mb-10">
          <h1 className="font-serif text-[32px] leading-tight font-medium text-charcoal mb-2">Welcome back</h1>
          <p className="text-[15px] text-stone">Please enter your details to sign in.</p>
        </div>
        
        <div className="w-full space-y-6">
          <button className="w-full flex items-center justify-center gap-3 py-2.5 px-6 bg-white border border-border-cream rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-charcoal">
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            <span className="text-[14px] font-semibold text-charcoal">Sign in with Google</span>
          </button>
          
          <div className="relative flex items-center py-3">
            <div className="flex-grow border-t border-border-cream"></div>
            <span className="flex-shrink-0 mx-6 text-[13px] text-stone bg-ivory px-2">or sign in with email</span>
            <div className="flex-grow border-t border-border-cream"></div>
          </div>
          
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); navigate('/'); }}>
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-charcoal" htmlFor="email">Email</label>
              <input className="w-full bg-white border border-border-cream rounded-lg px-3 py-2.5 text-[15px] text-charcoal focus:outline-none focus:border-charcoal focus:ring-1 focus:ring-charcoal transition-colors placeholder:text-gray-400" id="email" placeholder="Enter your email" type="email"/>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-charcoal" htmlFor="password">Password</label>
              <input className="w-full bg-white border border-border-cream rounded-lg px-3 py-2.5 text-[15px] text-charcoal focus:outline-none focus:border-charcoal focus:ring-1 focus:ring-charcoal transition-colors placeholder:text-gray-400" id="password" placeholder="••••••••" type="password"/>
            </div>
            
            <div className="flex items-center justify-between pt-1 pb-2">
              <div className="flex items-center gap-2">
                <input className="w-4 h-4 rounded border-border-cream text-charcoal focus:ring-charcoal bg-white" id="remember" type="checkbox"/>
                <label className="text-[14px] text-stone cursor-pointer" htmlFor="remember">Remember for 30 days</label>
              </div>
              <p className="text-[14px] font-medium text-charcoal hover:text-brand transition-colors cursor-pointer">Forgot password?</p>
            </div>
            
            <button className="w-full bg-charcoal text-ivory py-2.5 px-6 rounded-lg text-[14px] font-semibold hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-charcoal" type="submit">
              Sign in
            </button>
          </form>
        </div>
        
        <div className="mt-10 text-center">
          <span className="text-[14px] text-stone">Don't have an account? </span>
          <p className="text-[14px] font-medium text-charcoal hover:text-brand transition-colors cursor-pointer inline-block">Sign up</p>
        </div>
      </div>
    </div>
  );
}
