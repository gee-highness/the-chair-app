// src/components/SplashScreen.tsx
//
// Servo's branded launch screen: logo on a glowing orb with a slim progress
// bar. CSS-only, so it renders in the server HTML before hydration. Used as
// the root loading state; pages inside use PageLoading skeletons instead.
const css = `
.ch-splash{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;background:radial-gradient(circle at 50% 42%,#3f2b86 0%,#151515 62%);z-index:9999;overflow:hidden}
.ch-orb{position:relative;width:132px;height:132px;display:flex;align-items:center;justify-content:center}
.ch-orb img{width:112px;height:112px;border-radius:26px;position:relative;z-index:2;animation:ch-pop .9s cubic-bezier(.2,.9,.3,1.2) both,ch-float 3.2s ease-in-out .9s infinite}
.ch-ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(138,108,240,.65);animation:ch-ring 2.4s ease-out infinite}
.ch-ring.r2{animation-delay:1.2s}
.ch-glow{position:absolute;inset:-40px;border-radius:50%;background:radial-gradient(circle,rgba(138,108,240,.45),rgba(138,108,240,0) 68%);animation:ch-breathe 3.2s ease-in-out infinite}
.ch-name{font:700 20px/1 var(--font-space-grotesk),system-ui,sans-serif;letter-spacing:.34em;text-indent:.34em;text-transform:uppercase;color:#e6dfff;animation:ch-rise .8s ease .35s both}
.ch-bar{width:140px;height:4px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;animation:ch-rise .8s ease .5s both}
.ch-bar i{display:block;height:100%;width:45%;border-radius:4px;background:linear-gradient(90deg,#8a6cf0,#d6c8ff);animation:ch-slide 1.3s ease-in-out infinite}
@keyframes ch-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@keyframes ch-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes ch-ring{0%{transform:scale(.85);opacity:.9}100%{transform:scale(2.1);opacity:0}}
@keyframes ch-breathe{0%,100%{opacity:.55;transform:scale(.95)}50%{opacity:1;transform:scale(1.08)}}
@keyframes ch-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ch-slide{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}
@media (prefers-reduced-motion:reduce){.ch-splash *{animation:none!important}}
`;

export function SplashScreen({ label = 'The Chair App' }: { label?: string }) {
  return (
    <div className="ch-splash" role="status" aria-label="Loading">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="ch-orb">
        <div className="ch-glow" />
        <div className="ch-ring" />
        <div className="ch-ring r2" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-192.png" alt="" />
      </div>
      <div className="ch-name">{label}</div>
      <div className="ch-bar">
        <i />
      </div>
    </div>
  );
}
