import Link from 'next/link';
import { ArrowRight, CheckCircle2, Bot, Mail, BarChart } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="text-2xl font-bold text-slate-900">Nexus OS</div>
        <div className="space-x-4">
          <Link href="/login" className="text-slate-600 hover:text-slate-900 font-medium">
            Login
          </Link>
          <Link href="/login" className="bg-indigo-600 text-white px-5 py-2 rounded-full font-medium hover:bg-indigo-700 transition">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center max-w-4xl">
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Meet Nex — Your <span className="text-indigo-600">AI Sales Employee</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 leading-relaxed">
          Stop writing cold emails. Assign tasks to Nex, and she will automatically score your leads, draft hyper-personalized emails, and follow up — all awaiting your final approval.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/login" className="bg-indigo-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-indigo-700 transition flex items-center justify-center">
            Start Free 7-Day Trial <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">No credit card required. Cancel anytime.</p>
      </section>

      {/* How it Works */}
      <section className="bg-white py-20 border-y border-slate-200">
        <div className="container mx-auto px-6 max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">How Nexus OS Gets You Clients</h2>
          
          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Bot className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">1. Smart Scoring</h3>
              <p className="text-slate-600">Import your CSV. Our AI analyzes titles and companies to highlight your hottest leads instantly.</p>
            </div>
            
            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Mail className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">2. AI Drafting</h3>
              <p className="text-slate-600">Nexus OS writes personalized emails based on your exact business offering and their company data.</p>
            </div>
            
            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">3. 1-Click Approve</h3>
              <p className="text-slate-600">Review drafts in your queue. Click approve, and we send it. You stay in complete control.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-6 py-20 max-w-4xl text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
        <p className="text-slate-600 mb-12">Built for Indian freelancers. 10x cheaper than Western alternatives.</p>
        
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md mx-auto shadow-xl">
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Pro Plan</h3>
          <div className="text-5xl font-extrabold text-indigo-600 mb-6">₹999<span className="text-lg text-slate-500 font-normal">/mo</span></div>
          
          <ul className="text-left space-y-4 mb-8">
            <li className="flex items-center text-slate-700"><CheckCircle2 className="h-5 w-5 text-green-500 mr-3" /> Unlimited lead imports</li>
            <li className="flex items-center text-slate-700"><CheckCircle2 className="h-5 w-5 text-green-500 mr-3" /> AI scoring & prioritization</li>
            <li className="flex items-center text-slate-700"><CheckCircle2 className="h-5 w-5 text-green-500 mr-3" /> Personalized email drafting</li>
            <li className="flex items-center text-slate-700"><CheckCircle2 className="h-5 w-5 text-green-500 mr-3" /> Smart follow-up sequences</li>
            <li className="flex items-center text-slate-700"><CheckCircle2 className="h-5 w-5 text-green-500 mr-3" /> Funnel analytics</li>
          </ul>
          
          <Link href="/login" className="block w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition">
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 text-center">
        <p>© 2026 Nexus OS. Built for independent operators.</p>
      </footer>
    </div>
  );
}
