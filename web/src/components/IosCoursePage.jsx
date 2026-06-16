import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

const modules = [
  ['01', '如何刻意锻炼产品感', '从工作、生活、App Store 榜单、评论和社群里发现可开发、可收费的机会。'],
  ['02', '好看的 iOS UI 如何设计', '用 Apple 风格的层级、组件、空状态和 Liquid Glass 思路做出不模板的界面。'],
  ['03', '订阅付费和一次性购买', '理解 StoreKit 2、订阅、买断、恢复购买、免费额度和 Pro 权益。'],
  ['04', 'SwiftData + iCloud', '用轻量数据方案完成本地保存、历史记录和 iCloud 同步。'],
  ['05', '审核、备案与海外上线', '覆盖 App Review、国内提审备案、海外上线、TestFlight 和 Xcode 自动化构建。'],
  ['06', 'Codex 开通与付费教程', '课程优先使用 Codex 教学，Claude Code、Cursor 也可使用。'],
]

const skills = [
  '自动构建版本并发布到 App Store',
  '自动化截图与美化',
  '自动化生成 Release 图片',
  '自动新增版本和产品更新介绍',
  '生成 Logo Skills',
  'Liquid Glass Skills',
]

function copyWechat() {
  navigator.clipboard?.writeText('curisaas')
  trackEvent('ios_course_copy_wechat')
}

export default function IosCoursePage({ onBack }) {
  return (
    <div className="ios-course-page -mx-4 -mt-14 sm:-mx-6">
      <style>{`
        .ios-course-page {
          --course-ink: #14130f;
          --course-muted: #6b6860;
          --course-line: #e7e4dd;
          --course-paper: #f6f5f2;
          --course-green: #1a7f4f;
          min-height: 100vh;
          background: #fff;
          color: var(--course-ink);
          font-family: Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
        }
        .ios-course-nav {
          position: sticky;
          top: 0;
          z-index: 20;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(18px, 6vw, 88px);
          border-bottom: 1px solid var(--course-line);
          background: rgba(255,255,255,.78);
          backdrop-filter: blur(22px) saturate(180%);
        }
        .ios-course-nav button, .ios-course-nav a {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 0;
          background: transparent;
          color: var(--course-ink);
          font: inherit;
          cursor: pointer;
        }
        .ios-course-nav .reserve {
          min-height: 40px;
          padding: 0 16px;
          border-radius: 9px;
          background: var(--course-ink);
          color: #fff;
          font-weight: 650;
        }
        .ios-hero {
          position: relative;
          isolation: isolate;
          min-height: calc(100vh - 64px);
          overflow: hidden;
          padding: clamp(72px, 14vh, 150px) clamp(18px, 10vw, 148px) 92px;
        }
        .ios-hero-bg {
          position: absolute;
          inset: 0;
          z-index: -2;
          overflow: hidden;
          background: #fff;
        }
        .ios-hero-bg::before,
        .ios-hero-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url('/ios-course/hero-mountain-mist.png');
          background-repeat: no-repeat;
          background-size: min(1500px, 116vw) auto;
          background-position: 72% 58%;
          will-change: transform, opacity;
        }
        .ios-hero-bg::before {
          opacity: .74;
          animation: courseMountain 26s ease-in-out infinite alternate;
        }
        .ios-hero-bg::after {
          opacity: .22;
          filter: blur(8px);
          animation: courseMountainSoft 34s ease-in-out infinite alternate;
        }
        .ios-hero-fog {
          position: absolute;
          inset: 0;
          z-index: -1;
          background:
            linear-gradient(to bottom, rgba(255,255,255,.97), rgba(255,255,255,.34) 38%, rgba(255,255,255,.88) 78%, #fff),
            radial-gradient(70vw 38vw at 26% 64%, rgba(255,255,255,.82), rgba(255,255,255,0) 68%);
          animation: courseFog 18s ease-in-out infinite alternate;
        }
        @keyframes courseMountain {
          from { transform: scale(1.02) translate3d(-1.2%, -.5%, 0); }
          to { transform: scale(1.045) translate3d(1.2%, .8%, 0); }
        }
        @keyframes courseMountainSoft {
          from { transform: scale(1.08) translate3d(1.2%, 1.4%, 0); }
          to { transform: scale(1.12) translate3d(-1.2%, .2%, 0); }
        }
        @keyframes courseFog {
          from { opacity: .86; transform: translate3d(0,0,0); }
          to { opacity: .98; transform: translate3d(0,-1.6%,0); }
        }
        .ios-pill {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 7px 15px 7px 12px;
          border-radius: 999px;
          border: 1px solid var(--course-line);
          background: rgba(255,255,255,.72);
          color: #2c2a25;
          font-size: 13.5px;
          font-weight: 560;
        }
        .ios-pill i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--course-green);
        }
        .ios-hero h1 {
          max-width: 1040px;
          margin: 34px 0 0;
          font-size: clamp(54px, 8.8vw, 132px);
          line-height: .92;
          letter-spacing: -.055em;
          font-weight: 780;
        }
        .ios-hero h1 span { display: block; }
        .ios-hero h1 span:nth-child(2) { transform: translateX(7.5vw); }
        .ios-lead {
          position: absolute;
          right: clamp(18px, 10vw, 148px);
          bottom: 86px;
          max-width: 375px;
          margin: 0;
          color: #2c2a25;
          font-size: 20px;
          line-height: 1.58;
        }
        .ios-section {
          padding: 86px clamp(18px, 8vw, 116px);
          border-top: 1px solid var(--course-line);
          background: #fff;
        }
        .ios-section.paper { background: var(--course-paper); }
        .ios-wrap { max-width: 1120px; margin: 0 auto; }
        .ios-section h2 {
          margin: 0 0 16px;
          font-size: clamp(32px, 5vw, 58px);
          line-height: 1.08;
          letter-spacing: -.035em;
        }
        .ios-section p {
          color: var(--course-muted);
          font-size: 17px;
          line-height: 1.75;
        }
        .ios-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 34px;
        }
        .ios-card {
          padding: 24px;
          border: 1px solid var(--course-line);
          border-radius: 16px;
          background: rgba(255,255,255,.78);
          box-shadow: 0 1px 2px rgba(20,19,15,.04);
        }
        .ios-num {
          display: inline-grid;
          place-items: center;
          width: 34px;
          height: 34px;
          margin-bottom: 18px;
          border-radius: 9px;
          background: var(--course-ink);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
        }
        .ios-card h3 { margin: 0 0 10px; font-size: 19px; letter-spacing: -.015em; }
        .ios-card p { margin: 0; font-size: 15px; line-height: 1.65; }
        .ios-skill-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 28px;
        }
        .ios-skill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px 16px;
          border-radius: 13px;
          border: 1px solid var(--course-line);
          background: #fff;
          color: #2c2a25;
          font-weight: 560;
        }
        .ios-skill svg { color: var(--course-green); }
        .ios-cta {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          align-items: center;
          gap: 48px;
          padding: 96px clamp(18px, 8vw, 116px);
          background: #14130f;
          color: #fff;
        }
        .ios-cta h2 { margin: 0 0 14px; font-size: clamp(36px, 6vw, 74px); line-height: .98; letter-spacing: -.045em; }
        .ios-cta p { max-width: 620px; color: rgba(255,255,255,.7); font-size: 18px; line-height: 1.7; }
        .ios-qr {
          padding: 20px;
          border-radius: 20px;
          background: #fff;
          color: var(--course-ink);
          text-align: center;
          box-shadow: 0 24px 70px rgba(0,0,0,.22);
        }
        .ios-qr img { width: 100%; border-radius: 8px; }
        .ios-qr button {
          margin-top: 14px;
          width: 100%;
          min-height: 42px;
          border: 1px solid var(--course-line);
          border-radius: 10px;
          background: var(--course-paper);
          color: var(--course-ink);
          cursor: pointer;
        }
        @media (max-width: 860px) {
          .ios-hero { min-height: auto; padding-top: 72px; }
          .ios-hero h1 { font-size: clamp(46px, 14vw, 68px); line-height: .98; }
          .ios-hero h1 span:nth-child(2) { transform: none; }
          .ios-lead { position: static; margin-top: 34px; max-width: 620px; font-size: 17px; }
          .ios-grid, .ios-skill-list, .ios-cta { grid-template-columns: 1fr; }
          .ios-qr { max-width: 280px; }
        }
      `}</style>
      <nav className="ios-course-nav">
        <button type="button" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Touchstone
        </button>
        <a className="reserve" href="#apply" onClick={() => trackEvent('ios_course_nav_reserve')}>
          预约课程
        </a>
      </nav>

      <section className="ios-hero">
        <div className="ios-hero-bg" aria-hidden="true" />
        <div className="ios-hero-fog" aria-hidden="true" />
        <span className="ios-pill"><i /> 6 月 20 日（周六）19:30–21:30 · 腾讯会议直播 · 限 24 人</span>
        <h1>
          <span>用 AI 做出</span>
          <span>第一款 iOS App</span>
        </h1>
        <p className="ios-lead">
          面向 macOS 用户的 2 小时入门直播课。带你用 AI 跑通从产品机会、界面设计、代码开发到订阅付费、TestFlight 内测和 App Store 上线的完整路径。
        </p>
      </section>

      <section className="ios-section">
        <div className="ios-wrap">
          <h2>不是 iOS 语法课，而是一次完整商业化演练</h2>
          <p>
            课程优先使用 Codex 教学，建议跟课保持一致；Claude Code、Cursor 也可以使用。你会看到如何把 AI 当作产品、设计、代码、截图、审核和发版助手。
          </p>
          <div className="ios-grid">
            {modules.map(([num, title, body]) => (
              <article className="ios-card" key={num}>
                <span className="ios-num">{num}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ios-section paper">
        <div className="ios-wrap">
          <h2>随课附赠 Skills 大礼包</h2>
          <p>不是资料链接，而是一组可继续复用的自动化能力，覆盖上架、截图、图标、更新文案和新系统视觉。</p>
          <div className="ios-skill-list">
            {skills.map((skill) => (
              <div className="ios-skill" key={skill}>
                <Check className="h-4 w-4 shrink-0" />
                <span>{skill}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ios-section">
        <div className="ios-wrap">
          <h2>报名满 12 人，追加神秘嘉宾场</h2>
          <p>
            如果报名满 12 人，将单独加开 1 小时神秘嘉宾专场，邀请 iOS 设计师分享 WWDC 现场见闻、iOS 27 新特性和 Apple 平台设计趋势。课程配套交流群，答疑优先沉淀成文档。
          </p>
        </div>
      </section>

      <section className="ios-cta" id="apply">
        <div>
          <h2>限 24 人，小班直播</h2>
          <p>
            价格 ¥1024 / 人。扫码添加 Jeff 林树微信，备注「iOS课」。报名后进入答疑群，问题会优先沉淀成文档，方便反复查阅。
          </p>
        </div>
        <div className="ios-qr">
          <img src="/ios-course/wechat-jeff-linshu.jpg" alt="Jeff 林树微信二维码" />
          <button type="button" onClick={copyWechat}>
            <Copy className="mr-1 inline h-3.5 w-3.5" />
            复制微信号 curisaas
          </button>
          <a
            href="https://jefflin.ai/ios-course"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-black/45"
          >
            分享课程链接 <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </section>
    </div>
  )
}
